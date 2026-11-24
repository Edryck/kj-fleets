import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executors;

// Dirige pedidos reais pela API do motorista (/driver/**, Basic Auth).
@SuppressWarnings("unchecked") // o JSON lido é Map/List sem tipo; o formato da API é conhecido
public class DriverSimulator {

    static final String USAGE = """
            Uso: java scripts/DriverSimulator.java --drivers user:pass[,user:pass...] [opções]

              --base     URL da API (padrão http://localhost:8080)
              --drivers  credenciais Basic dos motoristas (obrigatório)
              --speed    velocidade em km/h (padrão 40)
              --tick     segundos entre pings (padrão 2)
              --auto-accept  ao ficar livre, aceita o pedido da fila com coleta mais perto
              --help     mostra esta ajuda
            """;

    // o servidor aceita até 200 m (ROUTING_ARRIVAL_RADIUS_M); parar com 50 m deixa folga para o GPS simulado
    static final double RADIUS_M = 50;
    static final String POD_TEXT = "Entregue na portaria, recebido por simulador";
    static final List<String> ACTIVE = List.of("DISPATCHED", "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS");

    record Point(double lat, double lng) {
    }

    private final java.util.Set<String> warnedNoRoute = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final HttpClient http = HttpClient.newHttpClient();
    private final String base;
    private final double speedKmh;
    private final double tickSeconds;
    private final long tickMillis;
    private final boolean autoAccept;

    private DriverSimulator(String base, double speedKmh, double tickSeconds, boolean autoAccept) {
        this.base = base;
        this.speedKmh = speedKmh;
        this.tickSeconds = tickSeconds;
        this.tickMillis = (long) (tickSeconds * 1000);
        this.autoAccept = autoAccept;
    }

