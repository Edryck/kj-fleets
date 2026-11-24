package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardDispatchFleetTest extends IntegrationTest {

    // pedido "velho" de propósito: fica no topo das listas ordenadas por tempo, mesmo com o banco cheio
    private static final int OLD = 10000;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManagerFactory emf;

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private JsonNode call(String path, Role role, String... params) throws Exception {
        var request = get(path).header("Authorization", bearer(role));
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        String body = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private JsonNode queue(Role role) throws Exception {
        return call("/dashboard/dispatch/queue", role);
    }

    private static List<String> fields(JsonNode list, String name) {
        List<String> values = new ArrayList<>();
        list.forEach(item -> values.add(item.get(name).asString()));
        return values;
    }

    private static JsonNode find(JsonNode list, String name, String value) {
        for (JsonNode item : list) {
            if (item.get(name).asString().equals(value)) {
                return item;
            }
        }
        return null;
    }

    private String createOrderMinutesAgo(int minutes) throws Exception {
        String id = fixtures.createOrder(bearer(Role.DISPATCHER));
        jdbc.update("UPDATE orders SET created_at = now() - make_interval(mins => ?) WHERE public_id = ?",
                minutes, id);
        jdbc.update("UPDATE tracking_statuses SET created_at = now() - make_interval(mins => ?) "
                + "WHERE order_id = (SELECT id FROM orders WHERE public_id = ?)", minutes, id);
        return id;
    }

    // motorista com veículo disponível e posição vista "minutesAgo" minutos atrás
    private String driverSeenMinutesAgo(int minutesAgo) throws Exception {
        String id = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        jdbc.update("UPDATE drivers SET lat = -24.86, lng = -54.33, last_seen_at = now() - make_interval(mins => ?) "
                + "WHERE public_id = ?", minutesAgo, id);
        return id;
    }

    private void assign(String orderId, String driverId) throws Exception {
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driverId)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
    }

    private String createFleet(String... driverIds) throws Exception {
        String body = json.writeValueAsString(Map.of("name", "Frota " + UUID.randomUUID(),
                "driverIds", List.of(driverIds)));
        String response = mvc.perform(post("/fleets").contentType(MediaType.APPLICATION_JSON).content(body)
                .header("Authorization", bearer(Role.FLEET_MANAGER))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    @Test
    void queueSplitsUnassignedAndAssigned() throws Exception {
        String driver = driverSeenMinutesAgo(0);
        String unassigned = createOrderMinutesAgo(OLD);
        String assigned = createOrderMinutesAgo(OLD);
        jdbc.update("UPDATE orders SET driver_id = (SELECT id FROM drivers WHERE public_id = ?) WHERE public_id = ?",
                driver, assigned);

        JsonNode q = queue(Role.DISPATCHER);
        JsonNode waiting = q.get("unassigned").get("items");
        JsonNode pending = q.get("assignedNotDispatched").get("items");
        assertTrue(fields(waiting, "orderId").contains(unassigned));
        assertFalse(fields(waiting, "orderId").contains(assigned));
        assertTrue(fields(pending, "orderId").contains(assigned));
        assertFalse(fields(pending, "orderId").contains(unassigned));

        JsonNode item = find(waiting, "orderId", unassigned);
        assertTrue(item.get("minutesInStage").asLong() >= OLD - 1);
        assertTrue(item.get("pickupName").asString().startsWith("Ponto"));
        assertTrue(item.get("trackingNumber").asString().startsWith("KJ"));
    }

    @Test
    void queueOldestFirstAndCapped() throws Exception {
        long before = queue(Role.DISPATCHER).get("unassigned").get("total").asLong();
        for (int i = 0; i < 55; i++) {
            createOrderMinutesAgo(9000);
        }

        JsonNode unassigned = queue(Role.DISPATCHER).get("unassigned");
        assertEquals(before + 55, unassigned.get("total").asLong());
        assertEquals(50, unassigned.get("items").size());
        long previous = Long.MAX_VALUE;
        for (JsonNode item : unassigned.get("items")) {
            long minutes = item.get("minutesInStage").asLong();
            assertTrue(minutes <= previous, "fora de ordem: " + minutes + " depois de " + previous);
            previous = minutes;
        }
    }

    @Test
    void inProgressHasEtaAndStops() throws Exception {
        String driver = driverSeenMinutesAgo(0);
        String orderId = createOrderMinutesAgo(OLD);
        assign(orderId, driver);
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
        jdbc.update("UPDATE route_stops SET visited_at = now() WHERE type = 'PICKUP' AND route_id = "
                + "(SELECT r.id FROM routes r JOIN orders o ON o.id = r.order_id WHERE o.public_id = ?)", orderId);

        JsonNode items = queue(Role.ADMIN).get("inProgress").get("items");
        JsonNode item = find(items, "orderId", orderId);
        assertTrue(item != null, "pedido em andamento deveria aparecer");
        assertEquals("DISPATCHED", item.get("status").asString());
        assertEquals(driver, item.get("driverId").asString());
        assertFalse(item.get("driverName").isNull());
        assertFalse(item.get("etaMinutes").isNull());
        assertEquals(1, item.get("stopsDone").asInt());
        assertEquals(2, item.get("stopsTotal").asInt());
    }

    @Test
    void fleetCountsAndWaitingVsAvailable() throws Exception {
        String fresh = driverSeenMinutesAgo(0);
        String stale = driverSeenMinutesAgo(120);
        String outside = driverSeenMinutesAgo(0);
        String fleet = createFleet(fresh, stale);
        long waitingBefore = call("/dashboard/fleet/status", Role.ADMIN).get("waitingOrders").asLong();
        createOrderMinutesAgo(1);
        assign(createOrderMinutesAgo(1), fresh);

        JsonNode status = call("/dashboard/fleet/status", Role.ADMIN, "fleetId", fleet);
        assertEquals(waitingBefore + 1, call("/dashboard/fleet/status", Role.ADMIN).get("waitingOrders").asLong());
        assertEquals(2, status.get("driversByStatus").get("AVAILABLE").asLong());
        assertEquals(1, status.get("availableDrivers").asLong());
        assertEquals(List.of(fresh), fields(status.get("availableDriversList"), "driverId"));

        assertEquals(List.of(fresh, stale).stream().sorted().toList(),
                fields(status.get("drivers"), "driverId").stream().sorted().toList());
        assertFalse(fields(status.get("drivers"), "driverId").contains(outside));
        JsonNode freshRow = find(status.get("drivers"), "driverId", fresh);
        assertFalse(freshRow.get("pingStale").asBoolean());
        assertEquals(1, freshRow.get("queueSize").asLong());
        assertTrue(find(status.get("drivers"), "driverId", stale).get("pingStale").asBoolean());
    }

    @Test
    void fleetFilterScopesDriversAndVehicles() throws Exception {
        String driverA = driverSeenMinutesAgo(0);
        String driverB = driverSeenMinutesAgo(0);
        String fleetA = createFleet(driverA);
        createFleet(driverB);

        JsonNode a = call("/dashboard/fleet/status", Role.ADMIN, "fleetId", fleetA);
        assertEquals(List.of(driverA), fields(a.get("drivers"), "driverId"));
        assertEquals(List.of(driverA), fields(a.get("availableDriversList"), "driverId"));
        assertEquals(1, a.get("availableDrivers").asLong());
        JsonNode drivers = a.get("driversByStatus");
        assertEquals(1, drivers.get("AVAILABLE").asLong() + drivers.get("BUSY").asLong() + drivers.get("OFFLINE").asLong());
        JsonNode vehicles = a.get("vehiclesByStatus");
        assertEquals(1, vehicles.get("AVAILABLE").asLong() + vehicles.get("IN_USE").asLong()
                + vehicles.get("MAINTENANCE").asLong());
    }

    private void inProgressOrder() throws Exception {
        String orderId = createOrderMinutesAgo(OLD);
        assign(orderId, driverSeenMinutesAgo(0));
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
    }

    @Autowired
    @Qualifier("realtimeExecutor")
    private ThreadPoolTaskExecutor realtimeExecutor;

    // o contador do Hibernate é global: espera os eventos @Async dos pedidos recém-criados, senão as
    // consultas deles entram na conta do painel
    private void awaitRealtimeIdle() throws InterruptedException {
        long deadline = System.currentTimeMillis() + 10_000;
        while ((realtimeExecutor.getActiveCount() > 0
                || !realtimeExecutor.getThreadPoolExecutor().getQueue().isEmpty())
                && System.currentTimeMillis() < deadline) {
            Thread.sleep(20);
        }
    }

    private long statementsForQueue(Statistics stats) throws Exception {
        awaitRealtimeIdle();
        long before = stats.getPrepareStatementCount();
        call("/dashboard/dispatch/queue", Role.ADMIN);
        return stats.getPrepareStatementCount() - before;
    }

    // contagem só de JPA (Hibernate Statistics); as consultas JDBC do painel são fixas por natureza
    @Test
    void inProgressQueryCountIsConstant() throws Exception {
        Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        for (int i = 0; i < 3; i++) {
            inProgressOrder();
        }
        long few = statementsForQueue(stats);
        for (int i = 0; i < 9; i++) {
            inProgressOrder();
        }
        long many = statementsForQueue(stats);
        assertEquals(few, many, "consultas cresceram com os pedidos em andamento");
        assertTrue(many <= 12, "consultas JPA do painel: " + many);
    }

    @Test
    void dispatcherGetsNoFullDriverList() throws Exception {
        String fleet = createFleet(driverSeenMinutesAgo(0));

        JsonNode dispatcher = call("/dashboard/fleet/status", Role.DISPATCHER, "fleetId", fleet);
        assertTrue(dispatcher.get("drivers").isNull());
        assertEquals(1, dispatcher.get("availableDriversList").size());
        assertEquals(1, dispatcher.get("availableDrivers").asLong());

        JsonNode admin = call("/dashboard/fleet/status", Role.ADMIN, "fleetId", fleet);
        assertEquals(1, admin.get("drivers").size());
    }

    @Test
    void fleetFilterAndUnknownFleet404() throws Exception {
        mvc.perform(get("/dashboard/fleet/status").param("fleetId", "fleet_zzzzzz")
                        .header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void queueForbiddenForFleetManager() throws Exception {
        mvc.perform(get("/dashboard/dispatch/queue").header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/dispatch/queue").header("Authorization", bearer(Role.CUSTOMER)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/fleet/status").header("Authorization", bearer(Role.CUSTOMER)))
                .andExpect(status().isForbidden());
    }
}
