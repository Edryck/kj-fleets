package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DriverRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RouteAutoEtaTest extends IntegrationTest {

    private static final String PASSWORD = "password-123";
    private static final double LAT = -24.86;
    private static final double LNG = -54.33;

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private RoutingProperties props;

    private OrderFixtures fixtures;

    private record TestDriver(String id, String username) {
    }

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private TestDriver newDriver() throws Exception {
        String id = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String username = body(mvc.perform(get("/drivers/" + id).header("Authorization", bearer(Role.ADMIN))))
                .get("username").asString();
        return new TestDriver(id, username);
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private Map<String, Object> point(double lngOffset) {
        return Map.of("name", "Auto " + UUID.randomUUID(), "lat", LAT, "lng", LNG + lngOffset);
    }

    private String newOrder() throws Exception {
        Map<String, Object> payload = Map.of("pickup", point(0), "dropoff", point(0.04),
                "waypoints", List.of(point(0.02), point(0.01)));
        return body(mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)).header("Authorization", bearer(Role.DISPATCHER))))
                .get("publicId").asString();
    }

    private void assign(String orderId, TestDriver driver) throws Exception {
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driver.id())))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
    }

    private void dispatch(String orderId) throws Exception {
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
    }

    private void setPosition(TestDriver driver, double lngOffset, Instant seenAt) {
        Driver entity = drivers.findByPublicIdAndActiveTrue(driver.id()).orElseThrow();
        entity.setLat(LAT);
        entity.setLng(LNG + lngOffset);
        entity.setLastSeenAt(seenAt);
        drivers.save(entity);
    }

    private ResultActions route(String orderId) throws Exception {
        return mvc.perform(get("/orders/" + orderId + "/route").header("Authorization", bearer(Role.DISPATCHER)));
    }

    private JsonNode routeBody(String orderId) throws Exception {
        return body(route(orderId).andExpect(status().isOk()));
    }

    private String trackingNumberOf(String orderId) throws Exception {
        return body(mvc.perform(get("/orders/" + orderId).header("Authorization", bearer(Role.ADMIN))))
                .get("trackingNumber").asString();
    }

    private String dispatchedWithRoute(TestDriver driver, double startOffset) throws Exception {
        String orderId = newOrder();
        assign(orderId, driver);
        setPosition(driver, startOffset, Instant.now());
        dispatch(orderId);
        return orderId;
    }

    @Test
    void dispatchComputesRoute() throws Exception {
        TestDriver driver = newDriver();
        String orderId = dispatchedWithRoute(driver, -0.02);

        route(orderId).andExpect(status().isOk()).andExpect(jsonPath("$.stops[0].type").value("START"))
                .andExpect(jsonPath("$.etaMinutes").value(notNullValue()));
    }

    @Test
    void acceptComputesRoute() throws Exception {
        TestDriver driver = newDriver();
        String orderId = newOrder();

        mvc.perform(post("/driver/orders/" + orderId + "/accept").with(httpBasic(driver.username(), PASSWORD)))
                .andExpect(status().isOk());

        route(orderId).andExpect(status().isOk()).andExpect(jsonPath("$.stops[0].type").value("PICKUP"));
    }

    @Test
    void assignDiscardsCreatedRoute() throws Exception {
        TestDriver driver = newDriver();
        String orderId = newOrder();
        mvc.perform(post("/orders/" + orderId + "/route").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
        route(orderId).andExpect(status().isOk());

        assign(orderId, driver);

        route(orderId).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ROUTE_NOT_FOUND"));
    }

    @Test
    void deactivatedDriverDiscardsCreatedRoute() throws Exception {
        TestDriver driver = newDriver();
        String orderId = newOrder();
        assign(orderId, driver);
        mvc.perform(post("/orders/" + orderId + "/route").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/drivers/" + driver.id()).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().is2xxSuccessful());

        route(orderId).andExpect(status().isNotFound());
    }

    @Test
    void etaDropsAfterPingCloser() throws Exception {
        TestDriver driver = newDriver();
        String orderId = dispatchedWithRoute(driver, -0.05);
        int before = routeBody(orderId).get("etaMinutes").asInt();

        mvc.perform(post("/driver/location").with(httpBasic(driver.username(), PASSWORD))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("lat", LAT, "lng", LNG)))).andExpect(status().isNoContent());

        int after = routeBody(orderId).get("etaMinutes").asInt();
        assertTrue(after < before, "eta " + after + " deveria ser menor que " + before);
    }

    @Test
    void staleDriverPositionUsesLegs() throws Exception {
        TestDriver driver = newDriver();
        String orderId = dispatchedWithRoute(driver, -0.05);
        // posição velha e longe: se fosse usada o eta seria outro
        setPosition(driver, 0.5, Instant.now().minusSeconds(600));

        JsonNode route = routeBody(orderId);
        double legs = 0;
        for (JsonNode stop : route.get("stops")) {
            if (!stop.get("type").asString().equals("START") && stop.get("visitedAt").isNull()) {
                legs += stop.get("legKm").asDouble();
            }
        }
        assertEquals(Math.round(legs / props.avgSpeedKmh() * 60), route.get("etaMinutes").asInt());
    }

    @Test
    void etaNullWhenTerminal() throws Exception {
        TestDriver driver = newDriver();
        String orderId = dispatchedWithRoute(driver, -0.02);
        for (String code : List.of("DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED")) {
            mvc.perform(post("/driver/orders/" + orderId + "/activity").with(httpBasic(driver.username(), PASSWORD))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + code + "\"}"))
                    .andExpect(status().isOk());
        }

        route(orderId).andExpect(status().isOk()).andExpect(jsonPath("$.etaMinutes").value(nullValue()));
        mvc.perform(get("/track/" + trackingNumberOf(orderId))).andExpect(status().isOk())
                .andExpect(jsonPath("$.etaMinutes").value(nullValue()));
    }

    @Test
    void trackShowsEta() throws Exception {
        TestDriver driver = newDriver();
        String orderId = dispatchedWithRoute(driver, -0.02);

        mvc.perform(get("/track/" + trackingNumberOf(orderId))).andExpect(status().isOk())
                .andExpect(jsonPath("$.etaMinutes").value(notNullValue()))
                .andExpect(jsonPath("$.timeline[*].code").value(contains("created", "dispatched")))
                .andExpect(jsonPath("$.timeline[*].code").value(not(hasItem("route_failed"))))
                .andExpect(jsonPath("$.timeline[*].code").value(not(hasItem("stop_completed"))));
    }

    @Test
    void driverRouteOwnOnly() throws Exception {
        TestDriver owner = newDriver();
        TestDriver other = newDriver();
        String orderId = dispatchedWithRoute(owner, -0.02);

        mvc.perform(get("/driver/orders/" + orderId + "/route").with(httpBasic(owner.username(), PASSWORD)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.orderId").value(orderId));
        mvc.perform(get("/driver/orders/" + orderId + "/route").with(httpBasic(other.username(), PASSWORD)))
                .andExpect(status().isNotFound());
    }
}
