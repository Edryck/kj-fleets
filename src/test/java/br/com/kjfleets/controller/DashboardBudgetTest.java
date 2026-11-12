package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import javax.sql.DataSource;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(DashboardBudgetTest.CountingConfig.class)
class DashboardBudgetTest extends IntegrationTest {

    private static final AtomicInteger STATEMENTS = new AtomicInteger();
    private static final int ORDERS = 5000;
    private static final int DRIVERS = 50;
    private static final int VEHICLES = 30;
    private static final String[] ACTIVE = {"CREATED", "DISPATCHED", "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS"};

    // proxy do DataSource que só conta execute*; fica num contexto próprio (o @Import muda a chave do cache)
    @TestConfiguration
    static class CountingConfig {
        @Bean
        static BeanPostProcessor countingDataSource() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String name) {
                    return bean instanceof DataSource ds ? wrap(DataSource.class, ds) : bean;
                }
            };
        }

        private static <T> T wrap(Class<T> type, T target) {
            return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, (proxy, method, args) -> {
                if (method.getName().startsWith("execute")) {
                    STATEMENTS.incrementAndGet();
                }
                try {
                    Object result = method.invoke(target, args);
                    if (result instanceof Connection c && type == DataSource.class) {
                        return wrap(Connection.class, c);
                    }
                    if (result instanceof java.sql.PreparedStatement s && type == Connection.class) {
                        return wrap(java.sql.PreparedStatement.class, s);
                    }
                    if (result instanceof Statement s && type == Connection.class) {
                        return wrap(Statement.class, s);
                    }
                    return result;
                } catch (InvocationTargetException e) {
                    throw e.getCause();
                }
            }));
        }
    }

    @Autowired
    private JdbcTemplate jdbc;

    private static String customerBearer;
    private static String driverUsername;

    private static OffsetDateTime at(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    // multi-row VALUES em lotes de 500 linhas (menos de 32767 parâmetros por comando)
    private void insert(String table, String columns, int rows, IntFunction<Object[]> row) {
        int width = columns.split(",").length;
        String one = "(" + String.join(",", java.util.Collections.nCopies(width, "?")) + ")";
        for (int from = 0; from < rows; from += 500) {
            int to = Math.min(rows, from + 500);
            List<Object> params = new ArrayList<>();
            for (int i = from; i < to; i++) {
                params.addAll(java.util.Arrays.asList(row.apply(i)));
            }
            jdbc.update("INSERT INTO " + table + " (" + columns + ") VALUES "
                    + String.join(",", java.util.Collections.nCopies(to - from, one)), params.toArray());
        }
    }

    private static Object[] r(Object... values) {
        return values;
    }

    private void seed() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        authService.register(new RegisterRequest("budget-" + suffix, "password-123", "Cliente " + suffix, null,
                suffix + "@mail.com"));
        AppUser user = userRepository.findByUsername("budget-" + suffix).orElseThrow();
        customerBearer = "Bearer " + jwtService.generate(user);
        UUID customerId = jdbc.queryForObject("SELECT id FROM customers WHERE user_id = ?", UUID.class, user.getId());

        OrderFixtures fixtures = new OrderFixtures(mvc, json, this::bearer);
        String driverPublicId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        driverUsername = json.readTree(mvc.perform(get("/drivers/" + driverPublicId)
                .header("Authorization", bearer(Role.ADMIN))).andReturn().getResponse().getContentAsString())
                .get("username").asString();
        UUID panelDriver = jdbc.queryForObject("SELECT id FROM drivers WHERE public_id = ?", UUID.class,
                driverPublicId);

        Random rnd = new Random(42);
        Instant now = Instant.now();
        UUID[] userIds = new UUID[DRIVERS];
        UUID[] vehicleIds = new UUID[VEHICLES];
        UUID[] driverIds = new UUID[DRIVERS];
        driverIds[0] = panelDriver;
        for (int i = 0; i < DRIVERS; i++) {
            userIds[i] = UUID.randomUUID();
            if (i > 0) {
                driverIds[i] = UUID.randomUUID();
            }
        }
        for (int i = 0; i < VEHICLES; i++) {
            vehicleIds[i] = UUID.randomUUID();
        }
        UUID pickup = UUID.randomUUID();
        UUID dropoff = UUID.randomUUID();

        insert("users", "id,username,password_hash,role,active", DRIVERS - 1,
                i -> r(userIds[i + 1], "bgt-" + suffix + "-" + i, "x", "DRIVER", true));
        insert("vehicles", "id,public_id,plate,type,status,active", VEHICLES,
                i -> r(vehicleIds[i], "vehicle_b" + suffix + i, "B" + suffix + i, "VAN", i < 20 ? "IN_USE" : "AVAILABLE", true));
        // motoristas 1..29 com veículo, 30..49 sem (veículo é unique por motorista)
        insert("drivers", "id,public_id,name,status,lat,lng,last_seen_at,active,user_id,vehicle_id", DRIVERS - 1,
                i -> {
                    int d = i + 1;
                    String state = d < 20 ? "BUSY" : d < 35 ? "AVAILABLE" : "OFFLINE";
                    return r(driverIds[d], "driver_b" + suffix + d, "Motorista B" + d, state, -20.0 + rnd.nextDouble() * 0.2,
                            -50.0 + rnd.nextDouble() * 0.2, at(now.minus(rnd.nextInt(600), ChronoUnit.SECONDS)), true,
                            userIds[d], d < VEHICLES - 1 ? vehicleIds[d] : null);
                });
        insert("places", "id,public_id,name,lat,lng,active", 2,
                i -> r(i == 0 ? pickup : dropoff, "place_b" + suffix + i, "Ponto B" + i, -20.05 + i * 0.05, -50.05 + i * 0.05, true));

        UUID[] orderIds = new UUID[ORDERS];
        String[] statuses = new String[ORDERS];
        Instant[] created = new Instant[ORDERS];
        UUID[] orderDriver = new UUID[ORDERS];
        Instant[] finished = new Instant[ORDERS];
        Instant[] dispatched = new Instant[ORDERS];
        for (int i = 0; i < ORDERS; i++) {
            orderIds[i] = UUID.randomUUID();
            int roll = rnd.nextInt(100);
            boolean active = roll < 8;
            statuses[i] = active ? ACTIVE[rnd.nextInt(ACTIVE.length)]
                    : roll < 85 ? "COMPLETED" : roll < 94 ? "CANCELLED" : "FAILED";
            created[i] = active ? now.minus(rnd.nextInt(6 * 3600), ChronoUnit.SECONDS)
                    : now.minus(3, ChronoUnit.HOURS).minus(rnd.nextInt(400 * 24 * 60), ChronoUnit.MINUTES);
            boolean unassigned = statuses[i].equals("CREATED") && rnd.nextBoolean();
            boolean never = statuses[i].equals("CANCELLED") && rnd.nextBoolean();
            // o motorista do painel pega ~10% dos pedidos, para o painel dele ter histórico de verdade
            orderDriver[i] = unassigned || never ? null : rnd.nextInt(10) == 0 ? panelDriver : driverIds[rnd.nextInt(DRIVERS)];
            boolean wasDispatched = !statuses[i].equals("CREATED") && !never;
            dispatched[i] = wasDispatched ? created[i].plus(5 + rnd.nextInt(20), ChronoUnit.MINUTES) : null;
            boolean terminal = statuses[i].equals("COMPLETED") || statuses[i].equals("CANCELLED") || statuses[i].equals("FAILED");
            finished[i] = terminal ? created[i].plus(30 + rnd.nextInt(90), ChronoUnit.MINUTES) : null;
        }
        insert("orders", "id,public_id,tracking_number,status,customer_id,driver_id,pod_required,pod_value,created_at,"
                + "dispatched_at,finished_at,reason,version", ORDERS, i -> r(orderIds[i], "order_b" + suffix + i,
                "KB" + suffix.toUpperCase() + String.format("%05d", i), statuses[i], i % 5 == 0 ? customerId : null,
                orderDriver[i], i % 3 == 0, statuses[i].equals("COMPLETED") && i % 3 == 0 ? "ok" : null, at(created[i]),
                at(dispatched[i]), at(finished[i]), statuses[i].equals("FAILED") ? "endereço errado" : null, 0L));
        insert("payloads", "id,order_id,pickup_id,dropoff_id", ORDERS,
                i -> r(UUID.randomUUID(), orderIds[i], pickup, dropoff));

        // 3 a 5 eventos por pedido, na ordem real das etapas
        List<Object[]> tracking = new ArrayList<>();
        String[] flow = {"CREATED", "DISPATCHED", "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS"};
        for (int i = 0; i < ORDERS; i++) {
            int last = List.of(flow).indexOf(statuses[i]);
            if (last < 0) {
                last = statuses[i].equals("COMPLETED") ? 4 : statuses[i].equals("CANCELLED") ? 0 : 4;
            }
            Instant t = created[i];
            for (int s = 0; s <= last; s++) {
                tracking.add(r(UUID.randomUUID(), orderIds[i], flow[s], flow[s].toLowerCase(), "detalhe", -20.0 + rnd.nextDouble() * 0.1,
                        -50.0 + rnd.nextDouble() * 0.1, at(t), "seed", "ADMIN"));
                t = t.plus(3, ChronoUnit.MINUTES);
            }
            if (finished[i] != null) {
                tracking.add(r(UUID.randomUUID(), orderIds[i], statuses[i], statuses[i].toLowerCase(), null, null, null,
                        at(finished[i]), "seed", "ADMIN"));
            }
        }
        insert("tracking_statuses", "id,order_id,status,code,details,lat,lng,created_at,actor_username,actor_role",
                tracking.size(), tracking::get);

        List<Integer> withRoute = new ArrayList<>();
        for (int i = 0; i < ORDERS; i++) {
            if (!statuses[i].equals("CREATED") && !statuses[i].equals("CANCELLED")) {
                withRoute.add(i);
            }
        }
        UUID[] routeIds = new UUID[withRoute.size()];
        for (int i = 0; i < routeIds.length; i++) {
            routeIds[i] = UUID.randomUUID();
        }
        insert("routes", "id,order_id,algorithm,mode,total_km,baseline_km,savings_pct,eta_minutes,computed_at",
                routeIds.length, i -> r(routeIds[i], orderIds[withRoute.get(i)], "TWO_OPT", "haversine",
                        10 + rnd.nextDouble() * 20, 15 + rnd.nextDouble() * 20, rnd.nextDouble() * 25, 20 + rnd.nextInt(60),
                        at(created[withRoute.get(i)])));
        // paradas só nos pedidos ativos (é o que os painéis leem); os demais ficam com a rota agregada
        List<Integer> activeRoutes = new ArrayList<>();
        for (int i = 0; i < routeIds.length; i++) {
            if (finished[withRoute.get(i)] == null) {
                activeRoutes.add(i);
            }
        }
        String[] stopTypes = {"START", "PICKUP", "DROPOFF"};
        insert("route_stops", "id,route_id,seq,type,place_id,lat,lng,leg_km", activeRoutes.size() * 3, i -> {
            int s = i % 3;
            return r(UUID.randomUUID(), routeIds[activeRoutes.get(i / 3)], s, stopTypes[s], s == 0 ? null : s == 1 ? pickup : dropoff,
                    -20.0 + s * 0.02, -50.0 + s * 0.02, 2.0 * s);
        });

        List<Object[]> changes = new ArrayList<>();
        for (int d = 0; d < DRIVERS; d++) {
            for (int c = 0; c < 20; c++) {
                changes.add(r(UUID.randomUUID(), "DRIVER", driverIds[d], c == 0 ? null : "AVAILABLE", c % 2 == 0 ? "BUSY" : "AVAILABLE",
                        at(now.minus((long) (20 - c) * 15 * 24, ChronoUnit.HOURS)), "seed", "seed"));
            }
        }
        insert("status_changes", "id,subject_type,subject_id,from_status,to_status,changed_at,changed_by,reason",
                changes.size(), changes::get);
        jdbc.execute("ANALYZE");
    }

    private void measure(String name, MockHttpServletRequestBuilder request, Map<String, String> out) throws Exception {
        mvc.perform(request).andExpect(status().isOk());
        long nanos = 0;
        int statements = 0;
        for (int i = 0; i < 3; i++) {
            STATEMENTS.set(0);
            long start = System.nanoTime();
            mvc.perform(request).andExpect(status().isOk());
            nanos += System.nanoTime() - start;
            statements = Math.max(statements, STATEMENTS.get());
        }
        long avgMs = nanos / 3_000_000;
        out.put(name, avgMs + " ms, " + statements + " statements");
        assertTrue(avgMs < 500, name + " levou " + avgMs + " ms em média");
        assertTrue(statements <= 20, name + " rodou " + statements + " statements");
    }

    @Test
    void eachPanelUnderBudget() throws Exception {
        seed();
        Map<String, String> out = new java.util.LinkedHashMap<>();
        try {
            measure("admin", get("/dashboard/admin?period=1m").header("Authorization", bearer(Role.ADMIN)), out);
            measure("dispatch", get("/dashboard/dispatch?period=1m").header("Authorization", bearer(Role.DISPATCHER)), out);
            measure("fleet", get("/dashboard/fleet?period=1m").header("Authorization", bearer(Role.FLEET_MANAGER)), out);
            measure("customer", get("/customer/dashboard?period=1m").header("Authorization", customerBearer), out);
            measure("driver", get("/driver/dashboard").with(httpBasic(driverUsername, "password-123")), out);
        } finally {
            System.out.println("BUDGET " + out);
        }
    }
}
