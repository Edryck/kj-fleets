package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.dto.OrderDtos.AssignRequest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.entity.TrackingStatus;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.TrackingStatusRepository;
import br.com.kjfleets.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TrackingActorTest extends IntegrationTest {

    @Autowired
    private TrackingStatusRepository trackings;

    @Autowired
    private OrderRepository orders;

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private OrderService orderService;

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private ResultActions postJson(String path, Object payload, String bearer) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)).header("Authorization", bearer));
    }

    private TrackingStatus row(String orderId, String code) {
        List<TrackingStatus> rows = trackings.findByOrderOrderByCreatedAtAscIdAsc(
                orders.findByPublicId(orderId).orElseThrow());
        return rows.stream().filter(r -> r.getCode().equals(code)).findFirst().orElseThrow();
    }

    @Test
    void trackRecordsActorOrNull() throws Exception {
        // cliente cria e cancela
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        authService.register(new RegisterRequest("cust-" + suffix, "password-123", "Cliente " + suffix, null,
                suffix + "@mail.com"));
        AppUser customer = userRepository.findByUsername("cust-" + suffix).orElseThrow();
        String customerBearer = "Bearer " + jwtService.generate(customer);
        String cancelled = fixtures.createOrder(customerBearer);
        postJson("/orders/" + cancelled + "/cancel", Map.of("reason", "desistiu"), customerBearer)
                .andExpect(status().isOk());
        assertEquals("CUSTOMER", row(cancelled, "cancelled").getActorRole());
        assertEquals("cust-" + suffix, row(cancelled, "cancelled").getActorUsername());
        assertEquals("CUSTOMER", row(cancelled, "created").getActorRole());

        // equipe despacha
        String order = fixtures.createOrder(bearer(Role.DISPATCHER));
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        postJson("/orders/" + order + "/assign", Map.of("driverId", driverId), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());
        postJson("/orders/" + order + "/dispatch", Map.of(), bearer(Role.DISPATCHER)).andExpect(status().isOk());
        assertEquals("DISPATCHER", row(order, "dispatched").getActorRole());
        assertEquals("dispatcher-user", row(order, "dispatched").getActorUsername());

        // motorista avança
        String driverUsername = json.readTree(mvc.perform(get("/drivers/" + driverId)
                .header("Authorization", bearer(Role.ADMIN))).andReturn().getResponse().getContentAsString())
                .get("username").asString();
        mvc.perform(post("/driver/orders/" + order + "/activity").with(httpBasic(driverUsername, "password-123"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"DRIVER_ENROUTE\"}"))
                .andExpect(status().isOk());
        assertEquals("DRIVER", row(order, "driver_enroute").getActorRole());
        assertEquals(driverUsername, row(order, "driver_enroute").getActorUsername());

        // liberação pelo sistema (remoção do motorista) leva o admin que removeu
        String released = fixtures.createOrder(bearer(Role.DISPATCHER));
        String otherDriver = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        postJson("/orders/" + released + "/assign", Map.of("driverId", otherDriver), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());
        mvc.perform(delete("/drivers/" + otherDriver).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isNoContent());
        assertEquals("ADMIN", row(released, "unassigned").getActorRole());
        assertEquals("admin-user", row(released, "unassigned").getActorUsername());

        // sem autenticação no contexto, autor nulo
        String anonymous = fixtures.createOrder(bearer(Role.DISPATCHER));
        String thirdDriver = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        orderService.assign(anonymous, new AssignRequest(thirdDriver, null));
        assertNull(row(anonymous, "assigned").getActorUsername());
        assertNull(row(anonymous, "assigned").getActorRole());
    }

    @Test
    void batchAssignIsMarked() throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        Map<String, Object> request = new HashMap<>();
        Map<String, Object> point = Map.of("name", "Lote " + UUID.randomUUID(), "lat", 40.0, "lng", 40.0);
        String order = json.readTree(postJson("/orders", Map.of("pickup", point, "dropoff", point),
                bearer(Role.DISPATCHER)).andReturn().getResponse().getContentAsString()).get("publicId").asString();
        var driver = drivers.findByPublicIdAndActiveTrue(driverId).orElseThrow();
        driver.setLat(40.0);
        driver.setLng(40.0);
        driver.setLastSeenAt(Instant.now());
        drivers.save(driver);
        request.put("orderIds", List.of(order));
        request.put("apply", true);
        JsonNode plan = json.readTree(postJson("/dispatch/plan", request, bearer(Role.DISPATCHER))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(1, plan.get("assignments").size());

        String details = row(order, "assigned").getDetails();
        assertTrue(details.endsWith(" lote"), details);
    }

    private String dispatchedWithWaypoint(String driverId) throws Exception {
        Map<String, Object> start = Map.of("name", "Ponto " + UUID.randomUUID(), "lat", -24.86, "lng", -54.33);
        Map<String, Object> mid = Map.of("name", "Ponto " + UUID.randomUUID(), "lat", -24.86, "lng", -54.31);
        Map<String, Object> end = Map.of("name", "Ponto " + UUID.randomUUID(), "lat", -24.86, "lng", -54.29);
        String order = json.readTree(postJson("/orders", Map.of("pickup", start, "dropoff", end,
                "waypoints", List.of(mid)), bearer(Role.DISPATCHER)).andReturn().getResponse().getContentAsString())
                .get("publicId").asString();
        postJson("/orders/" + order + "/assign", Map.of("driverId", driverId), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());
        postJson("/orders/" + order + "/dispatch", Map.of(), bearer(Role.DISPATCHER)).andExpect(status().isOk());
        return order;
    }

    private int waypointSeq(String order) throws Exception {
        for (JsonNode stop : json.readTree(mvc.perform(get("/orders/" + order + "/route")
                .header("Authorization", bearer(Role.ADMIN))).andReturn().getResponse().getContentAsString())
                .get("stops")) {
            if (stop.get("type").asString().equals("WAYPOINT")) {
                return stop.get("seq").asInt();
            }
        }
        throw new AssertionError("sem waypoint");
    }

    @Test
    void stopCompletedRecordsActor() throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String username = json.readTree(mvc.perform(get("/drivers/" + driverId)
                .header("Authorization", bearer(Role.ADMIN))).andReturn().getResponse().getContentAsString())
                .get("username").asString();
        String order = dispatchedWithWaypoint(driverId);
        mvc.perform(post("/driver/location").with(httpBasic(username, "password-123"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"lat\":-24.86,\"lng\":-54.31}"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/driver/orders/" + order + "/stops/" + waypointSeq(order) + "/complete")
                .with(httpBasic(username, "password-123"))).andExpect(status().isOk());
        assertEquals("DRIVER", row(order, "stop_completed").getActorRole());
        assertEquals(username, row(order, "stop_completed").getActorUsername());

        String staffOrder = dispatchedWithWaypoint(fixtures.createDriver(fixtures.createVehicle(),
                DriverStatus.AVAILABLE));
        mvc.perform(post("/orders/" + staffOrder + "/stops/" + waypointSeq(staffOrder) + "/complete")
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        assertEquals("DISPATCHER", row(staffOrder, "stop_completed").getActorRole());
        assertEquals("dispatcher-user", row(staffOrder, "stop_completed").getActorUsername());
    }
}
