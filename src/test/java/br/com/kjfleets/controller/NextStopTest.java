package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NextStopTest extends IntegrationTest {

    private static final String PASSWORD = "password-123";
    private static final double LAT = -24.86;
    private static final double LNG = -54.33;

    @Autowired
    private JdbcTemplate jdbc;

    private OrderFixtures fixtures;
    private String driverId;
    private String username;
    private String orderId;

    @BeforeEach
    void setUp() throws Exception {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
        driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        username = read(mvc.perform(get("/drivers/" + driverId).header("Authorization", bearer(Role.ADMIN)))
                .andReturn().getResponse().getContentAsString()).get("username").asString();
        // pickup em 0, waypoint em 0.02, dropoff em 0.04 (longitude)
        Map<String, Object> payload = Map.of("pickup", point(0), "dropoff", point(0.04),
                "waypoints", List.of(point(0.02)));
        orderId = read(mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)).header("Authorization", bearer(Role.DISPATCHER)))
                .andReturn().getResponse().getContentAsString()).get("publicId").asString();
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driverId)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
    }

    private JsonNode read(String body) {
        return json.readTree(body);
    }

    private Map<String, Object> point(double lngOffset) {
        return Map.of("name", "Stop " + UUID.randomUUID(), "lat", LAT, "lng", LNG + lngOffset);
    }

    private void setPosition(double lngOffset, int ageS) {
        jdbc.update("UPDATE drivers SET lat = ?, lng = ?, last_seen_at = now() - make_interval(secs => ?) "
                + "WHERE public_id = ?", LAT, LNG + lngOffset, ageS, driverId);
    }

    private void pickupDone() {
        jdbc.update("UPDATE route_stops SET visited_at = now() WHERE type = 'PICKUP' AND route_id = "
                + "(SELECT r.id FROM routes r JOIN orders o ON o.id = r.order_id WHERE o.public_id = ?)", orderId);
    }

    private JsonNode nextStop() throws Exception {
        String body = mvc.perform(get("/driver/orders/" + orderId + "/route").with(httpBasic(username, PASSWORD)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return read(body).get("nextStop");
    }

    @Test
    void nearStopIsWithinRadius() throws Exception {
        setPosition(0, 0);

        JsonNode next = nextStop();
        assertEquals("PICKUP", next.get("type").asString());
        assertTrue(next.get("withinRadius").asBoolean());
        assertTrue(next.get("distanceM").asDouble() < next.get("radiusM").asDouble());
        assertTrue(next.get("positionValid").asBoolean());
    }

    @Test
    void farStopNotWithinRadius() throws Exception {
        pickupDone();
        setPosition(0.02 + 0.01, 0);

        JsonNode next = nextStop();
        assertEquals("WAYPOINT", next.get("type").asString());
        assertFalse(next.get("withinRadius").asBoolean());
        assertTrue(next.get("distanceM").asDouble() > next.get("radiusM").asDouble());
    }

    @Test
    void stalePositionInvalid() throws Exception {
        setPosition(0, 600);

        JsonNode next = nextStop();
        assertFalse(next.get("positionValid").asBoolean());
        assertTrue(next.get("distanceM").isNull());
        assertTrue(next.get("withinRadius").isNull());
        assertTrue(next.get("positionAgeS").asLong() >= 600);
    }

    @Test
    void noRouteUsesDropoff() throws Exception {
        jdbc.update("DELETE FROM route_stops WHERE route_id = (SELECT r.id FROM routes r JOIN orders o "
                + "ON o.id = r.order_id WHERE o.public_id = ?)", orderId);
        jdbc.update("DELETE FROM routes WHERE order_id = (SELECT id FROM orders WHERE public_id = ?)", orderId);

        String body = mvc.perform(get("/driver/dashboard").with(httpBasic(username, PASSWORD)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode next = read(body).get("activeOrder").get("nextStop");
        assertEquals(0, next.get("seq").asInt());
        assertEquals("DROPOFF", next.get("type").asString());
    }

    @Test
    void withinRadiusImpliesCompletionSucceeds() throws Exception {
        pickupDone();
        setPosition(0.02, 0);

        JsonNode next = nextStop();
        assertEquals("WAYPOINT", next.get("type").asString());
        assertTrue(next.get("withinRadius").asBoolean());

        mvc.perform(post("/driver/orders/" + orderId + "/stops/" + next.get("seq").asInt() + "/complete")
                .with(httpBasic(username, PASSWORD))).andExpect(status().isOk());
    }

    @Test
    void staffRouteHasNoNextStop() throws Exception {
        String body = mvc.perform(get("/orders/" + orderId + "/route").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(read(body).get("nextStop").isNull());
    }
}
