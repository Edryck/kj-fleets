package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

import java.util.Map;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TrackTest extends IntegrationTest {

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private String trackingNumberOf(String orderId) throws Exception {
        String body = mvc.perform(get("/orders/" + orderId).header("Authorization", bearer(Role.ADMIN)))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("trackingNumber").asString();
    }

    private String dispatchedOrder() throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String orderId = fixtures.createOrder(bearer(Role.DISPATCHER));
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driverId)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
        return orderId;
    }

    @Test
    void publicTimeline() throws Exception {
        String trackingNumber = trackingNumberOf(dispatchedOrder());

        mvc.perform(get("/track/" + trackingNumber))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingNumber").value(trackingNumber))
                .andExpect(jsonPath("$.status").value("DISPATCHED"))
                .andExpect(jsonPath("$.etaMinutes").value(notNullValue()))
                .andExpect(jsonPath("$.timeline[*].code").value(contains("created", "dispatched")));
    }

    @Test
    void noPersonalData() throws Exception {
        String trackingNumber = trackingNumberOf(dispatchedOrder());

        String body = mvc.perform(get("/track/" + trackingNumber)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode root = json.readTree(body);
        for (String key : new String[]{"customer", "driver", "plate", "address", "lat", "lng", "details",
                "reason", "notes", "meta"}) {
            assertFalse(body.contains("\"" + key + "\""), "vazou " + key);
        }
        root.get("timeline").forEach(event -> assertFalse(event.has("details")));
    }

    @Test
    void unknownCodeIs404() throws Exception {
        mvc.perform(get("/track/ZZZZZZZZZZ")).andExpect(status().isNotFound());
    }
}