    public static void main(String[] args) {
        if (List.of(args).contains("--help")) {
            System.out.print(USAGE);
            return;
        }
        var options = parseArgs(args);
        var speed = Double.parseDouble(options.getOrDefault("speed", "40"));
        var tick = Double.parseDouble(options.getOrDefault("tick", "2"));
        if (!options.containsKey("drivers") || speed <= 0 || tick <= 0) {
            System.err.print(USAGE);
            System.exit(1);
        }
        var simulator = new DriverSimulator(options.getOrDefault("base", "http://localhost:8080"), speed, tick,
                options.containsKey("auto-accept"));
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (var credentials : options.get("drivers").split(",")) {
                var parts = credentials.split(":", 2);
                if (parts.length != 2) {
                    System.err.print(USAGE);
                    System.exit(1);
                }
                var user = parts[0];
                var auth = "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
                executor.submit(() -> simulator.runDriver(user, auth));
            }
        }
    }

    private void runDriver(String user, String auth) {
        try {
            while (true) {
                try {
                    var orderId = oldestActiveOrderId(user, auth);
                    if (orderId != null) {
                        serveOrder(user, auth, orderId);
                    } else if (autoAccept) {
                        acceptNearest(user, auth);
                    }
                } catch (RuntimeException e) {
                    // resposta inesperada não pode matar a thread do motorista (o executor engoliria o erro)
                    System.out.println(user + " ! erro inesperado: " + e);
                }
                Thread.sleep(tickMillis);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String oldestActiveOrderId(String user, String auth) throws InterruptedException {
        var page = json(call(user, auth, "GET", "/driver/orders?limit=100", null));
        if (page == null) {
            return null;
        }
        return ((List<Map<String, Object>>) page.get("items")).stream()
                .filter(order -> ACTIVE.contains(order.get("status")))
                .min(Comparator.comparing((Map<String, Object> order) -> Instant.parse((String) order.get("dispatchedAt"))))
                .map(order -> (String) order.get("publicId"))
                .orElse(null);
    }

    // A fila não filtra por lugar: olha algumas páginas aleatórias e fica com a coleta mais perto.
    // Perder a corrida para outro motorista (409) só faz tentar de novo na próxima volta.
    private void acceptNearest(String user, String auth) throws InterruptedException {
        var me = json(call(user, auth, "GET", "/driver/me", null));
        var first = json(call(user, auth, "GET", "/driver/orders?available=true&limit=1", null));
        if (me == null || first == null) {
            return;
        }
        long total = ((Number) first.get("total")).longValue();
        if (total == 0) {
            return;
        }
        Point here = me.get("lat") == null ? null
                : new Point(((Number) me.get("lat")).doubleValue(), ((Number) me.get("lng")).doubleValue());
        var random = java.util.concurrent.ThreadLocalRandom.current();
        Map<String, Object> best = null;
        double bestM = Double.MAX_VALUE;
        for (int page = 0; page < 3; page++) {
            long offset = total <= 100 ? 0 : random.nextLong(total - 100);
            var items = json(call(user, auth, "GET", "/driver/orders?available=true&limit=100&offset=" + offset, null));
            if (items == null) {
                continue;
            }
            for (var order : (List<Map<String, Object>>) items.get("items")) {
                double m = here == null ? 0 : distanceM(here, pointOf((Map<String, Object>) order.get("pickup")));
                if (m < bestM) {
                    bestM = m;
                    best = order;
                }
            }
            if (total <= 100) {
                break;
            }
        }
        if (best != null) {
            post(user, auth, "/driver/orders/" + best.get("publicId") + "/accept", null,
                    String.format(Locale.ROOT, "aceitou %s (coleta a %.1f km)", best.get("publicId"), bestM / 1000));
        }
    }

    // Retoma de onde o pedido está: o estado vem da API a cada passagem, então um erro só para e tenta de novo.
    private void serveOrder(String user, String auth, String orderId) throws InterruptedException {
        var order = json(call(user, auth, "GET", "/driver/orders/" + orderId, null));
        var route = json(call(user, auth, "GET", "/driver/orders/" + orderId + "/route", null));
        if (order == null) {
            return;
        }
        var status = (String) order.get("status");
        var podRequired = Boolean.TRUE.equals(order.get("podRequired"));
        List<Map<String, Object>> stops;
        if (route != null) {
            stops = ((List<Map<String, Object>>) route.get("stops")).stream()
                    .sorted(Comparator.comparingInt((Map<String, Object> stop) -> ((Number) stop.get("seq")).intValue()))
                    .toList();
        } else {
            // sem rota não dá para concluir waypoints (o endpoint precisa da parada): vai direto coleta → entrega
            if (warnedNoRoute.add(orderId)) {
                System.out.println(user + " ! pedido " + orderId + " sem rota, usando coleta e entrega do pedido");
            }
            stops = List.of(
                    stopOf("START", 0, (Map<String, Object>) order.get("pickup")),
                    stopOf("PICKUP", 1, (Map<String, Object>) order.get("pickup")),
                    stopOf("DROPOFF", 2, (Map<String, Object>) order.get("dropoff")));
        }
        var start = stops.stream().filter(stop -> "START".equals(stop.get("type"))).findFirst().orElse(stops.get(0));
        var at = pointOf(start);

        if (status.equals("DISPATCHED") && !activity(user, auth, orderId, "DRIVER_ENROUTE", at)) {
            return;
        }
        if (status.equals("ARRIVED") && !activity(user, auth, orderId, "IN_PROGRESS", at)) {
            return;
        }

        for (var stop : stops) {
            if ("START".equals(stop.get("type")) || stop.get("visitedAt") != null) {
                continue;
            }
            var type = (String) stop.get("type");
            var seq = ((Number) stop.get("seq")).intValue();
            at = walkTo(user, auth, at, pointOf(stop), type + " " + seq);
            boolean ok = switch (type) {
                // ARRIVED marca o PICKUP como visitado no servidor; IN_PROGRESS libera a entrega
                case "PICKUP" -> activity(user, auth, orderId, "ARRIVED", at)
                        && activity(user, auth, orderId, "IN_PROGRESS", at);
                case "WAYPOINT" -> completeStop(user, auth, orderId, seq, at);
                case "DROPOFF" -> (!podRequired || pod(user, auth, orderId))
                        && activity(user, auth, orderId, "COMPLETED", at);
                default -> true;
            };
            if (!ok) {
                return;
            }
        }
    }

    private Point walkTo(String user, String auth, Point from, Point target, String label) throws InterruptedException {
        var at = from;
        var stepM = speedKmh / 3.6 * tickSeconds;
        while (distanceM(at, target) > RADIUS_M) {
            at = stepToward(at, target, stepM);
            post(user, auth, "/driver/location", "{\"lat\":%s,\"lng\":%s}".formatted(at.lat(), at.lng()),
                    String.format(Locale.ROOT, "ping %.5f,%.5f (%.0f m to %s)", at.lat(), at.lng(),
                            distanceM(at, target), label));
            Thread.sleep(tickMillis);
        }
        // o último passo cai exatamente na parada (o servidor mede a distância até ela)
        post(user, auth, "/driver/location", "{\"lat\":%s,\"lng\":%s}".formatted(target.lat(), target.lng()),
                "arrived at " + label);
        return target;
    }

    private boolean activity(String user, String auth, String orderId, String code, Point at) throws InterruptedException {
        return post(user, auth, "/driver/orders/%s/activity".formatted(orderId),
                "{\"code\":\"%s\",\"lat\":%s,\"lng\":%s}".formatted(code, at.lat(), at.lng()),
                "order %s %s".formatted(orderId, code));
    }

    private boolean completeStop(String user, String auth, String orderId, int seq, Point at) throws InterruptedException {
        return post(user, auth, "/driver/orders/%s/stops/%d/complete".formatted(orderId, seq),
                "{\"lat\":%s,\"lng\":%s}".formatted(at.lat(), at.lng()),
                "order %s stop %d done".formatted(orderId, seq));
    }

    private boolean pod(String user, String auth, String orderId) throws InterruptedException {
        return post(user, auth, "/driver/orders/%s/pod".formatted(orderId),
                "{\"value\":\"%s\"}".formatted(POD_TEXT), "order %s POD sent".formatted(orderId));
    }

    private boolean post(String user, String auth, String path, String body, String action) throws InterruptedException {
        if (call(user, auth, "POST", path, body) == null) {
            return false;
        }
        System.out.println(user + " → " + action);
        return true;
    }

    // Erro de HTTP ou de rede vira linha de log e null; quem chama decide parar a passagem
    private HttpResponse<String> call(String user, String auth, String method, String path, String body)
            throws InterruptedException {
        var builder = HttpRequest.newBuilder(URI.create(base + path))
                .header("Authorization", auth)
                .header("Accept", "application/json")
                .method(method, body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body));
        if (body != null) {
            builder.header("Content-Type", "application/json");
        }
        try {
            var response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                System.out.println(user + " ! " + method + " " + path + " → " + response.statusCode() + " " + response.body());
                return null;
            }
            return response;
        } catch (IOException e) {
            System.out.println(user + " ! " + method + " " + path + " → " + e.getMessage());
            return null;
        }
    }

    private static Map<String, Object> json(HttpResponse<String> response) {
        return response == null ? null : (Map<String, Object>) Json.parse(response.body());
    }

    private static Map<String, Object> stopOf(String type, int seq, Map<String, Object> place) {
        return Map.of("type", type, "seq", seq, "lat", place.get("lat"), "lng", place.get("lng"));
    }

    private static Point pointOf(Map<String, Object> node) {
        return new Point(((Number) node.get("lat")).doubleValue(), ((Number) node.get("lng")).doubleValue());
    }

    // Interpolação linear em lat/lng: no trecho de algumas centenas de metros o erro é desprezível
    private static Point stepToward(Point from, Point to, double stepM) {
        var dist = distanceM(from, to);
        if (stepM >= dist) {
            return to;
        }
        var fraction = stepM / dist;
        return new Point(from.lat() + (to.lat() - from.lat()) * fraction,
                from.lng() + (to.lng() - from.lng()) * fraction);
    }

    private static double distanceM(Point a, Point b) {
        var dLat = Math.toRadians(b.lat() - a.lat());
        var dLng = Math.toRadians(b.lng() - a.lng());
        var h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(a.lat())) * Math.cos(Math.toRadians(b.lat()))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
    }

    private static Map<String, String> parseArgs(String[] args) {
        var values = new HashMap<String, String>();
        for (int i = 0; i < args.length; i += 2) {
            // flag sem valor (ex.: --auto-accept) vira "true"
            if (args[i].startsWith("--") && (i + 1 >= args.length || args[i + 1].startsWith("--"))) {
                values.put(args[i].substring(2), "true");
                i--;
                continue;
            }
            if (!args[i].startsWith("--")) {
                System.err.print(USAGE);
                System.exit(1);
            }
            values.put(args[i].substring(2), args[i + 1]);
        }
        return values;
    }

    // Leitor mínimo de JSON: objetos viram Map, arrays viram List, números viram Double
    static final class Json {

        private final String text;
        private int pos;

        private Json(String text) {
            this.text = text;
        }

        static Object parse(String text) {
            return new Json(text).value();
        }

        private Object value() {
            skipSpaces();
            return switch (text.charAt(pos)) {
                case '{' -> object();
                case '[' -> array();
                case '"' -> string();
                case 't' -> literal("true", Boolean.TRUE);
                case 'f' -> literal("false", Boolean.FALSE);
                case 'n' -> literal("null", null);
                default -> number();
            };
        }

        private Map<String, Object> object() {
            var map = new HashMap<String, Object>();
            pos++;
            skipSpaces();
            if (text.charAt(pos) == '}') {
                pos++;
                return map;
            }
            while (true) {
                skipSpaces();
                var key = string();
                skipSpaces();
                pos++;
                map.put(key, value());
                skipSpaces();
                if (text.charAt(pos++) == '}') {
                    return map;
                }
            }
        }

        private List<Object> array() {
            var list = new ArrayList<Object>();
            pos++;
            skipSpaces();
            if (text.charAt(pos) == ']') {
                pos++;
                return list;
            }
            while (true) {
                list.add(value());
                skipSpaces();
                if (text.charAt(pos++) == ']') {
                    return list;
                }
            }
        }

        private String string() {
            var out = new StringBuilder();
            pos++;
            while (text.charAt(pos) != '"') {
                var c = text.charAt(pos++);
                if (c != '\\') {
                    out.append(c);
                    continue;
                }
                var escaped = text.charAt(pos++);
                switch (escaped) {
                    case 'n' -> out.append('\n');
                    case 't' -> out.append('\t');
                    case 'r' -> out.append('\r');
                    case 'b' -> out.append('\b');
                    case 'f' -> out.append('\f');
                    case 'u' -> {
                        out.append((char) Integer.parseInt(text.substring(pos, pos + 4), 16));
                        pos += 4;
                    }
                    default -> out.append(escaped);
                }
            }
            pos++;
            return out.toString();
        }

        private Double number() {
            var start = pos;
            while (pos < text.length() && "+-.eE0123456789".indexOf(text.charAt(pos)) >= 0) {
                pos++;
            }
            return Double.parseDouble(text.substring(start, pos));
        }

        private Object literal(String word, Object value) {
            pos += word.length();
            return value;
        }

        private void skipSpaces() {
            while (Character.isWhitespace(text.charAt(pos))) {
                pos++;
            }
        }
    }
}
