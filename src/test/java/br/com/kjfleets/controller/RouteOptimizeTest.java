package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.RouteRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RouteOptimizeTest extends IntegrationTest {

    private static final double LAT = -24.86;
    private static final double LNG = -54.33;

    @Autowired
    private RouteRepository routes;

    private Map<String, Object> point(double lngOffset) {
        return Map.of("lat", LAT, "lng", LNG + lngOffset);
    }

    private List<Map<String, Object>> waypoints(double... offsets) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (double offset : offsets) {
            list.add(point(offset));
        }
        return list;
    }

    // pickup em 0 e dropoff em 0.04: cadastro 0.03, 0.01, 0.02 é bem pior que 0.01, 0.02, 0.03
    private Map<String, Object> request(List<Map<String, Object>> waypoints) {
        Map<String, Object> body = new HashMap<>();
        body.put("pickup", point(0));
        body.put("dropoff", point(0.04));
        body.put("waypoints", waypoints);
        return body;
    }

    private ResultActions optimize(Map<String, Object> body, Role role) throws Exception {
        return mvc.perform(post("/routes/optimize").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).header("Authorization", bearer(role)));
    }

    private JsonNode optimizeOk(Map<String, Object> body) throws Exception {
        String response = optimize(body, Role.DISPATCHER).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response);
    }

    @Test
    void optimizesWithoutPersisting() throws Exception {
        double[] offsets = {0.03, 0.01, 0.02};
        Map<String, Object> body = request(waypoints(offsets));
        body.put("start", point(-0.02));
        long before = routes.count();

        JsonNode response = optimizeOk(body);

        assertEquals(before, routes.count());
        JsonNode stops = response.get("stops");
        assertEquals(6, stops.size());
        assertEquals("START", stops.get(0).get("type").asString());
        assertEquals("PICKUP", stops.get(1).get("type").asString());
        assertEquals("DROPOFF", stops.get(5).get("type").asString());
        assertTrue(stops.get(0).get("waypointIndex").isNull());
        assertTrue(stops.get(1).get("waypointIndex").isNull());
        assertTrue(stops.get(5).get("waypointIndex").isNull());
        for (int seq = 2; seq <= 4; seq++) {
            JsonNode stop = stops.get(seq);
            assertEquals("WAYPOINT", stop.get("type").asString());
            int index = stop.get("waypointIndex").asInt();
            assertEquals(LNG + offsets[index], stop.get("lng").asDouble(), 1e-9);
        }
        assertTrue(response.get("savingsPct").asDouble() > 0);
    }

    @Test
    void compareReturnsAllFour() throws Exception {
        Map<String, Object> body = request(waypoints(0.03, 0.01, 0.05, 0.02, 0.025));
        body.put("compare", true);

        JsonNode comparison = optimizeOk(body).get("comparison");

        assertEquals(4, comparison.size());
        double heldKarp = comparison.get("HELD_KARP").get("totalKm").asDouble();
        for (String name : List.of("NEAREST_NEIGHBOR", "TWO_OPT", "SIMULATED_ANNEALING")) {
            assertTrue(heldKarp <= comparison.get(name).get("totalKm").asDouble() + 1e-9);
            assertTrue(comparison.get(name).get("ms").asLong() >= 0);
        }
    }

    @Test
    void compareSkipsHeldKarpAboveFifteen() throws Exception {
        double[] offsets = new double[20];
        for (int i = 0; i < offsets.length; i++) {
            offsets[i] = 0.001 * (i + 1);
        }
        Map<String, Object> body = request(waypoints(offsets));
        body.put("compare", true);

        JsonNode comparison = optimizeOk(body).get("comparison");

        assertEquals(3, comparison.size());
        assertEquals(null, comparison.get("HELD_KARP"));
    }

    @Test
    void heldKarpWithSixteenIs422() throws Exception {
        double[] offsets = new double[16];
        for (int i = 0; i < offsets.length; i++) {
            offsets[i] = 0.001 * (i + 1);
        }
        Map<String, Object> body = request(waypoints(offsets));
        body.put("algorithm", "HELD_KARP");

        optimize(body, Role.DISPATCHER).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROUTE_TOO_LARGE_FOR_EXACT"));
    }

    @Test
    void missingPickupIs400() throws Exception {
        Map<String, Object> body = request(waypoints(0.01));
        body.remove("pickup");

        optimize(body, Role.DISPATCHER).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void identicalPointsGiveZeroSavings() throws Exception {
        Map<String, Object> body = request(waypoints(0, 0));
        body.put("dropoff", point(0));
        body.put("compare", true);

        JsonNode response = optimizeOk(body);

        assertEquals(0.0, response.get("totalKm").asDouble());
        assertEquals(0.0, response.get("baselineKm").asDouble());
        assertEquals(0.0, response.get("savingsPct").asDouble());
        assertEquals(0, response.get("etaMinutes").asInt());
    }

    @Test
    void seedIsReproducible() throws Exception {
        double[] offsets = new double[10];
        for (int i = 0; i < offsets.length; i++) {
            offsets[i] = 0.001 * ((i * 7) % 11 + 1);
        }
        Map<String, Object> body = request(waypoints(offsets));
        body.put("algorithm", "SIMULATED_ANNEALING");
        body.put("seed", 42);

        JsonNode first = optimizeOk(body);
        JsonNode second = optimizeOk(body);

        assertEquals(first.get("stops"), second.get("stops"));
    }

    @Test
    void fleetManagerIs403() throws Exception {
        optimize(request(waypoints(0.01)), Role.FLEET_MANAGER).andExpect(status().isForbidden());
    }
}
