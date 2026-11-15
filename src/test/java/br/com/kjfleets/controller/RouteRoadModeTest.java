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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// arquivo inexistente de propósito: o grafo nunca carrega e tudo cai na linha reta marcada
@TestPropertySource(properties = {"kjfleets.routing.mode=road",
        "kjfleets.routing.osm-file=target/missing.osm.pbf", "kjfleets.routing.graph-dir=target/graph-missing"})
class RouteRoadModeTest extends IntegrationTest {

    @Autowired
    private OrderRepository orders;

    @Autowired
    private RouteRepository routes;

    @Autowired
    private TransactionTemplate tx;

    @Test
    void liveEtaUsesStraightLegForDriverToNextStop() throws Exception {
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
            // o dispatch já calculou uma rota; troca pela de pernas conhecidas
            routes.findByOrder(order).ifPresent(routes::delete);
            routes.flush();
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
                .andExpect(jsonPath("$.etaMinutes").value(15));
        mvc.perform(get("/orders/" + orderId + "/route").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.etaMinutes").value(15));
    }

    @Test
    void roadModeWithoutFile() throws Exception {
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
                .andExpect(status().isOk()).andExpect(jsonPath("$.mode").value("ROAD"))
                .andExpect(jsonPath("$.fallbackLegs").value(1))
                .andExpect(jsonPath("$.stops[1].distanceSource").value("HAVERSINE"))
                .andExpect(jsonPath("$.stops[1].path").doesNotExist());
        mvc.perform(get("/graph/status").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.loaded").value(false))
                .andExpect(jsonPath("$.reason").exists());
        mvc.perform(get("/graph/route?fromLat=-24.86&fromLng=-54.33&toLat=-24.87&toLng=-54.32")
                        .header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("GRAPH_NOT_LOADED"));
    }
}
