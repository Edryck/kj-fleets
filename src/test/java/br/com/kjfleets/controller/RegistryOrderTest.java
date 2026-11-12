package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RegistryOrderTest extends IntegrationTest {

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private String assignedOrder(String driverId) throws Exception {
        String orderId = fixtures.createOrder(bearer(Role.DISPATCHER));
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driverId)))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
        return orderId;
    }

    private void expectUnassigned(String orderId, String details) throws Exception {
        mvc.perform(get("/orders/" + orderId + "/tracking").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$[*].code").value(hasItem("unassigned")))
                .andExpect(jsonPath("$[?(@.code=='unassigned')].details").value(hasItem(details)));
    }

    @Test
    void deletingDriverUnassignsCreatedOrders() throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String orderId = assignedOrder(driverId);

        mvc.perform(delete("/drivers/" + driverId).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isNoContent());

        mvc.perform(get("/orders/" + orderId).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.driver").value(nullValue()))
                .andExpect(jsonPath("$.vehicle").value(nullValue()));
        expectUnassigned(orderId, "motorista desativado");
    }

    @Test
    void dispatchAfterDriverDeletedIs422() throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String orderId = assignedOrder(driverId);
        mvc.perform(delete("/drivers/" + driverId).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isNoContent());

        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_DISPATCH_REQUIRES_DRIVER"));
    }

    @Test
    void deletingVehicleUnassignsVehicleOnly() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String orderId = assignedOrder(driverId);

        mvc.perform(delete("/vehicles/" + vehicleId).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isNoContent());

        mvc.perform(get("/orders/" + orderId).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$.driver.publicId").value(driverId))
                .andExpect(jsonPath("$.vehicle").value(nullValue()));
        expectUnassigned(orderId, "veículo desativado");
    }

    @Test
    void deletingBusyDriverStill409() throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String orderId = assignedOrder(driverId);
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());

        mvc.perform(delete("/drivers/" + driverId).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
    }
}
