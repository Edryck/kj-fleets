package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.lessThan;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DispatchPlanTest extends IntegrationTest {

    // cada teste usa uma faixa de latitude só dele, longe do resto do banco compartilhado
    private static final double UNIT = 0.02;
    private static int nextArea = 0;

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private OrderRepository orders;

    private OrderFixtures fixtures;
    private double lat;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
        lat = 10.0 + nextArea++;
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private String driverAt(double units, Instant seenAt) throws Exception {
        String id = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        Driver entity = drivers.findByPublicIdAndActiveTrue(id).orElseThrow();
        entity.setLat(lat);
        entity.setLng(units * UNIT);
        entity.setLastSeenAt(seenAt);
        drivers.save(entity);
        return id;
    }

    private String driverAt(double units) throws Exception {
        return driverAt(units, Instant.now());
    }

    private String orderAt(double units) throws Exception {
        Map<String, Object> point = Map.of("name", "Lote " + UUID.randomUUID(), "lat", lat, "lng", units * UNIT);
        return body(mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("pickup", point, "dropoff", point)))
                .header("Authorization", bearer(Role.DISPATCHER)))).get("publicId").asString();
    }

    private ResultActions plan(Role role, String algorithm, boolean apply, String... orderIds) throws Exception {
        Map<String, Object> request = new HashMap<>();
        if (algorithm != null) {
            request.put("algorithm", algorithm);
        }
        request.put("orderIds", List.of(orderIds));
        request.put("apply", apply);
        return mvc.perform(post("/dispatch/plan").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request)).header("Authorization", bearer(role)));
    }

    private JsonNode plan(boolean apply, String... orderIds) throws Exception {
        return body(plan(Role.DISPATCHER, null, apply, orderIds).andExpect(status().isOk()));
    }

    private String driverOf(JsonNode plan, String orderId) {
        for (JsonNode pair : plan.get("assignments")) {
            if (pair.get("orderId").asString().equals(orderId)) {
                return pair.get("driverId").asString();
            }
        }
        return null;
    }

    @Test
    void previewDoesNotWrite() throws Exception {
        driverAt(0);
        driverAt(3);
        String first = orderAt(0.5);
        String second = orderAt(3.5);

        JsonNode plan = plan(false, first, second);

        assertEquals(2, plan.get("assignments").size());
        assertEquals("HUNGARIAN", plan.get("algorithm").asString());
        assertEquals(false, plan.get("applied").asBoolean());
        assertNull(orders.findByPublicId(first).orElseThrow().getDriver());
        assertNull(orders.findByPublicId(second).orElseThrow().getDriver());
    }

    @Test
    void applyAssignsWithoutDispatch() throws Exception {
        String driver = driverAt(0);
        String order = orderAt(0.5);

        JsonNode plan = plan(true, order);

        assertEquals(true, plan.get("applied").asBoolean());
        assertEquals(driver, driverOf(plan, order));
        mvc.perform(get("/orders/" + order).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.driver.publicId").value(driver));
        String codes = mvc.perform(get("/orders/" + order + "/tracking").header("Authorization", bearer(Role.ADMIN)))
                .andReturn().getResponse().getContentAsString();
        assertTrue(codes.contains("assigned"));
    }

    @Test
    void hungarianBeatsGreedyOnTrap() throws Exception {
        // o1 em 0, o2 em 4; d1 em 1, d2 em -3: guloso paga 1+7, ótimo paga 3+3
        String d1 = driverAt(1);
        String d2 = driverAt(-3);
        String o1 = orderAt(0);
        String o2 = orderAt(4);

        JsonNode hungarian = body(plan(Role.DISPATCHER, "HUNGARIAN", false, o1, o2).andExpect(status().isOk()));
        JsonNode greedy = body(plan(Role.DISPATCHER, "GREEDY", false, o1, o2).andExpect(status().isOk()));

        double h = hungarian.get("comparison").get("HUNGARIAN").asDouble();
        double g = hungarian.get("comparison").get("GREEDY").asDouble();
        assertTrue(h < g, h + " deveria ser menor que " + g);
        assertEquals(h, hungarian.get("totalKm").asDouble());
        assertEquals(g, greedy.get("totalKm").asDouble());
        assertEquals(d2, driverOf(hungarian, o1));
        assertEquals(d1, driverOf(hungarian, o2));
        assertEquals(d1, driverOf(greedy, o1));
        assertEquals(d2, driverOf(greedy, o2));
    }

    @Test
    void queuedDriverIsCandidate() throws Exception {
        String driver = driverAt(0);
        String queued = orderAt(5);
        mvc.perform(post("/orders/" + queued + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driver)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        String order = orderAt(0.5);

        JsonNode plan = plan(true, order);

        assertEquals(driver, driverOf(plan, order));
    }

    @Test
    void staleDriverIsNotCandidate() throws Exception {
        String stale = driverAt(0, Instant.now().minus(10, ChronoUnit.MINUTES));
        String fresh = driverAt(3);
        String order = orderAt(0);

        JsonNode plan = plan(false, order);

        assertEquals(fresh, driverOf(plan, order));
        for (JsonNode pair : plan.get("assignments")) {
            assertNotEquals(stale, pair.get("driverId").asString());
        }
    }

    @Test
    void rectangularPlanNeverAssignsPadding() throws Exception {
        driverAt(0);
        driverAt(10);
        driverAt(20);
        String single = orderAt(0.5);
        JsonNode oneOrder = plan(false, single);
        assertEquals(1, oneOrder.get("assignments").size());
        assertEquals(0, oneOrder.get("unassigned").size());

        // o banco compartilhado tem outros motoristas, então só dá para garantir a partição
        String a = orderAt(0.5);
        String b = orderAt(10.5);
        String c = orderAt(20.5);
        JsonNode three = plan(false, a, b, c);
        Set<String> seenOrders = new HashSet<>();
        Set<String> seenDrivers = new HashSet<>();
        for (JsonNode pair : three.get("assignments")) {
            assertTrue(seenOrders.add(pair.get("orderId").asString()));
            assertTrue(seenDrivers.add(pair.get("driverId").asString()));
        }
        List<String> unassigned = new ArrayList<>();
        three.get("unassigned").forEach(id -> unassigned.add(id.asString()));
        for (String id : unassigned) {
            assertTrue(seenOrders.add(id), "pedido repetido: " + id);
        }
        assertEquals(Set.of(a, b, c), seenOrders);
    }

    @Test
    void orderIdsNotCreatedIs422() throws Exception {
        String driver = driverAt(0);
        String order = orderAt(0);
        mvc.perform(post("/orders/" + order + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driver)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());

        plan(Role.DISPATCHER, null, false, order).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void emptyOrderIdsGivesEmptyPlan() throws Exception {
        driverAt(0);
        JsonNode plan = plan(false);
        assertEquals(0, plan.get("assignments").size());
        assertEquals(0, plan.get("unassigned").size());
        assertEquals(0.0, plan.get("totalKm").asDouble());
    }

    @Test
    void applyOnCancelledOrderIs422AndAssignsNothing() throws Exception {
        driverAt(0);
        String alive = orderAt(0.5);
        String cancelled = orderAt(1);
        mvc.perform(post("/orders/" + cancelled + "/cancel").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"teste\"}").header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());

        plan(Role.DISPATCHER, null, true, alive, cancelled).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));

        assertNull(orders.findByPublicId(alive).orElseThrow().getDriver());
    }

    @Test
    void unknownOrderIs404() throws Exception {
        plan(Role.DISPATCHER, null, false, "order_nao_existe").andExpect(status().isNotFound());
    }

    @Test
    void noDriversNearGivesUnassigned() throws Exception {
        String order = orderAt(0);
        JsonNode plan = plan(false, order);
        assertNotNull(plan.get("comparison"));
        assertEquals(1, plan.get("assignments").size() + plan.get("unassigned").size());
    }

    @Test
    void fleetManagerIs403() throws Exception {
        plan(Role.FLEET_MANAGER, null, false, "order_x").andExpect(status().isForbidden());
    }
}
