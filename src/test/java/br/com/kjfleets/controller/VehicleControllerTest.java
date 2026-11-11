package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.repository.VehicleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class VehicleControllerTest extends IntegrationTest {

    @Autowired
    private VehicleRepository vehicles;

    private String plate() {
        return "T" + UUID.randomUUID().toString().substring(0, 7).toUpperCase();
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Role role) throws Exception {
        return mvc.perform(request.header("Authorization", bearer(role)));
    }

    private ResultActions createVehicle(Object body, Role role) throws Exception {
        return send(post("/vehicles").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), role);
    }

    private ResultActions updateVehicle(String id, Object body, Role role) throws Exception {
        return send(put("/vehicles/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), role);
    }

    private String createAndGetId(String plate, String type) throws Exception {
        String body = createVehicle(Map.of("plate", plate, "type", type), Role.FLEET_MANAGER)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("publicId").asString();
    }

    private int totalVehicles() throws Exception {
        String body = send(get("/vehicles").param("limit", "1"), Role.DISPATCHER)
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("total").asInt();
    }

    @Test
    void crudLifecycle() throws Exception {
        String plate = plate();
        String body = createVehicle(Map.of("plate", plate, "type", "VAN"), Role.FLEET_MANAGER)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publicId").value(matchesPattern("vehicle_[a-z0-9]{6}")))
                .andExpect(jsonPath("$.plate").value(plate))
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).get("publicId").asString();

        send(get("/vehicles").param("limit", "100"), Role.DISPATCHER)
                .andExpect(jsonPath("$.items[?(@.publicId=='" + id + "')]").exists());
        send(get("/vehicles/" + id), Role.DISPATCHER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plate").value(plate));
        updateVehicle(id, Map.of("plate", plate, "type", "TRUCK", "status", "AVAILABLE"), Role.FLEET_MANAGER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("TRUCK"));
        send(delete("/vehicles/" + id), Role.FLEET_MANAGER).andExpect(status().isNoContent());
        send(get("/vehicles/" + id), Role.ADMIN)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        send(delete("/vehicles/" + id), Role.FLEET_MANAGER)
                .andExpect(status().isNotFound());
    }

    @Test
    void listPaginates() throws Exception {
        int before = totalVehicles();
        for (int i = 0; i < 3; i++) {
            createAndGetId(plate(), "VAN");
        }

        send(get("/vehicles").param("limit", "2").param("offset", String.valueOf(before + 2)), Role.DISPATCHER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total").value(before + 3))
                .andExpect(jsonPath("$.limit").value(2))
                .andExpect(jsonPath("$.offset").value(before + 2));
    }

    @Test
    void duplicatePlateIs409() throws Exception {
        String plate = plate();
        createAndGetId(plate, "VAN");

        createVehicle(Map.of("plate", plate.toLowerCase() + " ", "type", "VAN"), Role.FLEET_MANAGER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLATE_TAKEN"));
    }

    @Test
    void deletedPlateStaysTaken() throws Exception {
        String plate = plate();
        String id = createAndGetId(plate, "VAN");
        send(delete("/vehicles/" + id), Role.FLEET_MANAGER).andExpect(status().isNoContent());

        createVehicle(Map.of("plate", plate, "type", "VAN"), Role.FLEET_MANAGER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLATE_TAKEN"));
    }

    @Test
    void manualInUseIs400() throws Exception {
        String plate = plate();
        String id = createAndGetId(plate, "VAN");

        updateVehicle(id, Map.of("plate", plate, "type", "VAN", "status", "IN_USE"), Role.FLEET_MANAGER)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void inUseCannotChangeStatus() throws Exception {
        String plate = plate();
        String id = createAndGetId(plate, "VAN");
        Vehicle vehicle = vehicles.findByPublicIdAndActiveTrue(id).orElseThrow();
        vehicle.setStatus(VehicleStatus.IN_USE);
        vehicles.save(vehicle);

        updateVehicle(id, Map.of("plate", plate, "type", "VAN", "status", "MAINTENANCE"), Role.FLEET_MANAGER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
        send(delete("/vehicles/" + id), Role.FLEET_MANAGER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
    }

    @Test
    void rolesOnVehicles() throws Exception {
        send(get("/vehicles"), Role.DISPATCHER).andExpect(status().isOk());
        createVehicle(Map.of("plate", plate(), "type", "VAN"), Role.DISPATCHER)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        createVehicle(Map.of("plate", plate(), "type", "VAN"), Role.FLEET_MANAGER)
                .andExpect(status().isCreated());
        send(get("/vehicles"), Role.CUSTOMER).andExpect(status().isForbidden());
    }
}
