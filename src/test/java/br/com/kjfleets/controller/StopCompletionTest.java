package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.RouteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StopCompletionTest extends IntegrationTest {

    private static final String PASSWORD = "password-123";
    private static final double LAT = -24.86;
    private static final double LNG = -54.33;
    // ~1 km ao leste do waypoint (0.01 grau de longitude nessa latitude)
    private static final double FAR_OFFSET = 0.01;

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private OrderRepository orders;

    @Autowired
    private RouteRepository routes;

    @Autowired
    private PlatformTransactionManager txManager;

    private OrderFixtures fixtures;

    private record TestDriver(String id, String username) {
    }

    private record Scenario(TestDriver driver, String orderId) {
    }

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private TestDriver newDriver() throws Exception {
        String id = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String username = body(mvc.perform(get("/drivers/" + id).header("Authorization", bearer(Role.ADMIN))))
                .get("username").asString();
        return new TestDriver(id, username);
    }

    private Map<String, Object> point(double lngOffset) {
        return Map.of("name", "Stop " + UUID.randomUUID(), "lat", LAT, "lng", LNG + lngOffset);
    }

    private void setPosition(TestDriver driver, double lngOffset, Instant seenAt) {
        Driver entity = drivers.findByPublicIdAndActiveTrue(driver.id()).orElseThrow();
        entity.setLat(LAT);
        entity.setLng(LNG + lngOffset);
        entity.setLastSeenAt(seenAt);
        drivers.save(entity);
    }

    private void ping(TestDriver driver, double lngOffset) throws Exception {
        mvc.perform(post("/driver/location").with(httpBasic(driver.username(), PASSWORD))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("lat", LAT, "lng", LNG + lngOffset))))
                .andExpect(status().isNoContent());
    }

    // pickup em 0, waypoint em 0.02, dropoff em 0.04 (longitude); motorista despachado, sem posição
    private Scenario dispatched() throws Exception {
        TestDriver driver = newDriver();
        Map<String, Object> payload = Map.of("pickup", point(0), "dropoff", point(0.04),
                "waypoints", List.of(point(0.02)));
        String orderId = body(mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)).header("Authorization", bearer(Role.DISPATCHER))))
                .get("publicId").asString();
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driver.id())))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
        return new Scenario(driver, orderId);
    }

    private JsonNode route(String orderId) throws Exception {
        return body(mvc.perform(get("/orders/" + orderId + "/route").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk()));
    }

    private JsonNode stop(String orderId, String type) throws Exception {
        for (JsonNode stop : route(orderId).get("stops")) {
            if (stop.get("type").asString().equals(type)) {
                return stop;
            }
        }
        throw new AssertionError("sem parada " + type);
    }

    private ResultActions driverComplete(Scenario s, int seq, Object payload) throws Exception {
        return mvc.perform(post("/driver/orders/" + s.orderId() + "/stops/" + seq + "/complete")
                .with(httpBasic(s.driver().username(), PASSWORD)).contentType(MediaType.APPLICATION_JSON)
                .content(payload == null ? "" : json.writeValueAsString(payload)));
    }

    private ResultActions staffComplete(Scenario s, int seq, Role role) throws Exception {
        return mvc.perform(post("/orders/" + s.orderId() + "/stops/" + seq + "/complete")
                .header("Authorization", bearer(role)));
    }

    private ResultActions driverActivity(Scenario s, String code, Object extra) throws Exception {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("code", code);
        if (extra != null) {
            payload.putAll((Map<String, Object>) extra);
        }
        return mvc.perform(post("/driver/orders/" + s.orderId() + "/activity")
                .with(httpBasic(s.driver().username(), PASSWORD)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)));
    }

    private int seqOf(String orderId, String type) throws Exception {
        return stop(orderId, type).get("seq").asInt();
    }

    private JsonNode tracking(String orderId) throws Exception {
        return body(mvc.perform(get("/orders/" + orderId + "/tracking").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk()));
    }

    private void toInProgress(Scenario s) throws Exception {
        for (String code : List.of("DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS")) {
            driverActivity(s, code, null).andExpect(status().isOk());
        }
    }

    @Test
    void driverNearCompletesWaypoint() throws Exception {
        Scenario s = dispatched();
        ping(s.driver(), 0.02);
        int seq = seqOf(s.orderId(), "WAYPOINT");

        driverComplete(s, seq, null).andExpect(status().isOk());

        JsonNode waypoint = stop(s.orderId(), "WAYPOINT");
        assertTrue(!waypoint.get("visitedAt").isNull());
        assertTrue(waypoint.get("distanceM").asDouble() < 200);
        boolean tracked = false;
        for (JsonNode event : tracking(s.orderId())) {
            tracked |= event.get("code").asString().equals("stop_completed")
                    && event.get("details").asString().equals("WAYPOINT #" + seq);
        }
        assertTrue(tracked);
    }

    @Test
    void driverFarIs422() throws Exception {
        Scenario s = dispatched();
        ping(s.driver(), 0.02 + FAR_OFFSET);

        driverComplete(s, seqOf(s.orderId(), "WAYPOINT"), null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("STOP_TOO_FAR"))
                .andExpect(jsonPath("$.message").value(containsString(" m")));
        assertTrue(stop(s.orderId(), "WAYPOINT").get("visitedAt").isNull());
    }

    @Test
    void driverWithoutPositionIs422() throws Exception {
        Scenario s = dispatched();

        driverComplete(s, seqOf(s.orderId(), "WAYPOINT"), null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("STOP_TOO_FAR"));
    }

    @Test
    void stalePositionIs422() throws Exception {
        Scenario s = dispatched();
        setPosition(s.driver(), 0.02, Instant.now().minusSeconds(301));

        driverComplete(s, seqOf(s.orderId(), "WAYPOINT"), null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("STOP_TOO_FAR"));
    }

    @Test
    void positionAtExactMaxAgeIsValid() throws Exception {
        Scenario s = dispatched();
        // 299 s e não 300: o relógio avança entre o setup e a chamada
        setPosition(s.driver(), 0.02, Instant.now().minusSeconds(299));

        driverComplete(s, seqOf(s.orderId(), "WAYPOINT"), null).andExpect(status().isOk());
    }

    @Test
    void bodyPositionWinsOverStored() throws Exception {
        Scenario s = dispatched();
        ping(s.driver(), 0.02);

        driverComplete(s, seqOf(s.orderId(), "WAYPOINT"), Map.of("lat", LAT, "lng", LNG + 0.02 + FAR_OFFSET))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("STOP_TOO_FAR"));
    }

    @Test
    void bodyPositionNearUpdatesDriver() throws Exception {
        Scenario s = dispatched();

        driverComplete(s, seqOf(s.orderId(), "WAYPOINT"), Map.of("lat", LAT, "lng", LNG + 0.02))
                .andExpect(status().isOk());

        Driver driver = drivers.findByPublicIdAndActiveTrue(s.driver().id()).orElseThrow();
        assertEquals(LNG + 0.02, driver.getLng());
        assertTrue(driver.getLastSeenAt() != null);
    }

    @Test
    void staffFarCompletes() throws Exception {
        Scenario s = dispatched();
        ping(s.driver(), 0.02 + FAR_OFFSET);
        int seq = seqOf(s.orderId(), "WAYPOINT");

        staffComplete(s, seq, Role.DISPATCHER).andExpect(status().isOk());

        assertTrue(!stop(s.orderId(), "WAYPOINT").get("visitedAt").isNull());
        boolean tracked = false;
        for (JsonNode event : tracking(s.orderId())) {
            tracked |= event.get("code").asString().equals("stop_completed")
                    && event.get("details").asString().contains("por");
        }
        assertTrue(tracked);
    }

    @Test
    void fleetManagerIs403() throws Exception {
        Scenario s = dispatched();

        staffComplete(s, 0, Role.FLEET_MANAGER).andExpect(status().isForbidden());
    }

    @Test
    void idempotent() throws Exception {
        Scenario s = dispatched();
        ping(s.driver(), 0.02);
        int seq = seqOf(s.orderId(), "WAYPOINT");
        driverComplete(s, seq, null).andExpect(status().isOk());
        String first = stop(s.orderId(), "WAYPOINT").get("visitedAt").asString();

        driverComplete(s, seq, null).andExpect(status().isOk());

        assertEquals(first, stop(s.orderId(), "WAYPOINT").get("visitedAt").asString());
    }

    @Test
    void pickupOrDropoffViaEndpointIs422() throws Exception {
        Scenario s = dispatched();
        ping(s.driver(), 0);

        staffComplete(s, seqOf(s.orderId(), "PICKUP"), Role.DISPATCHER).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
        staffComplete(s, seqOf(s.orderId(), "DROPOFF"), Role.DISPATCHER).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void unknownSeqAndNoRoute() throws Exception {
        Scenario s = dispatched();
        staffComplete(s, 99, Role.DISPATCHER).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        deleteRoute(s.orderId());

        staffComplete(s, 0, Role.DISPATCHER).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROUTE_NOT_FOUND"));
    }

    @Test
    void arrivedMarksPickup() throws Exception {
        Scenario s = dispatched();
        assertTrue(stop(s.orderId(), "PICKUP").get("visitedAt").isNull());

        driverActivity(s, "DRIVER_ENROUTE", null).andExpect(status().isOk());
        driverActivity(s, "ARRIVED", null).andExpect(status().isOk());

        assertTrue(!stop(s.orderId(), "PICKUP").get("visitedAt").isNull());
    }

    @Test
    void driverCompletedFarFromDropoffIs422() throws Exception {
        Scenario s = dispatched();
        toInProgress(s);
        ping(s.driver(), 0.04 + FAR_OFFSET);

        driverActivity(s, "COMPLETED", null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("STOP_TOO_FAR"));
        mvc.perform(get("/orders/" + s.orderId()).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        ping(s.driver(), 0.04);
        driverActivity(s, "COMPLETED", null).andExpect(status().isOk());
        assertTrue(!stop(s.orderId(), "DROPOFF").get("visitedAt").isNull());
    }

    @Test
    void completedWithoutRouteStillChecksDropoff() throws Exception {
        Scenario s = dispatched();
        toInProgress(s);
        deleteRoute(s.orderId());
        ping(s.driver(), 0.04 + FAR_OFFSET);

        driverActivity(s, "COMPLETED", null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("STOP_TOO_FAR"));
        driverActivity(s, "COMPLETED", Map.of("lat", LAT, "lng", LNG + 0.04)).andExpect(status().isOk());
    }

    @Test
    void otherDriversOrderIs404() throws Exception {
        Scenario s = dispatched();
        TestDriver other = newDriver();

        mvc.perform(post("/driver/orders/" + s.orderId() + "/stops/0/complete")
                .with(httpBasic(other.username(), PASSWORD))).andExpect(status().isNotFound());
    }

    private void deleteRoute(String orderId) {
        new TransactionTemplate(txManager).executeWithoutResult(tx ->
                routes.findByOrder(orders.findByPublicId(orderId).orElseThrow()).ifPresent(routes::delete));
    }
}
