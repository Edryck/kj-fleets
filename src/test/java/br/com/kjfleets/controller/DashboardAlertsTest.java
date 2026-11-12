package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.dto.DashboardDtos.Alert;
import br.com.kjfleets.dto.DashboardDtos.AlertType;
import br.com.kjfleets.dto.DashboardDtos.Severity;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DashboardQueries;
import br.com.kjfleets.repository.DashboardQueries.AlertRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardAlertsTest extends IntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DashboardQueries queries;

    @Autowired
    private DashboardProperties props;

    @Autowired
    private RoutingProperties routing;

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    // lista completa (sem o corte de 100) para não depender do que outros testes deixaram no banco
    private List<AlertRow> all() {
        return queries.alertRows(props, routing, Instant.now(), 0.8, EnumSet.allOf(AlertType.class), 100000);
    }

    private AlertRow find(AlertType type, String subjectId) {
        return all().stream().filter(r -> r.type() == type && subjectId.equals(r.subjectId())).findFirst().orElse(null);
    }

    private String driver() throws Exception {
        return fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
    }

    private String order() throws Exception {
        return fixtures.createOrder(bearer(Role.DISPATCHER));
    }

    private void assign(String orderId, String driverId, String status, int minutesAgo) {
        jdbc.update("UPDATE orders SET status = ?, driver_id = (SELECT id FROM drivers WHERE public_id = ?)"
                + " WHERE public_id = ?", status, driverId, orderId);
        jdbc.update("UPDATE tracking_statuses SET created_at = now() - make_interval(mins => ?) WHERE order_id ="
                + " (SELECT id FROM orders WHERE public_id = ?)", minutesAgo, orderId);
    }

    private void track(String orderId, String code, String details) {
        jdbc.update("INSERT INTO tracking_statuses (id, order_id, status, code, details, created_at) "
                + "SELECT gen_random_uuid(), id, status, ?, ?, now() FROM orders WHERE public_id = ?", code, details,
                orderId);
    }

    private void route(String orderId) {
        jdbc.update("INSERT INTO routes (id, order_id, algorithm, mode, total_km, baseline_km, savings_pct, eta_minutes,"
                + " computed_at) SELECT gen_random_uuid(), id, 'NEAREST_NEIGHBOR', 'AUTO', 1, 1, 0, 10, now()"
                + " FROM orders WHERE public_id = ?", orderId);
    }

    private void stop(String orderId, int seq, Double distanceM, int minutesAgo) {
        jdbc.update("INSERT INTO route_stops (id, route_id, seq, type, lat, lng, leg_km, visited_at, distancem)"
                + " SELECT gen_random_uuid(), r.id, ?, 'DROPOFF', 0, 0, 1, now() - make_interval(mins => ?), ?"
                + " FROM routes r JOIN orders o ON o.id = r.order_id WHERE o.public_id = ?",
                seq, minutesAgo, distanceM, orderId);
    }

    private void vehicleMaintenance(String driverId, int daysAgo) {
        jdbc.update("UPDATE vehicles SET status = 'MAINTENANCE' WHERE id = (SELECT vehicle_id FROM drivers WHERE"
                + " public_id = ?)", driverId);
        jdbc.update("INSERT INTO status_changes (id, subject_type, subject_id, to_status, changed_at, changed_by, reason)"
                + " SELECT gen_random_uuid(), 'VEHICLE', vehicle_id, 'MAINTENANCE', ?, 'teste', 'teste' FROM drivers"
                + " WHERE public_id = ?", Timestamp.from(Instant.now().minus(daysAgo, ChronoUnit.DAYS)), driverId);
    }

    private String vehiclePublicId(String driverId) {
        return jdbc.queryForObject("SELECT v.public_id FROM drivers d JOIN vehicles v ON v.id = d.vehicle_id"
                + " WHERE d.public_id = ?", String.class, driverId);
    }

    private JsonNode call(Role role) throws Exception {
        String body = mvc.perform(get("/dashboard/alerts").header("Authorization", bearer(role)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    @Test
    void staleOrderMediumThenHighAboveDouble() throws Exception {
        String d = driver();
        String medium = order();
        String high = order();
        String fresh = order();
        assign(medium, d, "DISPATCHED", props.staleDispatchedMin() + 1);
        assign(high, d, "DISPATCHED", props.staleDispatchedMin() * 2 + 5);
        assign(fresh, d, "DISPATCHED", 0);

        assertEquals(2, find(AlertType.STALE_ORDER, medium).severity());
        assertEquals(3, find(AlertType.STALE_ORDER, high).severity());
        assertEquals(null, find(AlertType.STALE_ORDER, fresh));
    }

    @Test
    void driverNoSignalHighWithActiveOrder() throws Exception {
        String withOrder = driver();
        String idle = driver();
        String recent = driver();
        String stale = "now() - make_interval(secs => " + (routing.positionMaxAgeS() * 3) + ")";
        jdbc.update("UPDATE drivers SET last_seen_at = " + stale + " WHERE public_id IN (?, ?)", withOrder, idle);
        jdbc.update("UPDATE drivers SET last_seen_at = now() WHERE public_id = ?", recent);
        assign(order(), withOrder, "DISPATCHED", 0);

        assertEquals(3, find(AlertType.DRIVER_NO_SIGNAL, withOrder).severity());
        assertEquals(2, find(AlertType.DRIVER_NO_SIGNAL, idle).severity());
        assertEquals(null, find(AlertType.DRIVER_NO_SIGNAL, recent));
    }

    @Test
    void statusInconsistent() throws Exception {
        String busy = driver();
        String ok = driver();
        jdbc.update("UPDATE drivers SET status = 'BUSY' WHERE public_id = ?", busy);
        assign(order(), ok, "DISPATCHED", 0);
        jdbc.update("UPDATE drivers SET status = 'BUSY' WHERE public_id = ?", ok);

        assertEquals(3, find(AlertType.STATUS_INCONSISTENT, busy).severity());
        assertEquals(null, find(AlertType.STATUS_INCONSISTENT, ok));
    }

    @Test
    void maintenanceVehicleOnAvailableDriver() throws Exception {
        String d = driver();
        String other = driver();
        vehicleMaintenance(d, 0);

        assertEquals(2, find(AlertType.VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER, d).severity());
        assertEquals(null, find(AlertType.VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER, other));
    }

    @Test
    void demandOverCapacity() throws Exception {
        long free = jdbc.queryForObject("SELECT count(*) FROM drivers d JOIN vehicles v ON v.id = d.vehicle_id"
                + " WHERE d.active AND d.status = 'AVAILABLE' AND v.active AND v.status = 'AVAILABLE'"
                + " AND d.lat IS NOT NULL AND d.lng IS NOT NULL AND d.last_seen_at >= now() - make_interval(secs => ?)",
                Long.class, routing.positionMaxAgeS());
        long waiting = jdbc.queryForObject("SELECT count(*) FROM orders WHERE status = 'CREATED' AND driver_id IS NULL",
                Long.class);
        for (long i = waiting; i <= free; i++) {
            order();
        }

        AlertRow row = all().stream().filter(r -> r.type() == AlertType.DEMAND_OVER_CAPACITY).findFirst().orElseThrow();
        assertEquals(3, row.severity());
        assertTrue(row.n1() > row.n2());
    }

    @Test
    void suspiciousStop() throws Exception {
        String near = order();
        String far = order();
        String staff = order();
        String old = order();
        for (String id : List.of(near, far, staff, old)) {
            route(id);
        }
        stop(far, 1, routing.arrivalRadiusM() * 0.95, 60);
        stop(near, 1, routing.arrivalRadiusM() * 0.5, 60);
        stop(staff, 1, null, 30);
        stop(old, 1, routing.arrivalRadiusM() * 0.95, 60 * 30);

        assertEquals(1, find(AlertType.SUSPICIOUS_STOP, far).severity());
        assertNotNull(find(AlertType.SUSPICIOUS_STOP, staff));
        assertEquals(null, find(AlertType.SUSPICIOUS_STOP, near));
        assertEquals(null, find(AlertType.SUSPICIOUS_STOP, old));
    }

    @Test
    void routeMissing() throws Exception {
        String d = driver();
        String missing = order();
        String recovered = order();
        String noEvent = order();
        for (String id : List.of(missing, recovered, noEvent)) {
            assign(id, d, "DISPATCHED", 0);
        }
        track(missing, "route_failed", "OSRM_DOWN");
        track(recovered, "route_failed", "OSRM_DOWN");
        route(recovered);

        assertEquals(2, find(AlertType.ROUTE_MISSING, missing).severity());
        assertEquals(null, find(AlertType.ROUTE_MISSING, recovered));
        assertEquals(null, find(AlertType.ROUTE_MISSING, noEvent));
    }

    @Test
    void longMaintenance() throws Exception {
        String longOne = driver();
        String shortOne = driver();
        vehicleMaintenance(longOne, props.maintenanceAlertDays() + 1);
        vehicleMaintenance(shortOne, 1);

        AlertRow row = find(AlertType.LONG_MAINTENANCE, vehiclePublicId(longOne));
        assertEquals(1, row.severity());
        assertEquals(null, find(AlertType.LONG_MAINTENANCE, vehiclePublicId(shortOne)));
    }

    @Test
    void filteredByRole() throws Exception {
        String stale = order();
        assign(stale, driver(), "DISPATCHED", props.staleDispatchedMin() + 5);
        String busy = driver();
        jdbc.update("UPDATE drivers SET status = 'BUSY' WHERE public_id = ?", busy);

        JsonNode dispatcher = call(Role.DISPATCHER);
        for (JsonNode item : dispatcher.get("items")) {
            assertFalse(item.get("type").asString().equals("STATUS_INCONSISTENT"));
        }
        assertFalse(dispatcher.get("counts").has("STATUS_INCONSISTENT"));

        JsonNode admin = call(Role.ADMIN);
        assertTrue(admin.get("counts").get("STALE_ORDER").asLong() >= 1);
        assertEquals(8, admin.get("counts").size());

        JsonNode fleet = call(Role.FLEET_MANAGER);
        for (JsonNode item : fleet.get("items")) {
            assertFalse(item.get("type").asString().equals("STALE_ORDER"));
            assertFalse(item.get("type").asString().equals("DEMAND_OVER_CAPACITY"));
        }
        assertNotNull(admin.get("meta").get("generatedAt"));

        mvc.perform(get("/dashboard/alerts").header("Authorization", bearer(Role.CUSTOMER)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/alerts")).andExpect(status().isUnauthorized());
    }

    @Test
    void sortedBySeverity() throws Exception {
        String d = driver();
        assign(order(), d, "DISPATCHED", props.staleDispatchedMin() * 2 + 5);
        assign(order(), d, "DISPATCHED", props.staleDispatchedMin() + 1);
        jdbc.update("UPDATE drivers SET status = 'BUSY' WHERE public_id = ?", driver());

        List<Alert> items = queries.alertRows(props, routing, Instant.now(), 0.8, EnumSet.allOf(AlertType.class), 100)
                .stream().map(r -> new Alert(r.type(), Severity.values()[r.severity() - 1], null, r.subjectId(), null,
                        null, r.since())).toList();
        for (int i = 1; i < items.size(); i++) {
            Alert a = items.get(i - 1);
            Alert b = items.get(i);
            assertTrue(a.severity().ordinal() > b.severity().ordinal()
                    || (a.severity() == b.severity() && !a.since().isAfter(b.since())));
        }
        JsonNode http = call(Role.FLEET_MANAGER);
        assertTrue(http.get("items").size() <= 100);
    }
}
