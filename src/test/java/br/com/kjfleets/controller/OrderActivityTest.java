package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.OrderDtos.ActivityRequest;
import br.com.kjfleets.dto.OrderDtos.PodRequest;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.service.OrderService;
import org.springframework.http.HttpStatus;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderActivityTest extends IntegrationTest {

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private VehicleRepository vehicles;

    @Autowired
    private OrderRepository orders;

    @Autowired
    private OrderService service;

    private OrderFixtures fixtures;

    private record Setup(String orderId, String driverId, String vehicleId) {
    }

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private ResultActions postJson(String path, Object body, String bearer) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).header("Authorization", bearer));
    }

    private Setup assigned(String orderId) throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        postJson("/orders/" + orderId + "/assign", Map.of("driverId", driverId), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());
        return new Setup(orderId, driverId, vehicleId);
    }

    private Setup dispatched(boolean podRequired) throws Exception {
        String orderId = podRequired ? podOrder() : fixtures.createOrder(bearer(Role.DISPATCHER));
        Setup setup = assigned(orderId);
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
        return setup;
    }

    private String podOrder() throws Exception {
        Map<String, Object> point = Map.of("name", "Ponto " + UUID.randomUUID(), "lat", -24.87, "lng", -54.33);
        String response = postJson("/orders", Map.of("pickup", point, "dropoff", point, "podRequired", true),
                bearer(Role.DISPATCHER)).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private ResultActions activity(String orderId, String code) throws Exception {
        return postJson("/orders/" + orderId + "/activity", Map.of("code", code), bearer(Role.DISPATCHER));
    }

    private void advanceTo(String orderId, String... codes) throws Exception {
        for (String code : codes) {
            activity(orderId, code).andExpect(status().isOk());
        }
    }

    private ResultActions pod(String orderId, String value) throws Exception {
        return postJson("/orders/" + orderId + "/pod", Map.of("value", value), bearer(Role.DISPATCHER));
    }

    private ResultActions cancel(String orderId, String reason, String bearer) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("reason", reason);
        return postJson("/orders/" + orderId + "/cancel", body, bearer);
    }

    private ResultActions tracking(String orderId) throws Exception {
        return mvc.perform(get("/orders/" + orderId + "/tracking").header("Authorization", bearer(Role.ADMIN)));
    }

    private void assertReleased(Setup setup) {
        assertEquals(DriverStatus.AVAILABLE, drivers.findByPublicIdAndActiveTrue(setup.driverId()).orElseThrow()
                .getStatus());
        assertEquals(VehicleStatus.AVAILABLE, vehicles.findByPublicId(setup.vehicleId()).orElseThrow()
                .getStatus());
    }

    private record Registered(String customerId, String bearer) {
    }

    private Registered registerCustomer() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        var response = authService.register(new RegisterRequest("cust-" + suffix, "password-123",
                "Cliente " + suffix, null, suffix + "@mail.com"));
        AppUser user = userRepository.findByUsername("cust-" + suffix).orElseThrow();
        return new Registered(response.publicId(), "Bearer " + jwtService.generate(user));
    }

    @Test
    void fullHappyPath() throws Exception {
        Setup setup = dispatched(false);
        advanceTo(setup.orderId(), "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS");
        pod(setup.orderId(), "assinatura-ok").andExpect(status().isOk())
                .andExpect(jsonPath("$.podValue").value("assinatura-ok"))
                .andExpect(jsonPath("$.podAt").isNotEmpty());
        activity(setup.orderId(), "COMPLETED").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.finishedAt").isNotEmpty());

        tracking(setup.orderId()).andExpect(jsonPath("$[*].code").value(contains("created", "assigned",
                "dispatched", "driver_enroute", "arrived", "in_progress", "pod_registered", "completed")));
        assertReleased(setup);
    }

    @Test
    void skippingIs422() throws Exception {
        Setup setup = dispatched(false);

        activity(setup.orderId(), "IN_PROGRESS").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void cancelViaActivityIs422() throws Exception {
        Setup setup = dispatched(false);

        activity(setup.orderId(), "CANCELLED").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
        activity(setup.orderId(), "DISPATCHED").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void failedNeedsReason() throws Exception {
        Setup setup = dispatched(false);
        advanceTo(setup.orderId(), "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS");

        activity(setup.orderId(), "FAILED").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        postJson("/orders/" + setup.orderId() + "/activity", Map.of("code", "FAILED", "reason", "Cliente ausente"),
                bearer(Role.DISPATCHER)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.reason").value("Cliente ausente"));
        assertReleased(setup);
    }

    @Test
    void podRequiredBlocksCompletion() throws Exception {
        Setup setup = dispatched(true);
        advanceTo(setup.orderId(), "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS");

        activity(setup.orderId(), "COMPLETED").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_POD_REQUIRED"));
        pod(setup.orderId(), "ok").andExpect(status().isOk());
        activity(setup.orderId(), "COMPLETED").andExpect(status().isOk());
    }

    @Test
    void podOnlyInProgress() throws Exception {
        Setup setup = dispatched(false);

        pod(setup.orderId(), "cedo demais").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void secondPodOverwrites() throws Exception {
        Setup setup = dispatched(false);
        advanceTo(setup.orderId(), "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS");

        pod(setup.orderId(), "primeiro").andExpect(status().isOk());
        pod(setup.orderId(), "segundo").andExpect(status().isOk())
                .andExpect(jsonPath("$.podValue").value("segundo"));
    }

    @Test
    void latWithoutLngIs400() throws Exception {
        Setup setup = dispatched(false);

        postJson("/orders/" + setup.orderId() + "/activity", Map.of("code", "DRIVER_ENROUTE", "lat", -24.8),
                bearer(Role.DISPATCHER)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        postJson("/orders/" + setup.orderId() + "/activity",
                Map.of("code", "DRIVER_ENROUTE", "lat", 123.0, "lng", -54.3), bearer(Role.DISPATCHER))
                .andExpect(status().isBadRequest());
    }

    @Test
    void staffActivityLogsActorNotPosition() throws Exception {
        Setup setup = dispatched(false);

        postJson("/orders/" + setup.orderId() + "/activity",
                Map.of("code", "DRIVER_ENROUTE", "lat", -24.8, "lng", -54.3), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());

        tracking(setup.orderId()).andExpect(jsonPath("$[3].code").value("driver_enroute"))
                .andExpect(jsonPath("$[3].details").value(containsString("por")))
                .andExpect(jsonPath("$[3].lat").value(-24.8));
        Driver driver = drivers.findByPublicIdAndActiveTrue(setup.driverId()).orElseThrow();
        assertNull(driver.getLat());
    }

    @Test
    void customerCancelsOwnCreated() throws Exception {
        Registered customer = registerCustomer();
        String orderId = fixtures.createOrder(customer.bearer());

        cancel(orderId, "Mudei de ideia", customer.bearer()).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.reason").value("Mudei de ideia"))
                .andExpect(jsonPath("$.finishedAt").isNotEmpty());
        tracking(orderId).andExpect(jsonPath("$[1].code").value("cancelled"))
                .andExpect(jsonPath("$[1].details").value("Mudei de ideia"));
    }

    @Test
    void customerCannotCancelDispatched() throws Exception {
        Registered customer = registerCustomer();
        String orderId = fixtures.createOrder(customer.bearer());
        assigned(orderId);
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());

        cancel(orderId, "tarde demais", customer.bearer()).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void customerCancelOfOtherIs404() throws Exception {
        Registered owner = registerCustomer();
        Registered other = registerCustomer();
        String orderId = fixtures.createOrder(owner.bearer());

        cancel(orderId, "não é meu", other.bearer()).andExpect(status().isNotFound());
    }

    @Test
    void cancelAfterArrivedIs422() throws Exception {
        Setup setup = dispatched(false);
        advanceTo(setup.orderId(), "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS");

        cancel(setup.orderId(), "tarde", bearer(Role.DISPATCHER)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void cancelDispatchedReleases() throws Exception {
        Setup setup = dispatched(false);

        cancel(setup.orderId(), "Cliente desistiu", bearer(Role.DISPATCHER)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        assertReleased(setup);
    }

    @Test
    void cancelWithoutReasonIs400() throws Exception {
        String orderId = fixtures.createOrder(bearer(Role.DISPATCHER));

        postJson("/orders/" + orderId + "/cancel", Map.of(), bearer(Role.DISPATCHER))
                .andExpect(status().isBadRequest());
    }

    @Test
    void driverOverloadRejectsOthersOrder() throws Exception {
        Setup setup = dispatched(false);
        String other = drivers.findByPublicIdAndActiveTrue(fixtures.createDriver(null, DriverStatus.AVAILABLE))
                .orElseThrow().getUser().getUsername();
        String own = drivers.findByPublicIdAndActiveTrue(setup.driverId()).orElseThrow().getUser().getUsername();
        ActivityRequest request = new ActivityRequest(OrderStatus.DRIVER_ENROUTE, null, null, null);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.advance(setup.orderId(), request, other, true));
        assertEquals(HttpStatus.NOT_FOUND, ex.status());
        assertThrows(BusinessException.class,
                () -> service.registerPod(setup.orderId(), new PodRequest("x"), other, true));
        service.advance(setup.orderId(), request, own, true);
        assertEquals(OrderStatus.DRIVER_ENROUTE, orders.findByPublicId(setup.orderId()).orElseThrow().getStatus());
    }

    @Test
    void invalidTransitionLeavesTrackingUnchanged() throws Exception {
        Setup setup = dispatched(false);

        activity(setup.orderId(), "ARRIVED").andExpect(status().isUnprocessableEntity());

        tracking(setup.orderId()).andExpect(jsonPath("$", hasSize(3)));
    }
}
