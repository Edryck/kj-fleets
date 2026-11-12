package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.RouteRepository;
import br.com.kjfleets.routing.Haversine;
import br.com.kjfleets.config.RoutingProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderRouteTest extends IntegrationTest {

    private static final double LAT = -24.86;
    private static final double LNG = -54.33;

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private OrderRepository orders;

    @Autowired
    private RouteRepository routes;

    @Autowired
    private TransactionTemplate tx;

    @Autowired
    private RoutingProperties props;

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private Map<String, Object> point(double lngOffset) {
        return Map.of("name", "Rota " + UUID.randomUUID(), "lat", LAT, "lng", LNG + lngOffset);
    }

    // cadastro 0.03, 0.01, 0.02 é bem pior que 0.01, 0.02, 0.03
    private String orderWith(double... waypointOffsets) throws Exception {
        List<Map<String, Object>> waypoints = new ArrayList<>();
        for (double offset : waypointOffsets) {
            waypoints.add(point(offset));
        }
        Map<String, Object> body = new HashMap<>();
        body.put("pickup", point(0));
        body.put("dropoff", point(0.04));
        body.put("waypoints", waypoints);
        String response = mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)).header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private String scatteredOrder() throws Exception {
        return orderWith(0.03, 0.01, 0.02);
    }

    private void assignDriverAt(String orderId, double lngOffset) throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("driverId", driverId)))
                        .header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
        Driver driver = drivers.findByPublicIdAndActiveTrue(driverId).orElseThrow();
        driver.setLat(LAT);
        driver.setLng(LNG + lngOffset);
        driver.setLastSeenAt(Instant.now());
        drivers.save(driver);
    }

    private void markVisited(String orderId, int... seqs) {
        tx.executeWithoutResult(s -> {
            var stops = routes.findByOrder(orders.findByPublicId(orderId).orElseThrow()).orElseThrow().getStops();
            for (int i = 0; i < seqs.length; i++) {
                stops.get(seqs[i]).setVisitedAt(Instant.parse("2026-11-12T10:0" + i + ":00Z"));
            }
        });
    }

    private ResultActions compute(String orderId, Object body, Role role) throws Exception {
        var request = post("/orders/" + orderId + "/route").header("Authorization", bearer(role));
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return mvc.perform(request);
    }

    private ResultActions fetch(String orderId, Role role) throws Exception {
        return mvc.perform(get("/orders/" + orderId + "/route").header("Authorization", bearer(role)));
    }

    @Test
    void computesWithoutStart() throws Exception {
        String orderId = scatteredOrder();

        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.algorithm").value("HELD_KARP"))
                .andExpect(jsonPath("$.mode").value("HAVERSINE"))
                .andExpect(jsonPath("$.stops[*].type").value(contains("PICKUP", "WAYPOINT", "WAYPOINT", "WAYPOINT",
                        "DROPOFF")))
                .andExpect(jsonPath("$.stops[0].legKm").value(0.0))
                .andExpect(jsonPath("$.savingsPct").value(greaterThan(0.0)))
                .andExpect(jsonPath("$.baselineKm").value(greaterThan(0.0)))
                .andExpect(jsonPath("$.etaMinutes").value(greaterThan(0)));
        fetch(orderId, Role.DISPATCHER).andExpect(status().isOk()).andExpect(jsonPath("$.stops", hasSize(5)));
    }

    @Test
    void computesWithDriverStart() throws Exception {
        String orderId = scatteredOrder();
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("driverId", driverId)))
                        .header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
        Driver driver = drivers.findByPublicIdAndActiveTrue(driverId).orElseThrow();
        driver.setLat(LAT);
        driver.setLng(LNG - 0.02);
        driver.setLastSeenAt(Instant.now());
        drivers.save(driver);

        compute(orderId, null, Role.ADMIN).andExpect(status().isOk())
                .andExpect(jsonPath("$.stops[0].type").value("START"))
                .andExpect(jsonPath("$.stops[0].legKm").value(0.0))
                .andExpect(jsonPath("$.stops[0].placeId").value(nullValue()))
                .andExpect(jsonPath("$.stops[1].type").value("PICKUP"))
                .andExpect(jsonPath("$.stops[1].legKm").value(greaterThan(0.0)))
                .andExpect(jsonPath("$.stops", hasSize(6)));
    }

    @Test
    void chosenAlgorithmIsUsed() throws Exception {
        String orderId = scatteredOrder();

        compute(orderId, Map.of("algorithm", "NEAREST_NEIGHBOR"), Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("NEAREST_NEIGHBOR"));
    }

    @Test
    void heldKarpWithSixteenIs422() throws Exception {
        double[] offsets = new double[16];
        for (int i = 0; i < offsets.length; i++) {
            offsets[i] = 0.001 * (i + 1);
        }
        String orderId = orderWith(offsets);

        compute(orderId, Map.of("algorithm", "HELD_KARP"), Role.DISPATCHER)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROUTE_TOO_LARGE_FOR_EXACT"));
        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("TWO_OPT"));
    }

    @Test
    void terminalOrderIs422() throws Exception {
        String orderId = scatteredOrder();
        mvc.perform(post("/orders/" + orderId + "/cancel").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("reason", "teste")))
                        .header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());

        compute(orderId, null, Role.DISPATCHER).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void recomputeReplaces() throws Exception {
        String orderId = scatteredOrder();

        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk());
        compute(orderId, Map.of("algorithm", "TWO_OPT"), Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("TWO_OPT"))
                .andExpect(jsonPath("$.stops", hasSize(5)));

        fetch(orderId, Role.ADMIN).andExpect(status().isOk()).andExpect(jsonPath("$.algorithm").value("TWO_OPT"))
                .andExpect(jsonPath("$.stops", hasSize(5)));
    }

    @Test
    void recomputeKeepsVisitedPrefix() throws Exception {
        String orderId = scatteredOrder();
        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk());
        // rota ótima: PICKUP, 0.01, 0.02, 0.03, DROPOFF. Conclui a pickup e o waypoint 0.03 (seq 3), nessa ordem
        Instant pickupAt = Instant.parse("2026-11-12T10:00:00Z");
        Instant waypointAt = Instant.parse("2026-11-12T10:05:00Z");
        tx.executeWithoutResult(s -> {
            Order order = orders.findByPublicId(orderId).orElseThrow();
            var stops = routes.findByOrder(order).orElseThrow().getStops();
            stops.get(0).setVisitedAt(pickupAt);
            stops.get(0).setDistanceM(12.0);
            stops.get(0).setCompletedBy("drv");
            stops.get(3).setVisitedAt(waypointAt);
            stops.get(3).setDistanceM(34.0);
            stops.get(3).setCompletedBy("drv");
        });
        String visitedPlace = json.readTree(fetch(orderId, Role.ADMIN).andReturn().getResponse()
                .getContentAsString()).get("stops").get(3).get("placeId").asString();

        // sem posição do motorista não entra START: o primeiro pendente sai da última concluída
        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.stops", hasSize(5)))
                .andExpect(jsonPath("$.stops[0].type").value("PICKUP"))
                .andExpect(jsonPath("$.stops[0].visitedAt").value("2026-11-12T10:00:00Z"))
                .andExpect(jsonPath("$.stops[0].distanceM").value(12.0))
                .andExpect(jsonPath("$.stops[1].type").value("WAYPOINT"))
                .andExpect(jsonPath("$.stops[1].placeId").value(visitedPlace))
                .andExpect(jsonPath("$.stops[1].visitedAt").value("2026-11-12T10:05:00Z"))
                .andExpect(jsonPath("$.stops[1].distanceM").value(34.0))
                .andExpect(jsonPath("$.stops[2].type").value("WAYPOINT"))
                .andExpect(jsonPath("$.stops[2].visitedAt").value(nullValue()))
                .andExpect(jsonPath("$.stops[3].visitedAt").value(nullValue()))
                .andExpect(jsonPath("$.stops[4].type").value("DROPOFF"));
        tx.executeWithoutResult(s -> {
            Order order = orders.findByPublicId(orderId).orElseThrow();
            var stops = routes.findByOrder(order).orElseThrow().getStops();
            assertEquals("drv", stops.get(1).getCompletedBy());
        });
    }

    @Test
    void recomputeWithoutPositionContinuesFromLastVisited() throws Exception {
        String orderId = scatteredOrder();
        double firstTotal = json.readTree(compute(orderId, null, Role.DISPATCHER).andReturn().getResponse()
                .getContentAsString()).get("totalKm").asDouble();
        tx.executeWithoutResult(s -> {
            Order order = orders.findByPublicId(orderId).orElseThrow();
            var stops = routes.findByOrder(order).orElseThrow().getStops();
            stops.get(0).setVisitedAt(Instant.parse("2026-11-12T10:00:00Z"));
            stops.get(1).setVisitedAt(Instant.parse("2026-11-12T10:05:00Z"));
        });

        String body = compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.stops", hasSize(5)))
                .andExpect(jsonPath("$.stops[*].type").value(contains("PICKUP", "WAYPOINT", "WAYPOINT", "WAYPOINT",
                        "DROPOFF")))
                .andReturn().getResponse().getContentAsString();
        var stops = json.readTree(body).get("stops");
        double expected = Haversine.km(stops.get(1).get("lat").asDouble(), stops.get(1).get("lng").asDouble(),
                stops.get(2).get("lat").asDouble(), stops.get(2).get("lng").asDouble()) * props.detourFactor();
        assertEquals(expected, stops.get(2).get("legKm").asDouble(), 0.01);
        assertEquals(firstTotal, json.readTree(body).get("totalKm").asDouble(), 1e-6);
    }

    @Test
    void recomputeWithVisitedAndDriverPosition() throws Exception {
        String orderId = scatteredOrder();
        assignDriverAt(orderId, -0.02);
        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.stops[0].type").value("START"));
        markVisited(orderId, 1, 2);

        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.stops", hasSize(6)))
                .andExpect(jsonPath("$.stops[0].type").value("PICKUP"))
                .andExpect(jsonPath("$.stops[0].legKm").value(greaterThan(0.0)))
                .andExpect(jsonPath("$.stops[1].type").value("WAYPOINT"))
                .andExpect(jsonPath("$.stops[1].visitedAt").isNotEmpty())
                .andExpect(jsonPath("$.stops[2].type").value("START"))
                .andExpect(jsonPath("$.stops[2].legKm").value(greaterThan(0.0)))
                .andExpect(jsonPath("$.stops[2].visitedAt").value(nullValue()))
                .andExpect(jsonPath("$.stops[3].type").value("WAYPOINT"))
                .andExpect(jsonPath("$.stops[5].type").value("DROPOFF"));
    }

    @Test
    void duplicatePlaceWaypointsSurviveRecompute() throws Exception {
        String shared = json.readTree(mvc.perform(post("/places").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(point(0.01))).header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString())
                .get("publicId").asString();
        Map<String, Object> body = Map.of("pickup", point(0), "dropoff", point(0.04),
                "waypoints", List.of(Map.of("placeId", shared), point(0.02), Map.of("placeId", shared)));
        String orderId = json.readTree(mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)).header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString())
                .get("publicId").asString();
        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk());
        markVisited(orderId, 0, 1);

        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.stops", hasSize(5)))
                .andExpect(jsonPath("$.stops[?(@.placeId == '" + shared + "')]", hasSize(2)));
    }

    @Test
    void routeWithoutWaypoints() throws Exception {
        String orderId = orderWith();

        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.stops[*].type").value(contains("PICKUP", "DROPOFF")))
                .andExpect(jsonPath("$.savingsPct").value(0.0))
                .andExpect(jsonPath("$.totalKm").value(greaterThan(0.0)));
    }

    @Test
    void getWithoutRouteIs404() throws Exception {
        String orderId = scatteredOrder();

        fetch(orderId, Role.ADMIN).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROUTE_NOT_FOUND"));
        fetch("order_inexistente", Role.ADMIN).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void rolesOnRoute() throws Exception {
        String orderId = scatteredOrder();

        compute(orderId, null, Role.FLEET_MANAGER).andExpect(status().isForbidden());
        compute(orderId, null, Role.DISPATCHER).andExpect(status().isOk());
        fetch(orderId, Role.FLEET_MANAGER).andExpect(status().isOk());
        fetch(orderId, Role.CUSTOMER).andExpect(status().isForbidden());
    }
}
