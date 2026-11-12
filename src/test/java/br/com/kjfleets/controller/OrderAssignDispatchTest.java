package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.OrderStatus;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderAssignDispatchTest extends IntegrationTest {

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private VehicleRepository vehicles;

    @Autowired
    private OrderRepository orders;

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private String newOrder() throws Exception {
        return fixtures.createOrder(bearer(Role.DISPATCHER));
    }

    private ResultActions assign(String orderId, String driverId, String vehicleId, Role role) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("driverId", driverId);
        body.put("vehicleId", vehicleId);
        return mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).header("Authorization", bearer(role)));
    }

    private ResultActions assign(String orderId, String driverId) throws Exception {
        return assign(orderId, driverId, null, Role.DISPATCHER);
    }

    private ResultActions dispatch(String orderId) throws Exception {
        return mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)));
    }

    private String availableDriver() throws Exception {
        return fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
    }

    private OrderStatus statusOf(String orderId) {
        return orders.findByPublicId(orderId).orElseThrow().getStatus();
    }

    @Test
    void assignKeepsCreated() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String orderId = newOrder();

        assign(orderId, driverId).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.driver.publicId").value(driverId))
                .andExpect(jsonPath("$.vehicle.publicId").value(vehicleId));

        mvc.perform(get("/orders/" + orderId + "/tracking").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$[*].code").value(hasItem("assigned")));
    }

    @Test
    void assignUsesDriversVehicle() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);

        assign(newOrder(), driverId).andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicle.publicId").value(vehicleId));
    }

    @Test
    void assignWithoutAnyVehicleIs422() throws Exception {
        String driverId = fixtures.createDriver(null, DriverStatus.AVAILABLE);

        assign(newOrder(), driverId).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_DISPATCH_REQUIRES_VEHICLE"));
    }

    @Test
    void assignOfflineDriverIs422() throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.OFFLINE);

        assign(newOrder(), driverId).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("DRIVER_NOT_AVAILABLE"));
    }

    @Test
    void assignUnknownDriverIs404() throws Exception {
        assign(newOrder(), "driver_zzzzzz").andExpect(status().isNotFound());
    }

    @Test
    void assignMaintenanceVehicleIs422() throws Exception {
        String vehicleId = fixtures.createVehicle();
        mvc.perform(put("/vehicles/" + vehicleId).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("plate", "M" + UUID.randomUUID().toString()
                        .substring(0, 7).toUpperCase(), "type", "VAN", "status", "MAINTENANCE")))
                .header("Authorization", bearer(Role.FLEET_MANAGER))).andExpect(status().isOk());
        String driverId = fixtures.createDriver(null, DriverStatus.AVAILABLE);

        assign(newOrder(), driverId, vehicleId, Role.DISPATCHER).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VEHICLE_NOT_AVAILABLE"));
    }

    @Test
    void sameDriverQueuesTwoOrders() throws Exception {
        String driverId = availableDriver();

        assign(newOrder(), driverId).andExpect(status().isOk());
        assign(newOrder(), driverId).andExpect(status().isOk());
    }

    @Test
    void reassignReplaces() throws Exception {
        String first = availableDriver();
        String second = availableDriver();
        String orderId = newOrder();

        assign(orderId, first).andExpect(status().isOk());
        assign(orderId, second).andExpect(status().isOk())
                .andExpect(jsonPath("$.driver.publicId").value(second));
    }

    @Test
    void dispatchMarksBusyAndInUse() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String orderId = newOrder();
        assign(orderId, driverId).andExpect(status().isOk());

        dispatch(orderId).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISPATCHED"))
                .andExpect(jsonPath("$.dispatchedAt").isNotEmpty());

        assertEquals(DriverStatus.BUSY, drivers.findByPublicIdAndActiveTrue(driverId).orElseThrow().getStatus());
        assertEquals(VehicleStatus.IN_USE, vehicles.findByPublicId(vehicleId).orElseThrow().getStatus());
        mvc.perform(get("/orders/" + orderId + "/tracking").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$[*].code").value(hasItem("dispatched")));
    }

    @Test
    void dispatchWithoutDriverIs422() throws Exception {
        dispatch(newOrder()).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_DISPATCH_REQUIRES_DRIVER"));
    }

    @Test
    void secondQueuedDispatchIs422() throws Exception {
        String driverId = availableDriver();
        String first = newOrder();
        String second = newOrder();
        assign(first, driverId).andExpect(status().isOk());
        assign(second, driverId).andExpect(status().isOk());

        dispatch(first).andExpect(status().isOk());
        dispatch(second).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("DRIVER_NOT_AVAILABLE"));
        assertEquals(OrderStatus.CREATED, statusOf(second));
    }

    @Test
    void dispatchWithOfflineDriverIs422() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String orderId = newOrder();
        assign(orderId, driverId).andExpect(status().isOk());
        mvc.perform(put("/drivers/" + driverId).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Offline", "vehicleId", vehicleId,
                        "status", "OFFLINE"))).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isOk());

        dispatch(orderId).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("DRIVER_NOT_AVAILABLE"));
    }

    @Test
    void dispatchTwiceIs422() throws Exception {
        String orderId = newOrder();
        assign(orderId, availableDriver()).andExpect(status().isOk());
        dispatch(orderId).andExpect(status().isOk());

        dispatch(orderId).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    // dispara os dois dispatches juntos e devolve status + code de cada resposta
    private List<String> dispatchTogether(String first, String second) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<String>> results = Stream.of(first, second).map(id -> pool.submit(() -> {
                start.await();
                var response = dispatch(id).andReturn().getResponse();
                String code = response.getStatus() == 200 ? ""
                        : json.readTree(response.getContentAsString()).get("code").asString();
                return response.getStatus() + code;
            })).toList();
            start.countDown();
            return List.of(results.get(0).get(), results.get(1).get());
        } finally {
            pool.shutdown();
        }
    }

    @Test
    void concurrentDispatchOfSameDriver() throws Exception {
        String driverId = availableDriver();
        List<String> ids = List.of(newOrder(), newOrder());
        for (String id : ids) {
            assign(id, driverId).andExpect(status().isOk());
        }

        List<String> results = dispatchTogether(ids.get(0), ids.get(1));

        assertEquals(1, results.stream().filter(r -> r.equals("200")).count());
        assertEquals(1, results.stream().filter(r -> r.equals("422DRIVER_NOT_AVAILABLE")).count());
        assertEquals(1, ids.stream().filter(id -> statusOf(id) == OrderStatus.DISPATCHED).count());
    }

    @Test
    void concurrentDispatchOfSameOrder() throws Exception {
        String orderId = newOrder();
        assign(orderId, availableDriver()).andExpect(status().isOk());

        List<String> results = dispatchTogether(orderId, orderId);

        assertEquals(1, results.stream().filter(r -> r.equals("200")).count());
        assertEquals(1, results.stream().filter(r -> r.equals("422ORDER_INVALID_TRANSITION")).count());
    }

    @Test
    void assignInactiveVehicleIs422() throws Exception {
        String vehicleId = fixtures.createVehicle();
        mvc.perform(delete("/vehicles/" + vehicleId).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isNoContent());
        String driverId = fixtures.createDriver(null, DriverStatus.AVAILABLE);

        assign(newOrder(), driverId, vehicleId, Role.DISPATCHER).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VEHICLE_NOT_AVAILABLE"));
    }

    @Test
    void fleetManagerCannotAssign() throws Exception {
        assign(newOrder(), availableDriver(), null, Role.FLEET_MANAGER).andExpect(status().isForbidden());
    }
}
