package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.service.OrderService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DispatchPlanRollbackTest extends IntegrationTest {

    @MockitoSpyBean
    private OrderService orderService;

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private OrderRepository orders;

    private String driverAt(OrderFixtures fixtures, double lng) throws Exception {
        String id = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        Driver entity = drivers.findByPublicIdAndActiveTrue(id).orElseThrow();
        entity.setLat(-60.0);
        entity.setLng(lng);
        entity.setLastSeenAt(Instant.now());
        drivers.save(entity);
        return id;
    }

    private String orderAt(double lng) throws Exception {
        Map<String, Object> point = Map.of("name", "Rollback " + UUID.randomUUID(), "lat", -60.0, "lng", lng);
        String response = mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("pickup", point, "dropoff", point)))
                .header("Authorization", bearer(Role.DISPATCHER))).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    @Test
    void applyIsAllOrNothing() throws Exception {
        OrderFixtures fixtures = new OrderFixtures(mvc, json, this::bearer);
        driverAt(fixtures, 0.0);
        driverAt(fixtures, 0.5);
        String first = orderAt(0.0);
        String second = orderAt(0.5);

        AtomicInteger calls = new AtomicInteger();
        Mockito.doAnswer(invocation -> {
            if (calls.incrementAndGet() == 2) {
                throw new BusinessException("DRIVER_NOT_AVAILABLE", HttpStatus.UNPROCESSABLE_ENTITY, "simulado");
            }
            return invocation.callRealMethod();
        }).when(orderService).assign(Mockito.anyString(), Mockito.any());

        mvc.perform(post("/dispatch/plan").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("orderIds", List.of(first, second), "apply", true)))
                .header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("DRIVER_NOT_AVAILABLE"));

        assertNull(orders.findByPublicId(first).orElseThrow().getDriver());
        assertNull(orders.findByPublicId(second).orElseThrow().getDriver());
    }
}
