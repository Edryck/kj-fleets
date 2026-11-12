package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.dto.RouteDtos.AlgorithmResult;
import br.com.kjfleets.dto.RouteDtos.NextStop;
import br.com.kjfleets.dto.RouteDtos.OptimizeRequest;
import br.com.kjfleets.dto.RouteDtos.OptimizeResponse;
import br.com.kjfleets.dto.RouteDtos.OptimizedStop;
import br.com.kjfleets.dto.RouteDtos.PointDto;
import br.com.kjfleets.dto.RouteDtos.RouteRequest;
import br.com.kjfleets.dto.RouteDtos.RouteResponse;
import br.com.kjfleets.dto.RouteDtos.StopCompleteRequest;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Payload;
import br.com.kjfleets.entity.Place;
import br.com.kjfleets.entity.Route;
import br.com.kjfleets.entity.RouteStop;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.entity.TrackingStatus;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.RouteRepository;
import br.com.kjfleets.repository.TrackingStatusRepository;
import br.com.kjfleets.security.CurrentActor;
import br.com.kjfleets.routing.RouteAlgorithm;
import br.com.kjfleets.routing.RouteOptimizer;
import br.com.kjfleets.routing.RouteOptimizer.Plan;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.IntStream;

@Service
public class RouteService {

    private final RouteRepository routes;
    private final OrderRepository orders;
    private final DistanceService distance;
    private final RoutingProperties props;
    private final DriverRepository drivers;
    private final TrackingStatusRepository trackings;

    public RouteService(RouteRepository routes, OrderRepository orders, DistanceService distance,
                        RoutingProperties props, DriverRepository drivers, TrackingStatusRepository trackings) {
        this.drivers = drivers;
        this.trackings = trackings;
        this.routes = routes;
        this.orders = orders;
        this.distance = distance;
        this.props = props;
    }

    // ponto da matriz: stop de origem (se já concluída) + dados para gravar a nova linha
    private record Point(StopType type, Place place, double lat, double lng, RouteStop visited) {

        static Point of(StopType type, Place place) {
            return new Point(type, place, place.getLat(), place.getLng(), null);
        }

        static Point at(StopType type, PointDto point) {
            return new Point(type, null, point.lat(), point.lng(), null);
        }
    }

    // o chamador já segura a transação e a trava do pedido
    public Route compute(Order order, RouteAlgorithm algorithm, Long seed) {
        Payload payload = order.getPayload();
        Route previous = routes.findByOrder(order).orElse(null);
        List<RouteStop> visited = previous == null ? List.of() : previous.getStops().stream()
                .filter(s -> s.getVisitedAt() != null)
                .sorted(Comparator.comparing(RouteStop::getVisitedAt).thenComparingInt(RouteStop::getSeq))
                .toList();

        List<Place> pendingWaypoints = new ArrayList<>(payload.getWaypoints());
        boolean pickupPending = true;
        for (RouteStop stop : visited) {
            if (stop.getType() == StopType.PICKUP) {
                pickupPending = false;
            } else if (stop.getType() == StopType.WAYPOINT) {
                // um por concluída: o mesmo lugar pode aparecer mais de uma vez no payload
                for (int i = 0; i < pendingWaypoints.size(); i++) {
                    if (pendingWaypoints.get(i).getId().equals(stop.getPlace().getId())) {
                        pendingWaypoints.remove(i);
                        break;
                    }
                }
            }
        }

        // concluídas primeiro (perna original preservada); sem posição do motorista não entra START novo
        List<Point> points = new ArrayList<>();
        for (RouteStop stop : visited) {
            points.add(new Point(stop.getType(), stop.getPlace(), stop.getLat(), stop.getLng(), stop));
        }
        Driver driver = order.getDriver();
        if (driver != null && driver.getLat() != null && driver.getLng() != null) {
            points.add(new Point(StopType.START, null, driver.getLat(), driver.getLng(), null));
        }
        if (pickupPending) {
            points.add(Point.of(StopType.PICKUP, payload.getPickup()));
        }
        int fixedPrefix = points.size();
        pendingWaypoints.forEach(p -> points.add(Point.of(StopType.WAYPOINT, p)));
        points.add(Point.of(StopType.DROPOFF, payload.getDropoff()));

        double[][] km = distance.matrix(points.stream().map(p -> new double[]{p.lat(), p.lng()}).toList());
        int visitedCount = visited.size();
        double visitedKm = 0;
        for (int i = 0; i < visitedCount; i++) {
            visitedKm += visited.get(i).getLegKm();
        }
        double baselineKm = visitedKm + legsKm(km, IntStream.range(0, points.size()).boxed().toList(), visitedCount);

        RouteAlgorithm chosen = algorithm != null ? algorithm : RouteOptimizer.defaultFor(pendingWaypoints.size());
        Plan plan = solveOrder(km, fixedPrefix, chosen, seed);

        // apaga e dá flush antes: order_id é único e o insert novo viria antes do delete
        if (previous != null) {
            routes.delete(previous);
            routes.flush();
        }

        Route route = new Route();
        route.setOrder(order);
        route.setAlgorithm(chosen);
        route.setMode(distance.props().mode().name());
        double totalKm = visitedKm + legsKm(km, plan.order(), visitedCount);
        route.setTotalKm(totalKm);
        route.setBaselineKm(baselineKm);
        route.setSavingsPct(savingsPct(baselineKm, totalKm));
        route.setEtaMinutes(distance.etaMinutes(totalKm));
        route.setComputedAt(Instant.now());
        for (int seq = 0; seq < plan.order().size(); seq++) {
            Point point = points.get(plan.order().get(seq));
            RouteStop stop = new RouteStop();
            stop.setRoute(route);
            stop.setSeq(seq);
            stop.setType(point.type());
            stop.setPlace(point.place());
            stop.setLat(point.lat());
            stop.setLng(point.lng());
            if (point.visited() != null) {
                stop.setLegKm(point.visited().getLegKm());
                stop.setVisitedAt(point.visited().getVisitedAt());
                stop.setDistanceM(point.visited().getDistanceM());
                stop.setCompletedBy(point.visited().getCompletedBy());
            } else {
                stop.setLegKm(seq == 0 ? 0 : km[plan.order().get(seq - 1)][plan.order().get(seq)]);
            }
            route.getStops().add(stop);
        }
        return routes.save(route);
    }

