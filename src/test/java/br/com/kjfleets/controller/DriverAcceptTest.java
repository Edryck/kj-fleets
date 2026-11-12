package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.hamcrest.Matchers.contains;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DriverAcceptTest extends IntegrationTest {

    private static final String PASSWORD = "password-123";

    private OrderFixtures fixtures;

    private record TestDriver(String id, String username) {
    }

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private TestDriver newDriver(boolean withVehicle) throws Exception {
        String vehicleId = withVehicle ? fixtures.createVehicle() : null;
        String id = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String username = body(mvc.perform(get("/drivers/" + id).header("Authorization", bearer(Role.ADMIN))))
                .get("username").asString();
        return new TestDriver(id, username);
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private ResultActions dispatcherPost(String path, Object payload) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)).header("Authorization", bearer(Role.DISPATCHER)));
    }

    private String newOrder() throws Exception {
        Map<String, Object> point = Map.of("name", "Ponto " + UUID.randomUUID(), "lat", -24.87, "lng", -54.33);
        return body(dispatcherPost("/orders", Map.of("pickup", point, "dropoff", point)))
                .get("publicId").asString();
    }

    private ResultActions accept(TestDriver driver, String orderId) throws Exception {
        return mvc.perform(post("/driver/orders/" + orderId + "/accept").with(httpBasic(driver.username(), PASSWORD)));
    }

    private String driverStatus(TestDriver driver) throws Exception {
        return body(mvc.perform(get("/drivers/" + driver.id()).header("Authorization", bearer(Role.ADMIN))))
                .get("status").asString();
    }

    @Test
    void acceptDispatches() throws Exception {
        TestDriver driver = newDriver(true);
        String orderId = newOrder();

        accept(driver, orderId).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISPATCHED"))
                .andExpect(jsonPath("$.driver.publicId").value(driver.id()));

        assertEquals("BUSY", driverStatus(driver));
        mvc.perform(get("/orders/" + orderId + "/tracking").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$[*].code").value(contains("created", "assigned", "dispatched")));
    }

    @Test
    void alreadyAssignedIs409() throws Exception {
        TestDriver owner = newDriver(true);
        TestDriver other = newDriver(true);
        String orderId = newOrder();
        dispatcherPost("/orders/" + orderId + "/assign", Map.of("driverId", owner.id())).andExpect(status().isOk());

        accept(other, orderId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDER_ALREADY_TAKEN"));
        assertEquals("AVAILABLE", driverStatus(other));
    }

    @Test
    void driverWithoutVehicleIs422() throws Exception {
        accept(newDriver(false), newOrder()).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_DISPATCH_REQUIRES_VEHICLE"));
    }

    @Test
    void busyDriverIs422() throws Exception {
        TestDriver driver = newDriver(true);
        accept(driver, newOrder()).andExpect(status().isOk());
        String second = newOrder();

        accept(driver, second).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("DRIVER_NOT_AVAILABLE"));
        mvc.perform(get("/orders/" + second).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.driver").doesNotExist());
    }

    @Test
    void nonCreatedOrderIs422() throws Exception {
        String orderId = newOrder();
        dispatcherPost("/orders/" + orderId + "/cancel", Map.of("reason", "teste")).andExpect(status().isOk());

        accept(newDriver(true), orderId).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_INVALID_TRANSITION"));
    }

    @Test
    void unknownOrderIs404() throws Exception {
        accept(newDriver(true), "ORD-nao-existe").andExpect(status().isNotFound());
    }

    @Test
    void concurrentAccept() throws Exception {
        TestDriver first = newDriver(true);
        TestDriver second = newDriver(true);
        String orderId = newOrder();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Integer> statuses;
        try {
            List<Future<Integer>> futures = List.of(first, second).stream().map(driver -> pool.submit(() -> {
                start.await();
                return accept(driver, orderId).andReturn().getResponse().getStatus();
            })).toList();
            start.countDown();
            statuses = List.of(futures.get(0).get(), futures.get(1).get());
        } finally {
            pool.shutdown();
        }

        assertEquals(1, statuses.stream().filter(s -> s == 200).count());
        assertEquals(1, statuses.stream().filter(s -> s == 409).count());
        String winner = body(mvc.perform(get("/orders/" + orderId).header("Authorization", bearer(Role.ADMIN))))
                .get("driver").get("publicId").asString();
        TestDriver loser = winner.equals(first.id()) ? second : first;
        assertEquals("AVAILABLE", driverStatus(loser));
        assertEquals("BUSY", driverStatus(winner.equals(first.id()) ? first : second));
    }
}
