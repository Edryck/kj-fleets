package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DriverRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderRaceTest extends IntegrationTest {

    private static final int RUNS = 10;

    @Autowired
    private DriverRepository drivers;

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
        // cria os usuários antes: criar dentro das threads disputa a unique de username
        bearer(Role.ADMIN);
        bearer(Role.DISPATCHER);
    }

    private record Outcome(int status, String code) {
    }

    private Outcome run(Callable<MockHttpServletResponse> call) throws Exception {
        MockHttpServletResponse response = call.call();
        String body = response.getContentAsString();
        String code = response.getStatus() >= 400 && !body.isBlank()
                ? json.readTree(body).path("code").asString() : "";
        return new Outcome(response.getStatus(), code);
    }

    // dispara as duas chamadas juntas; o atraso (ms) alterna quem sai na frente entre as rodadas
    private List<Outcome> together(Callable<MockHttpServletResponse> first, Callable<MockHttpServletResponse> second,
                                   int run) throws Exception {
        long[] delays = run % 2 == 0 ? new long[]{0, run * 2L} : new long[]{run * 2L, 0};
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Outcome>> futures = List.of(
                    pool.submit(() -> {
                        start.await();
                        Thread.sleep(delays[0]);
                        return run(first);
                    }),
                    pool.submit(() -> {
                        start.await();
                        Thread.sleep(delays[1]);
                        return run(second);
                    }));
            start.countDown();
            return List.of(futures.get(0).get(), futures.get(1).get());
        } finally {
            pool.shutdown();
        }
    }

    private MockHttpServletResponse deleteDriver(String driverId) throws Exception {
        return mvc.perform(delete("/drivers/" + driverId).header("Authorization", bearer(Role.ADMIN)))
                .andReturn().getResponse();
    }

    private MockHttpServletResponse send(String path, Object body) throws Exception {
        var request = post(path).header("Authorization", bearer(Role.ADMIN));
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return mvc.perform(request).andReturn().getResponse();
    }

    private tools.jackson.databind.JsonNode order(String orderId) throws Exception {
        return json.readTree(mvc.perform(get("/orders/" + orderId).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private List<String> trackingCodes(String orderId) throws Exception {
        var tree = json.readTree(mvc.perform(get("/orders/" + orderId + "/tracking")
                .header("Authorization", bearer(Role.ADMIN))).andReturn().getResponse().getContentAsString());
        return tree.valueStream().map(node -> node.get("code").asString()).toList();
    }

    @Test
    void deleteDriverVsDispatch() throws Exception {
        int dispatched = 0;
        int deleted = 0;
        for (int i = 0; i < RUNS; i++) {
            String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
            String orderId = fixtures.createOrder(bearer(Role.DISPATCHER));
            assertEquals(200, send("/orders/" + orderId + "/assign", Map.of("driverId", driverId)).getStatus());

            List<Outcome> results = together(() -> deleteDriver(driverId),
                    () -> send("/orders/" + orderId + "/dispatch", null), i);
            Outcome del = results.get(0);
            Outcome dis = results.get(1);
            boolean driverActive = drivers.findByPublicIdAndActiveTrue(driverId).isPresent();
            var order = order(orderId);

            String ctx = "run " + i + ": " + results;
            if (dis.status() == 200) {
                dispatched++;
                assertEquals(409, del.status(), ctx);
                assertEquals("RESOURCE_IN_USE", del.code(), ctx);
                assertTrue(driverActive, ctx);
                assertEquals("DISPATCHED", order.get("status").asString(), ctx);
            } else {
                deleted++;
                assertEquals(204, del.status(), ctx);
                assertEquals(422, dis.status(), ctx);
                assertFalse(driverActive, ctx);
                assertEquals("CREATED", order.get("status").asString(), ctx);
                assertTrue(order.path("driver").isNull() || order.path("driver").isMissingNode(), ctx);
                assertTrue(trackingCodes(orderId).contains("unassigned"), ctx);
            }
        }
        System.out.println("deleteDriverVsDispatch: dispatched=" + dispatched + " deleted=" + deleted);
    }

    @Test
    void deleteDriverVsAssign() throws Exception {
        int assignedThenReleased = 0;
        int assignRejected = 0;
        for (int i = 0; i < RUNS; i++) {
            String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
            String orderId = fixtures.createOrder(bearer(Role.DISPATCHER));

            List<Outcome> results = together(() -> deleteDriver(driverId),
                    () -> send("/orders/" + orderId + "/assign", Map.of("driverId", driverId)), i);
            Outcome del = results.get(0);
            Outcome asg = results.get(1);
            var order = order(orderId);

            String ctx = "run " + i + ": " + results;
            assertEquals(204, del.status(), ctx);
            assertFalse(drivers.findByPublicIdAndActiveTrue(driverId).isPresent(), ctx);
            assertEquals("CREATED", order.get("status").asString(), ctx);
            assertTrue(order.path("driver").isNull() || order.path("driver").isMissingNode(),
                    "pedido preso a motorista inativo. " + ctx);
            if (asg.status() == 200) {
                assignedThenReleased++;
                assertTrue(trackingCodes(orderId).contains("unassigned"), ctx);
            } else {
                assignRejected++;
                assertTrue(asg.status() == 404 || asg.status() == 422, ctx);
            }
        }
        System.out.println("deleteDriverVsAssign: assignedThenReleased=" + assignedThenReleased
                + " assignRejected=" + assignRejected);
    }
}
