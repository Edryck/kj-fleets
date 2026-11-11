package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.DriverRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;

class DriverControllerTest extends IntegrationTest {

    @Autowired
    private DriverRepository drivers;

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Role role) throws Exception {
        return mvc.perform(request.header("Authorization", bearer(role)));
    }

    private ResultActions createDriver(String username, String vehicleId, Role role) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("username", username);
        body.put("password", "password-123");
        body.put("name", "Motorista " + username);
        body.put("vehicleId", vehicleId);
        return send(post("/drivers").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), role);
    }

    private ResultActions updateDriver(String id, String vehicleId, String driverStatus) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Novo nome");
        body.put("vehicleId", vehicleId);
        body.put("status", driverStatus);
        return send(put("/drivers/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)), Role.FLEET_MANAGER);
    }

    private String idOf(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString()).get("publicId").asString();
    }

    private String newVehicle() throws Exception {
        String body = send(post("/vehicles").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("plate", "D" + unique().toUpperCase(), "type", "VAN"))),
                Role.FLEET_MANAGER).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("publicId").asString();
    }

    private String newDriver(String vehicleId) throws Exception {
        return idOf(createDriver("drv-" + unique(), vehicleId, Role.FLEET_MANAGER).andExpect(status().isCreated()));
    }

    @Test
    void createDriverWithVehicle() throws Exception {
        String vehicleId = newVehicle();
        String username = "drv-" + unique();

        createDriver(username, vehicleId, Role.FLEET_MANAGER)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OFFLINE"))
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.vehicle.publicId").value(vehicleId));
    }

    @Test
    void driverUsernameTakenIs409() throws Exception {
        createDriver("admin", null, Role.FLEET_MANAGER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @Test
    void vehicleAlreadyLinkedIs409() throws Exception {
        String vehicleId = newVehicle();
        newDriver(vehicleId);

        createDriver("drv-" + unique(), vehicleId, Role.FLEET_MANAGER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
    }

    @Test
    void maintenanceVehicleIs409() throws Exception {
        String vehicleId = newVehicle();
        send(put("/vehicles/" + vehicleId).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("plate", "M" + unique().toUpperCase(), "type", "VAN",
                        "status", "MAINTENANCE"))), Role.FLEET_MANAGER).andExpect(status().isOk());

        createDriver("drv-" + unique(), vehicleId, Role.FLEET_MANAGER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
    }

    @Test
    void failedVehicleLinkRollsBackUser() throws Exception {
        String vehicleId = newVehicle();
        newDriver(vehicleId);
        String username = "drv-" + unique();

        createDriver(username, vehicleId, Role.FLEET_MANAGER).andExpect(status().isConflict());

        createDriver(username, null, Role.FLEET_MANAGER).andExpect(status().isCreated());
    }

    @Test
    void unknownVehicleIs404() throws Exception {
        createDriver("drv-" + unique(), "vehicle_zzzzzz", Role.FLEET_MANAGER)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void keepingSameVehicleIsAllowed() throws Exception {
        String vehicleId = newVehicle();
        String id = newDriver(vehicleId);

        updateDriver(id, vehicleId, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicle.publicId").value(vehicleId));
    }

    @Test
    void updateWithoutVehicleUnlinks() throws Exception {
        String id = newDriver(newVehicle());

        updateDriver(id, null, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicle").doesNotExist());
    }

    @Test
    void manualBusyIs400() throws Exception {
        String id = newDriver(null);

        updateDriver(id, null, "BUSY")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void setAvailable() throws Exception {
        String id = newDriver(null);

        updateDriver(id, null, "AVAILABLE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"));
    }

    @Test
    void deleteBusyIs409() throws Exception {
        String id = newDriver(null);
        Driver driver = drivers.findByPublicIdAndActiveTrue(id).orElseThrow();
        driver.setStatus(DriverStatus.BUSY);
        drivers.save(driver);

        send(delete("/drivers/" + id), Role.FLEET_MANAGER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
    }

    @Test
    void deleteReleasesVehicleAndUser() throws Exception {
        String vehicleId = newVehicle();
        String username = "drv-" + unique();
        String id = idOf(createDriver(username, vehicleId, Role.FLEET_MANAGER).andExpect(status().isCreated()));

        send(delete("/drivers/" + id), Role.FLEET_MANAGER).andExpect(status().isNoContent());

        send(get("/drivers/" + id), Role.ADMIN).andExpect(status().isNotFound());
        send(get("/vehicles/" + vehicleId), Role.ADMIN)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.driverId").doesNotExist());
        mvc.perform(get("/driver/me").with(httpBasic(username, "password-123")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteVehicleUnlinksDriver() throws Exception {
        String vehicleId = newVehicle();
        String id = newDriver(vehicleId);
        send(get("/vehicles/" + vehicleId), Role.ADMIN).andExpect(jsonPath("$.driverId").value(id));

        send(delete("/vehicles/" + vehicleId), Role.FLEET_MANAGER).andExpect(status().isNoContent());

        send(get("/drivers/" + id), Role.ADMIN)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vehicle").doesNotExist());
    }

    @Test
    void listAndPaginate() throws Exception {
        newDriver(null);
        newDriver(null);

        send(get("/drivers").param("limit", "1"), Role.DISPATCHER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)));
    }

    @Test
    void rolesOnDrivers() throws Exception {
        send(get("/drivers"), Role.DISPATCHER).andExpect(status().isOk());
        createDriver("drv-" + unique(), null, Role.DISPATCHER).andExpect(status().isForbidden());
        createDriver("drv-" + unique(), null, Role.FLEET_MANAGER).andExpect(status().isCreated());
        send(get("/drivers"), Role.CUSTOMER).andExpect(status().isForbidden());
    }
}