    @Transactional
    public RouteResponse computeManual(String orderPublicId, RouteRequest request) {
        Order order = orders.lockByPublicId(orderPublicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
        if (order.getStatus().isTerminal()) {
            throw new BusinessException("ORDER_INVALID_TRANSITION", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Pedido em " + order.getStatus() + " não aceita esta ação");
        }
        Route route = compute(order, request.algorithm(), request.seed());
        return RouteResponse.from(route, eta(order, route));
    }

    // sem @Transactional de propósito: roda na transação do chamador, e um proxy que lança marcaria rollback-only
    public Optional<String> computeOnDispatch(Order order) {
        try {
            compute(order, null, null);
            return Optional.empty();
        } catch (BusinessException e) {
            return Optional.of(e.code());
        }
    }

    public void discard(Order order) {
        routes.findByOrder(order).ifPresent(routes::delete);
    }

    public Integer liveEta(Order order) {
        return liveEta(order, routes.findByOrder(order).orElse(null));
    }

    // rota já carregada pelo chamador (lista de pedidos); sem rota não há ETA
    public Integer liveEta(Order order, Route route) {
        return route == null ? null : eta(order, route);
    }

    private Integer eta(Order order, Route route) {
        if (order.getStatus().isTerminal()) {
            return null;
        }
        if (order.getStatus() == OrderStatus.CREATED) {
            return route.getEtaMinutes();
        }
        List<RouteStop> pending = route.getStops().stream()
                .filter(s -> s.getVisitedAt() == null && s.getType() != StopType.START).toList();
        Driver driver = order.getDriver();
        boolean fresh = driver != null && driver.getLat() != null && driver.getLng() != null
                && driver.getLastSeenAt() != null
                && Duration.between(driver.getLastSeenAt(), Instant.now()).toSeconds() <= props.positionMaxAgeS();
        double km = pending.stream().mapToDouble(RouteStop::getLegKm).sum();
        if (fresh && !pending.isEmpty()) {
            RouteStop next = pending.get(0);
            try {
                km += distance.km(driver.getLat(), driver.getLng(), next.getLat(), next.getLng()) - next.getLegKm();
            } catch (BusinessException e) {
                // modo trocado para road com rota antiga gravada: leitura não pode falhar, vale a soma das pernas
            }
        }
        return distance.etaMinutes(km);
    }

    @Transactional
    public RouteResponse completeStop(String orderPublicId, int seq, StopCompleteRequest request,
                                      String actorUsername, boolean actorIsDriver) {
        if ((request.lat() == null) != (request.lng() == null)) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "informe lat e lng juntos");
        }
        Order order = orders.lockByPublicId(orderPublicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
        Driver driver = order.getDriver();
        if (actorIsDriver && (driver == null || !driver.isActive()
                || !driver.getUser().getUsername().equals(actorUsername))) {
            throw BusinessException.notFound("Pedido");
        }
        if (order.getStatus() == OrderStatus.CREATED || order.getStatus().isTerminal()) {
            throw invalidTransition(order);
        }
        Route route = routes.findByOrder(order).orElseThrow(() -> new BusinessException("ROUTE_NOT_FOUND",
                HttpStatus.NOT_FOUND, "Pedido sem rota calculada"));
        RouteStop stop = route.getStops().stream().filter(s -> s.getSeq() == seq).findFirst()
                .orElseThrow(() -> BusinessException.notFound("Parada"));
        if (stop.getType() != StopType.WAYPOINT) {
            throw invalidTransition(order);
        }
        if (stop.getVisitedAt() == null) {
            double[] position = position(driver, request.lat(), request.lng());
            Double meters = metersTo(position, stop.getLat(), stop.getLng());
            if (actorIsDriver) {
                requireWithinRadius(meters);
                if (request.lat() != null) {
                    Driver locked = drivers.lockById(driver.getId()).orElseThrow();
                    locked.setLat(request.lat());
                    locked.setLng(request.lng());
                    locked.setLastSeenAt(Instant.now());
                }
            }
            stop.setVisitedAt(Instant.now());
            stop.setDistanceM(meters);
            stop.setCompletedBy(actorUsername);
            String details = "WAYPOINT #" + seq + (actorIsDriver ? "" : " por " + actorUsername);
            CurrentActor actor = CurrentActor.get();
            trackings.save(TrackingStatus.of(order, "stop_completed", details, null, null, actor.username(),
                    actor.role()));
        }
        return RouteResponse.from(route, eta(order, route));
    }

    public void requireNearDropoff(Order order, Double lat, Double lng) {
        Place dropoff = order.getPayload().getDropoff();
        double[] position = position(order.getDriver(), lat, lng);
        requireWithinRadius(metersTo(position, dropoff.getLat(), dropoff.getLng()));
    }

    // próxima parada pendente (sem START); sem rota vale o dropoff do payload. Mesma posição, idade e raio da conclusão
    public NextStop nextStop(Order order) {
        return nextStop(order, routes.findByOrder(order).orElse(null));
    }

    public NextStop nextStop(Order order, Route route) {
        RouteStop pending = route == null ? null : route.getStops().stream()
                .filter(s -> s.getVisitedAt() == null && s.getType() != StopType.START)
                .min(Comparator.comparingInt(RouteStop::getSeq)).orElse(null);
        Driver driver = order.getDriver();
        double[] position = position(driver, null, null);
        Instant seenAt = driver == null ? null : driver.getLastSeenAt();
        Long ageS = seenAt == null ? null : Duration.between(seenAt, Instant.now()).toSeconds();
        int radius = props.arrivalRadiusM();
        int seq = 0;
        StopType type = StopType.DROPOFF;
        Place place;
        double lat;
        double lng;
        if (pending != null) {
            seq = pending.getSeq();
            type = pending.getType();
            place = pending.getPlace();
            lat = pending.getLat();
            lng = pending.getLng();
        } else {
            place = order.getPayload().getDropoff();
            lat = place.getLat();
            lng = place.getLng();
        }
        Double meters = metersTo(position, lat, lng);
        return new NextStop(seq, type, place == null ? null : place.getName(), place == null ? null : place.getAddress(),
                meters, radius, meters == null ? null : meters <= radius, ageS, position != null);
    }

    private Double metersTo(double[] position, double lat, double lng) {
        return position == null ? null : distance.straightMeters(position[0], position[1], lat, lng);
    }

    public void markVisited(Order order, StopType type, String username) {
        routes.findByOrder(order).flatMap(route -> route.getStops().stream()
                .filter(s -> s.getType() == type && s.getVisitedAt() == null).findFirst()).ifPresent(stop -> {
                    stop.setVisitedAt(Instant.now());
                    stop.setCompletedBy(username);
                });
    }

    // posição do corpo ganha; senão a gravada do motorista, só se ainda estiver dentro da idade máxima
    private double[] position(Driver driver, Double lat, Double lng) {
        if (lat != null) {
            return new double[]{lat, lng};
        }
        boolean fresh = driver != null && driver.getLat() != null && driver.getLng() != null
                && driver.getLastSeenAt() != null
                && Duration.between(driver.getLastSeenAt(), Instant.now()).toSeconds() <= props.positionMaxAgeS();
        return fresh ? new double[]{driver.getLat(), driver.getLng()} : null;
    }

    private void requireWithinRadius(Double meters) {
        if (meters == null) {
            throw new BusinessException("STOP_TOO_FAR", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Sem posição recente do motorista");
        }
        if (meters > props.arrivalRadiusM()) {
            throw new BusinessException("STOP_TOO_FAR", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Fora do raio: " + Math.round(meters) + " m");
        }
    }

    private static BusinessException invalidTransition(Order order) {
        return new BusinessException("ORDER_INVALID_TRANSITION", HttpStatus.UNPROCESSABLE_ENTITY,
                "Pedido em " + order.getStatus() + " não aceita esta ação");
    }

    @Transactional(readOnly = true)
    public RouteResponse driverRoute(String orderPublicId, String username) {
        Order order = orders.findByPublicId(orderPublicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
        Driver driver = order.getDriver();
        if (driver == null || !driver.isActive() || !driver.getUser().getUsername().equals(username)) {
            throw BusinessException.notFound("Pedido");
        }
        RouteResponse response = get(orderPublicId);
        return order.getStatus().isTerminal() ? response : response.withNextStop(nextStop(order));
    }

    @Transactional(readOnly = true)
    public RouteResponse get(String orderPublicId) {
        Order order = orders.findByPublicId(orderPublicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
        Route route = routes.findByOrder(order).orElseThrow(() -> new BusinessException("ROUTE_NOT_FOUND",
                HttpStatus.NOT_FOUND, "Pedido sem rota calculada"));
        return RouteResponse.from(route, eta(order, route));
    }

    // avulsa: mesma matriz, mesmos totais e economia de compute, mas sem pedido nem gravação
    public OptimizeResponse optimize(OptimizeRequest request) {
        List<PointDto> waypoints = request.waypoints() == null ? List.of() : request.waypoints();
        List<Point> points = new ArrayList<>();
        if (request.start() != null) {
            points.add(Point.at(StopType.START, request.start()));
        }
        int fixedPrefix = points.size() + 1;
        points.add(Point.at(StopType.PICKUP, request.pickup()));
        waypoints.forEach(w -> points.add(Point.at(StopType.WAYPOINT, w)));
        points.add(Point.at(StopType.DROPOFF, request.dropoff()));

        double[][] km = distance.matrix(points.stream().map(p -> new double[]{p.lat(), p.lng()}).toList());
        RouteAlgorithm chosen = request.algorithm() != null ? request.algorithm()
                : RouteOptimizer.defaultFor(waypoints.size());
        Plan plan = solveOrder(km, fixedPrefix, chosen, request.seed());
        double totalKm = legsKm(km, plan.order(), 0);
        double baselineKm = legsKm(km, IntStream.range(0, points.size()).boxed().toList(), 0);

        List<OptimizedStop> stops = new ArrayList<>();
        for (int seq = 0; seq < plan.order().size(); seq++) {
            int index = plan.order().get(seq);
            Point point = points.get(index);
            stops.add(new OptimizedStop(seq, point.type(), point.lat(), point.lng(),
                    seq == 0 ? 0 : km[plan.order().get(seq - 1)][index],
                    point.type() == StopType.WAYPOINT ? index - fixedPrefix : null));
        }

        Map<RouteAlgorithm, AlgorithmResult> comparison = null;
        if (Boolean.TRUE.equals(request.compare())) {
            comparison = new EnumMap<>(RouteAlgorithm.class);
            for (RouteAlgorithm algorithm : RouteAlgorithm.values()) {
                if (algorithm == RouteAlgorithm.HELD_KARP && waypoints.size() > RouteOptimizer.HELD_KARP_MAX) {
                    continue;
                }
                long started = System.nanoTime();
                Plan solved = solveOrder(km, fixedPrefix, algorithm, request.seed());
                long ms = (System.nanoTime() - started) / 1_000_000;
                comparison.put(algorithm, new AlgorithmResult(legsKm(km, solved.order(), 0), ms));
            }
        }
        return new OptimizeResponse(chosen, stops, totalKm, baselineKm, savingsPct(baselineKm, totalKm),
                distance.etaMinutes(totalKm), comparison);
    }

    private static Plan solveOrder(double[][] km, int fixedPrefix, RouteAlgorithm algorithm, Long seed) {
        try {
            return RouteOptimizer.solve(km, fixedPrefix, algorithm, seed);
        } catch (RouteOptimizer.TooLargeForExactException e) {
            throw new BusinessException("ROUTE_TOO_LARGE_FOR_EXACT", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Held-Karp aceita no máximo " + RouteOptimizer.HELD_KARP_MAX + " waypoints pendentes");
        }
    }

    // soma das pernas a partir da última concluída (visitedCount); sem concluídas, a partir da primeira
    private static double legsKm(double[][] km, List<Integer> order, int visitedCount) {
        double total = 0;
        for (int seq = Math.max(visitedCount, 1); seq < order.size(); seq++) {
            total += km[order.get(seq - 1)][order.get(seq)];
        }
        return total;
    }

    private static double savingsPct(double baselineKm, double totalKm) {
        return baselineKm == 0 ? 0 : round2((baselineKm - totalKm) / baselineKm * 100);
    }

    private static double round2(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
