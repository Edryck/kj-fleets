package br.com.kjfleets.service;

import br.com.kjfleets.RoadFixtureTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.controller.OrderFixtures;
import br.com.kjfleets.routing.Haversine;
import br.com.kjfleets.service.DistanceService.DistanceMatrix;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RoadDistanceTest extends RoadFixtureTest {

    @Autowired
    private DistanceService distance;

    private static Map<String, Object> point(double lat, double lng) {
        return Map.of("name", "Via " + UUID.randomUUID(), "lat", lat, "lng", lng);
    }

    private String orderWith(List<Map<String, Object>> waypoints) throws Exception {
        String body = json.writeValueAsString(Map.of("pickup", point(-24.8600, -54.3300),
                "dropoff", point(-24.8660, -54.3210), "waypoints", waypoints));
        String response = mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON).content(body)
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private JsonNode computeRoute(String orderId) throws Exception {
        return json.readTree(mvc.perform(post("/orders/" + orderId + "/route")
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private String orderWithFarWaypoint() throws Exception {
        return orderWith(List.of(point(-24.8630, -54.3240), point(-30.0, -40.0)));
    }

    @Test
    void roadNotShorterThanStraight() throws Exception {
        String body = json.writeValueAsString(Map.of("pickup", Map.of("lat", -24.8600, "lng", -54.3300),
                "waypoints", List.of(Map.of("lat", -24.8630, "lng", -54.3240)),
                "dropoff", Map.of("lat", -24.8660, "lng", -54.3210)));
        JsonNode stops = json.readTree(mvc.perform(post("/routes/optimize").contentType(MediaType.APPLICATION_JSON)
                .content(body).header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("stops");

        for (int i = 1; i < stops.size(); i++) {
            JsonNode a = stops.get(i - 1);
            JsonNode b = stops.get(i);
            double straightKm = Haversine.km(a.get("lat").asDouble(), a.get("lng").asDouble(),
                    b.get("lat").asDouble(), b.get("lng").asDouble());
            assertEquals("ROAD", b.get("distanceSource").asString());
            assertTrue(b.get("legKm").asDouble() >= straightKm - 1e-6, "leg " + i);
        }
    }

    @Test
    void fallbackPerLeg() throws Exception {
        String orderId = orderWithFarWaypoint();
        JsonNode route = computeRoute(orderId);

        // o waypoint fora do mapa derruba as duas pernas que tocam nele
        assertEquals(2, route.get("fallbackLegs").asInt());
        long road = 0;
        for (JsonNode stop : route.get("stops")) {
            road += "ROAD".equals(stop.path("distanceSource").asString()) ? 1 : 0;
        }
        assertTrue(road >= 1);

        OrderFixtures fixtures = new OrderFixtures(mvc, json, this::bearer);
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driverId)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
    }

    @Test
    void pathOnRead() throws Exception {
        String orderId = orderWithFarWaypoint();
        computeRoute(orderId);

        JsonNode route = json.readTree(mvc.perform(get("/orders/" + orderId + "/route")
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        int withPath = 0;
        for (JsonNode stop : route.get("stops")) {
            String source = stop.path("distanceSource").asString("");
            if (source.equals("ROAD")) {
                assertTrue(stop.get("path").size() >= 2);
                withPath++;
            } else {
                assertTrue(stop.path("path").isNull() || stop.path("path").isMissingNode());
            }
        }
        assertTrue(withPath >= 1);
    }

    @Test
    void matrixBudget() {
        Random random = new Random(7);
        List<double[]> points = new ArrayList<>();
        for (int i = 0; i < 52; i++) {
            points.add(new double[]{-24.8600 - random.nextDouble() * 0.006, -54.3300 + random.nextDouble() * 0.009});
        }

        long started = System.nanoTime();
        DistanceMatrix matrix = distance.matrix(points);
        long ms = (System.nanoTime() - started) / 1_000_000;

        System.out.println("matrixBudget 52 pontos (fixture): " + ms + " ms");
        assertTrue(ms < 15_000, ms + " ms");
        for (int i = 0; i < 52; i++) {
            assertEquals(0, matrix.km()[i][i], 1e-9);
            for (int j = 0; j < 52; j++) {
                assertEquals(matrix.km()[i][j], matrix.km()[j][i], 1e-9);
                assertFalse(i != j && matrix.fallback()[i][j]);
            }
        }
    }
}
