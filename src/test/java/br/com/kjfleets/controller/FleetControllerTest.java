package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FleetControllerTest extends IntegrationTest {

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Role role) throws Exception {
        return mvc.perform(request.header("Authorization", bearer(role)));
    }

    private ResultActions createFleet(Object body, Role role) throws Exception {
        return send(post("/fleets").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), role);
    }

    private ResultActions updateFleet(String id, Object body, Role role) throws Exception {
        return send(put("/fleets/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), role);
    }

    private String newDriver() throws Exception {
        Map<String, Object> body = Map.of("username", "drv-" + unique(), "password", "password-123",
                "name", "Motorista " + unique());
        String response = send(post("/drivers").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), Role.FLEET_MANAGER)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private String createAndGetId(List<String> driverIds) throws Exception {
        String response = createFleet(Map.of("name", "Frota " + unique(), "driverIds", driverIds),
                Role.FLEET_MANAGER)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    @Test
    void createWithDrivers() throws Exception {
        String d1 = newDriver();
        String d2 = newDriver();

        createFleet(Map.of("name", "Frota Centro", "driverIds", List.of(d1, d2)), Role.FLEET_MANAGER)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publicId").value(matchesPattern("fleet_[a-z0-9]{6}")))
                .andExpect(jsonPath("$.name").value("Frota Centro"))
                .andExpect(jsonPath("$.drivers.length()").value(2));
    }

    @Test
    void duplicateDriversCollapse() throws Exception {
        String d1 = newDriver();

        createFleet(Map.of("name", "Frota", "driverIds", List.of(d1, d1)), Role.FLEET_MANAGER)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.drivers.length()").value(1));
    }

    @Test
    void putReplacesDrivers() throws Exception {
        String d1 = newDriver();
        String d2 = newDriver();
        String id = createAndGetId(List.of(d1));

        updateFleet(id, Map.of("name", "Frota Norte", "driverIds", List.of(d2)), Role.FLEET_MANAGER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Frota Norte"))
                .andExpect(jsonPath("$.drivers.length()").value(1))
                .andExpect(jsonPath("$.drivers[0].publicId").value(d2));
    }

    @Test
    void unknownDriverIs404() throws Exception {
        createFleet(Map.of("name", "Frota", "driverIds", List.of("driver_zzzzzz")), Role.FLEET_MANAGER)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void deletedDriverLeavesFleet() throws Exception {
        String d2 = newDriver();
        String id = createAndGetId(List.of(d2));

        send(delete("/drivers/" + d2), Role.FLEET_MANAGER).andExpect(status().isNoContent());

        send(get("/fleets/" + id), Role.DISPATCHER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.drivers").isEmpty());
    }

    @Test
    void crudLifecycle() throws Exception {
        String d1 = newDriver();
        String id = createAndGetId(List.of(d1));

        send(get("/fleets").param("limit", "100"), Role.DISPATCHER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.publicId=='" + id + "' && @.driverCount==1)]").exists());
        send(get("/fleets/" + id), Role.DISPATCHER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.drivers[0].publicId").value(d1));
        send(delete("/fleets/" + id), Role.FLEET_MANAGER).andExpect(status().isNoContent());
        send(get("/fleets/" + id), Role.ADMIN)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        send(delete("/fleets/" + id), Role.FLEET_MANAGER).andExpect(status().isNotFound());
    }

    @Test
    void rolesOnFleets() throws Exception {
        send(get("/fleets"), Role.DISPATCHER).andExpect(status().isOk());
        createFleet(Map.of("name", "Frota"), Role.DISPATCHER)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        createFleet(Map.of("name", "Frota"), Role.FLEET_MANAGER).andExpect(status().isCreated());
        send(get("/fleets"), Role.CUSTOMER).andExpect(status().isForbidden());
    }
}
