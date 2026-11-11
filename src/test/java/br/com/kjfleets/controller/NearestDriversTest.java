package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DriverRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NearestDriversTest extends IntegrationTest {

    @Autowired
    private DriverRepository drivers;

    private String a;
    private String b;
    private String c;
    private String d;
    private String e;

    private String newDriver(DriverStatus status, Double lat, Double lng) throws Exception {
        String body = mvc.perform(post("/drivers").header("Authorization", bearer(Role.FLEET_MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("username", "near-" + UUID.randomUUID(),
                                "password", "password-123", "name", "Perto"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String publicId = json.readTree(body).get("publicId").asString();
        Driver driver = drivers.findByPublicIdAndActiveTrue(publicId).orElseThrow();
        driver.setStatus(status);
        driver.setLat(lat);
        driver.setLng(lng);
        drivers.save(driver);
        return publicId;
    }

    @BeforeEach
    void seed() throws Exception {
        a = newDriver(DriverStatus.AVAILABLE, -24.8700, -54.3300);
        b = newDriver(DriverStatus.AVAILABLE, -24.9000, -54.3000);
        c = newDriver(DriverStatus.OFFLINE, -24.8650, -54.3350);
        d = newDriver(DriverStatus.AVAILABLE, null, null);
        e = newDriver(DriverStatus.AVAILABLE, -24.8621, -54.3371);
        mvc.perform(delete("/drivers/" + e).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isNoContent());
    }

    private ResultActions nearest(String query, Role role) throws Exception {
        return mvc.perform(get("/drivers/nearest" + query).header("Authorization", bearer(role)));
    }

    // o banco é compartilhado: só olha os motoristas deste teste
    private List<JsonNode> mine(ResultActions result) throws Exception {
        JsonNode all = json.readTree(result.andReturn().getResponse().getContentAsString());
        List<String> ids = List.of(a, b, c, d, e);
        List<JsonNode> found = new ArrayList<>();
        for (JsonNode item : all) {
            if (ids.contains(item.get("driver").get("publicId").asString())) {
                found.add(item);
            }
        }
        return found;
    }

    @Test
    void orderedByDistance() throws Exception {
        List<JsonNode> found = mine(nearest("?lat=-24.8620&lng=-54.3370&limit=20", Role.DISPATCHER)
                .andExpect(status().isOk()));

        assertEquals(List.of(a, b), found.stream().map(n -> n.get("driver").get("publicId").asString()).toList());
        assertEquals(1.14, found.get(0).get("distanceKm").asDouble(), 0.05);
        assertEquals(5.64, found.get(1).get("distanceKm").asDouble(), 0.05);
    }

    @Test
    void limitCuts() throws Exception {
        nearest("?lat=-24.8620&lng=-54.3370&limit=1", Role.ADMIN)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void invalidLimitIs400() throws Exception {
        nearest("?lat=-24.8620&lng=-54.3370&limit=0", Role.ADMIN)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void outOfRangeIs400() throws Exception {
        nearest("?lat=-91&lng=-54.3370", Role.ADMIN)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        nearest("?lat=0&lng=181", Role.ADMIN).andExpect(status().isBadRequest());
    }

    @Test
    void customerIs403() throws Exception {
        nearest("?lat=-24.8620&lng=-54.3370", Role.CUSTOMER).andExpect(status().isForbidden());
    }
}
