package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.entity.Route;
import br.com.kjfleets.entity.RouteStop;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.RouteRepository;
import br.com.kjfleets.routing.RouteAlgorithm;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Map;

import static org.hamcrest.Matchers.contains;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "kjfleets.routing.mode=road")
class RouteRoadModeTest extends IntegrationTest {

    @Autowired
    private OrderRepository orders;

    @Autowired
    private RouteRepository routes;

    @Autowired
    private TransactionTemplate tx;

    @Test
    void liveEtaFallsBackToLegsWhenRoadModeReadsStoredRoute() throws Exception {
        OrderFixtures fixtures = new OrderFixtures(mvc, json, this::bearer);
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String orderId = fixtures.createOrder(bearer(Role.DISPATCHER));
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driverId)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
        tx.executeWithoutResult(s -> {
            Order order = orders.findByPublicId(orderId).orElseThrow();
            Driver driver = order.getDriver();
            driver.setLat(-24.87);
            driver.setLng(-54.33);
            driver.setLastSeenAt(Instant.now());
            Route route = new Route();
            route.setOrder(order);
            route.setAlgorithm(RouteAlgorithm.NEAREST_NEIGHBOR);
            route.setMode("HAVERSINE");
            route.setEtaMinutes(1);
            route.setComputedAt(Instant.now());
            double[] legs = {0, 20, 10};
            StopType[] types = {StopType.START, StopType.PICKUP, StopType.DROPOFF};
            for (int i = 0; i < legs.length; i++) {
                RouteStop stop = new RouteStop();
                stop.setRoute(route);
                stop.setSeq(i);
                stop.setType(types[i]);
                stop.setPlace(i == 1 ? order.getPayload().getPickup() : i == 2 ? order.getPayload().getDropoff() : null);
                stop.setLat(-24.87);
                stop.setLng(-54.33);
                stop.setLegKm(legs[i]);
                route.getStops().add(stop);
            }
            routes.save(route);
        });
        String trackingNumber = json.readTree(mvc.perform(get("/orders/" + orderId)
                .header("Authorization", bearer(Role.ADMIN))).andReturn().getResponse().getContentAsString())
                .get("trackingNumber").asString();

        mvc.perform(get("/track/" + trackingNumber)).andExpect(status().isOk())
                .andExpect(jsonPath("$.etaMinutes").value(45));
        mvc.perform(get("/orders/" + orderId + "/route").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.etaMinutes").value(45));
    }

    @Test
    void roadModeDispatchStillWorks() throws Exception {
        OrderFixtures fixtures = new OrderFixtures(mvc, json, this::bearer);
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String orderId = fixtures.createOrder(bearer(Role.DISPATCHER));
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driverId)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());

        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DISPATCHED"));

        assertEquals("DISPATCHED", orders.findByPublicId(orderId).orElseThrow().getStatus().name());
        mvc.perform(get("/orders/" + orderId + "/route").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ROUTE_NOT_FOUND"));
        mvc.perform(get("/orders/" + orderId + "/tracking").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].code").value(contains("created", "assigned", "dispatched", "route_failed")))
                .andExpect(jsonPath("$[3].details").value("GRAPH_NOT_LOADED"));
    }
}
