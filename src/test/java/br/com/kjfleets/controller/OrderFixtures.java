package br.com.kjfleets.controller;

import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderFixtures {

    private final MockMvc mvc;
    private final ObjectMapper json;
    private final Function<Role, String> bearer;

    OrderFixtures(MockMvc mvc, ObjectMapper json, Function<Role, String> bearer) {
        this.mvc = mvc;
        this.json = json;
        this.bearer = bearer;
    }

    private static String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private String send(MockHttpServletRequestBuilder request, Role role, int expected) throws Exception {
        String body = mvc.perform(request.contentType(MediaType.APPLICATION_JSON).header("Authorization",
                bearer.apply(role))).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("publicId").asString();
    }

    String createOrder(String bearer) throws Exception {
        Map<String, Object> point = Map.of("name", "Ponto " + unique(), "lat", -24.87, "lng", -54.33);
        String body = json.writeValueAsString(Map.of("pickup", point, "dropoff", point));
        String response = mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON).content(body)
                .header("Authorization", bearer)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    String createVehicle() throws Exception {
        String body = json.writeValueAsString(Map.of("plate", "T" + unique().toUpperCase(), "type", "VAN"));
        return send(post("/vehicles").content(body), Role.FLEET_MANAGER, 201);
    }

    String createDriver(String vehicleId, DriverStatus driverStatus) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("username", "drv-" + unique());
        body.put("password", "password-123");
        body.put("name", "Motorista " + unique());
        body.put("vehicleId", vehicleId);
        String id = send(post("/drivers").content(json.writeValueAsString(body)), Role.FLEET_MANAGER, 201);
        if (driverStatus != DriverStatus.OFFLINE) {
            body.put("status", driverStatus.name());
            send(put("/drivers/" + id).content(json.writeValueAsString(body)), Role.FLEET_MANAGER, 200);
        }
        return id;
    }
}
