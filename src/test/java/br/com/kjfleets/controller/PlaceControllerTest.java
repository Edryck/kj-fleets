package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PlaceControllerTest extends IntegrationTest {

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Role role) throws Exception {
        return mvc.perform(request.header("Authorization", bearer(role)));
    }

    private ResultActions createPlace(Object body, Role role) throws Exception {
        return send(post("/places").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), role);
    }

    private ResultActions updatePlace(String id, Object body, Role role) throws Exception {
        return send(put("/places/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), role);
    }

    private String createAndGetId(Map<String, Object> body) throws Exception {
        String response = createPlace(body, Role.DISPATCHER)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private Map<String, Object> placeBody(String name) {
        return Map.of("name", name, "address", "Rua A, 100", "lat", -24.862, "lng", -54.337);
    }

    @Test
    void createWithContact() throws Exception {
        createPlace(Map.of("name", "Depósito Central", "address", "Rua A, 100", "lat", -24.862,
                        "lng", -54.337, "contact", Map.of("name", "Ana")), Role.DISPATCHER)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publicId").value(matchesPattern("place_[a-z0-9]{6}")))
                .andExpect(jsonPath("$.contact.name").value("Ana"));
    }

    @Test
    void putWithoutContactRemoves() throws Exception {
        String id = createAndGetId(Map.of("name", "Depósito " + unique(), "lat", -24.862, "lng", -54.337,
                "contact", Map.of("name", "Ana")));

        updatePlace(id, placeBody("Depósito Sul " + unique()), Role.DISPATCHER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contact").value(nullValue()));
    }

    @Test
    void latOutOfRangeIs400() throws Exception {
        createPlace(Map.of("name", "Lugar", "lat", 90.1, "lng", -54.337), Role.DISPATCHER)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void crudLifecycle() throws Exception {
        String id = createAndGetId(placeBody("Lugar " + unique()));

        send(get("/places").param("limit", "100"), Role.FLEET_MANAGER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.publicId=='" + id + "')]").exists());
        send(get("/places/" + id), Role.FLEET_MANAGER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address").value("Rua A, 100"));
        send(delete("/places/" + id), Role.DISPATCHER).andExpect(status().isNoContent());
        send(get("/places/" + id), Role.ADMIN)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void rolesOnPlaces() throws Exception {
        createPlace(placeBody("Lugar " + unique()), Role.DISPATCHER).andExpect(status().isCreated());
        send(get("/places"), Role.FLEET_MANAGER).andExpect(status().isOk());
        createPlace(placeBody("Lugar " + unique()), Role.FLEET_MANAGER)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        send(get("/places"), Role.CUSTOMER).andExpect(status().isForbidden());
    }
}
