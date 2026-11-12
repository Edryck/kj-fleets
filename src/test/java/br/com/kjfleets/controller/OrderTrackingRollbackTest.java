package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.entity.TrackingStatus;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.TrackingStatusRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderTrackingRollbackTest extends IntegrationTest {

    @MockitoSpyBean
    private TrackingStatusRepository trackings;

    @Autowired
    private OrderRepository orders;

    @Test
    void trackingRollsBackWithTransition() throws Exception {
        OrderFixtures fixtures = new OrderFixtures(mvc, json, this::bearer);
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String orderId = fixtures.createOrder(bearer(Role.DISPATCHER));
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driverId)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());

        Mockito.doAnswer(invocation -> {
            TrackingStatus tracking = invocation.getArgument(0);
            if (tracking.getCode().equals("driver_enroute")) {
                throw new RuntimeException("falha simulada ao gravar histórico");
            }
            return invocation.callRealMethod();
        }).when(trackings).save(Mockito.any(TrackingStatus.class));

        mvc.perform(post("/orders/" + orderId + "/activity").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("code", "DRIVER_ENROUTE")))
                .header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));

        assertEquals(OrderStatus.DISPATCHED, orders.findByPublicId(orderId).orElseThrow().getStatus());
    }
}
