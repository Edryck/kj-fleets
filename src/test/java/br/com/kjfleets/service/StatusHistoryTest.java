package br.com.kjfleets.service;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.controller.OrderFixtures;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.entity.StatusChange;
import br.com.kjfleets.entity.StatusSubject;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.StatusChangeRepository;
import br.com.kjfleets.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StatusHistoryTest extends IntegrationTest {

    @Autowired
    private StatusChangeRepository changes;

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private VehicleRepository vehicles;

    @Autowired
    private StatusHistoryService history;

    private OrderFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private UUID driverUuid(String publicId) {
        return drivers.findByPublicIdAndActiveTrue(publicId).orElseThrow().getId();
    }

    private UUID vehicleUuid(String publicId) {
        return vehicles.findByPublicId(publicId).orElseThrow().getId();
    }

    private List<StatusChange> rows(StatusSubject type, UUID id) {
        return changes.findBySubjectTypeAndSubjectIdOrderByChangedAtAscIdAsc(type, id);
    }

    private void assertRow(StatusChange row, String from, String to, String reason, String by) {
        assertEquals(from, row.getFromStatus());
        assertEquals(to, row.getToStatus());
        assertEquals(reason, row.getReason());
        assertEquals(by, row.getChangedBy());
    }

    private ResultActions postJson(String path, Map<String, Object> payload, String bearer) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)).header("Authorization", bearer));
    }

    private String usernameOf(String driverId) throws Exception {
        return json.readTree(mvc.perform(get("/drivers/" + driverId).header("Authorization", bearer(Role.ADMIN)))
                .andReturn().getResponse().getContentAsString()).get("username").asString();
    }

    private void assignAndDispatch(String order, String driverId) throws Exception {
        postJson("/orders/" + order + "/assign", Map.of("driverId", driverId), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());
        postJson("/orders/" + order + "/dispatch", Map.of(), bearer(Role.DISPATCHER)).andExpect(status().isOk());
    }

    @Test
    void manualDriverStatusChangeRecorded() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.OFFLINE);
        mvc.perform(put("/drivers/" + driverId).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Fulano", "vehicleId", vehicleId,
                        "status", "AVAILABLE"))).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk());
        List<StatusChange> rows = rows(StatusSubject.DRIVER, driverUuid(driverId));
        assertEquals(2, rows.size());
        assertRow(rows.get(1), "OFFLINE", "AVAILABLE", "manual", "admin-user");
    }

    @Test
    void sameStatusPutRecordsNothing() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.OFFLINE);
        mvc.perform(put("/drivers/" + driverId).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Fulano", "vehicleId", vehicleId,
                        "status", "OFFLINE"))).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk());
        mvc.perform(put("/vehicles/" + vehicleId).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("plate", "SAME" + vehicleId.hashCode(), "type", "VAN")))
                .header("Authorization", bearer(Role.ADMIN))).andExpect(status().isOk());
        assertEquals(1, rows(StatusSubject.DRIVER, driverUuid(driverId)).size());
        assertEquals(1, rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId)).size());
    }

    @Test
    void manualVehicleStatusChangeRecorded() throws Exception {
        String vehicleId = fixtures.createVehicle();
        mvc.perform(put("/vehicles/" + vehicleId).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("plate", "MNT" + vehicleId.hashCode(), "type", "VAN",
                        "status", "MAINTENANCE"))).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk());
        List<StatusChange> rows = rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId));
        assertEquals(2, rows.size());
        assertRow(rows.get(1), "AVAILABLE", "MAINTENANCE", "manual", "admin-user");
    }

    @Test
    void dispatchAndFinishRecorded() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String order = fixtures.createOrder(bearer(Role.DISPATCHER));
        assignAndDispatch(order, driverId);
        List<StatusChange> driverRows = rows(StatusSubject.DRIVER, driverUuid(driverId));
        List<StatusChange> vehicleRows = rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId));
        assertEquals(3, driverRows.size());
        assertRow(driverRows.get(2), "AVAILABLE", "BUSY", "dispatch", "dispatcher-user");
        assertEquals(2, vehicleRows.size());
        assertRow(vehicleRows.get(1), "AVAILABLE", "IN_USE", "dispatch", "dispatcher-user");

        for (String code : List.of("DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED")) {
            postJson("/orders/" + order + "/activity", Map.of("code", code), bearer(Role.DISPATCHER))
                    .andExpect(status().isOk());
        }
        assertRow(rows(StatusSubject.DRIVER, driverUuid(driverId)).get(3), "BUSY", "AVAILABLE", "finish",
                "dispatcher-user");
        assertRow(rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId)).get(2), "IN_USE", "AVAILABLE", "finish",
                "dispatcher-user");
    }

    @Test
    void acceptRecordsDispatch() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String username = usernameOf(driverId);
        String order = fixtures.createOrder(bearer(Role.DISPATCHER));
        mvc.perform(post("/driver/orders/" + order + "/accept").with(httpBasic(username, "password-123")))
                .andExpect(status().isOk());
        List<StatusChange> driverRows = rows(StatusSubject.DRIVER, driverUuid(driverId));
        List<StatusChange> vehicleRows = rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId));
        assertEquals(3, driverRows.size());
        assertRow(driverRows.get(2), "AVAILABLE", "BUSY", "dispatch", username);
        assertEquals(2, vehicleRows.size());
        assertRow(vehicleRows.get(1), "AVAILABLE", "IN_USE", "dispatch", username);
    }

    @Test
    void cancelAfterDispatchRecordsFinish() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String order = fixtures.createOrder(bearer(Role.DISPATCHER));
        assignAndDispatch(order, driverId);
        postJson("/orders/" + order + "/cancel", Map.of("reason", "desistiu"), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());
        List<StatusChange> driverRows = rows(StatusSubject.DRIVER, driverUuid(driverId));
        List<StatusChange> vehicleRows = rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId));
        assertEquals(4, driverRows.size());
        assertRow(driverRows.get(3), "BUSY", "AVAILABLE", "finish", "dispatcher-user");
        assertEquals(3, vehicleRows.size());
        assertRow(vehicleRows.get(2), "IN_USE", "AVAILABLE", "finish", "dispatcher-user");
    }

    @Test
    void deleteRecorded() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        UUID driverUuid = driverUuid(driverId);
        mvc.perform(delete("/drivers/" + driverId).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isNoContent());
        List<StatusChange> driverRows = rows(StatusSubject.DRIVER, driverUuid);
        assertEquals(3, driverRows.size());
        assertRow(driverRows.get(2), "AVAILABLE", "AVAILABLE", "delete", "admin-user");

        mvc.perform(delete("/vehicles/" + vehicleId).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isNoContent());
        List<StatusChange> vehicleRows = rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId));
        assertEquals(2, vehicleRows.size());
        assertRow(vehicleRows.get(1), "AVAILABLE", "AVAILABLE", "delete", "admin-user");
    }

    @Test
    void createRecordsBaselineRow() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.OFFLINE);
        List<StatusChange> driverRows = rows(StatusSubject.DRIVER, driverUuid(driverId));
        List<StatusChange> vehicleRows = rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId));
        assertEquals(1, driverRows.size());
        assertRow(driverRows.get(0), null, "OFFLINE", "baseline", "fleet_manager-user");
        assertEquals(1, vehicleRows.size());
        assertRow(vehicleRows.get(0), null, "AVAILABLE", "baseline", "fleet_manager-user");
    }

    @Test
    void baselineIsIdempotent() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.OFFLINE);
        // simula quem existia antes do histórico
        changes.deleteAll(rows(StatusSubject.DRIVER, driverUuid(driverId)));
        changes.deleteAll(rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId)));
        history.baseline();
        history.baseline();
        List<StatusChange> driverRows = rows(StatusSubject.DRIVER, driverUuid(driverId));
        List<StatusChange> vehicleRows = rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId));
        assertEquals(1, driverRows.size());
        assertRow(driverRows.get(0), null, "OFFLINE", "baseline", "system");
        assertEquals(1, vehicleRows.size());
        assertRow(vehicleRows.get(0), null, "AVAILABLE", "baseline", "system");
    }

    @Test
    void everyStatusPathRecordsExactlyOne() throws Exception {
        String vehicleId = fixtures.createVehicle();
        String driverId = fixtures.createDriver(vehicleId, DriverStatus.AVAILABLE);
        String order = fixtures.createOrder(bearer(Role.DISPATCHER));
        assignAndDispatch(order, driverId);
        // 4 atividades, só a última libera
        for (String code : List.of("DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED")) {
            postJson("/orders/" + order + "/activity", Map.of("code", code), bearer(Role.DISPATCHER))
                    .andExpect(status().isOk());
        }
        // driver: baseline + PUT manual + dispatch + finish; vehicle: baseline + dispatch + finish
        assertEquals(4, rows(StatusSubject.DRIVER, driverUuid(driverId)).size());
        assertEquals(3, rows(StatusSubject.VEHICLE, vehicleUuid(vehicleId)).size());
    }
}
