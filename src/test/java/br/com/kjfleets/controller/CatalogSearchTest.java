package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.Role;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CatalogSearchTest extends IntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManagerFactory emf;

    private OrderFixtures fixtures() {
        return new OrderFixtures(mvc, json, this::bearer);
    }

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, Role role) throws Exception {
        return mvc.perform(request.header("Authorization", bearer(role)));
    }

    private List<String> ids(ResultActions result) throws Exception {
        String response = result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> ids = new ArrayList<>();
        json.readTree(response).get("items").forEach(item -> ids.add(item.get("publicId").asString()));
        return ids;
    }

    private String newDriver(String name, String license) throws Exception {
        String username = "drv-" + unique();
        String body = json.writeValueAsString(Map.of("username", username, "password", "password-123",
                "name", name, "licenseNumber", license));
        String response = send(post("/drivers").contentType(MediaType.APPLICATION_JSON).content(body),
                Role.FLEET_MANAGER).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private String newVehicle(String plate, String type) throws Exception {
        String body = json.writeValueAsString(Map.of("plate", plate, "type", type));
        String response = send(post("/vehicles").contentType(MediaType.APPLICATION_JSON).content(body),
                Role.FLEET_MANAGER).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private String newPlace(String name, String address) throws Exception {
        String body = json.writeValueAsString(Map.of("name", name, "address", address, "lat", -24.87, "lng", -54.33));
        String response = send(post("/places").contentType(MediaType.APPLICATION_JSON).content(body),
                Role.DISPATCHER).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    @Test
    void driversQAndStatus() throws Exception {
        String tag = unique();
        String byName = newDriver("Zeca " + tag, "L-" + unique());
        String byLicense = newDriver("Outro " + unique(), "LIC-" + tag);
        String other = newDriver("Fora " + unique(), "X-" + unique());
        fixtures().createDriver(null, br.com.kjfleets.entity.DriverStatus.AVAILABLE);

        List<String> found = ids(send(get("/drivers").param("q", tag.toUpperCase()).param("limit", "100"),
                Role.DISPATCHER));
        assertTrue(found.containsAll(List.of(byName, byLicense)));
        assertTrue(!found.contains(other));

        String available = newDriver("Disp " + tag, "D-" + unique());
        send(put("/drivers/" + available).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Disp " + tag, "status", "AVAILABLE"))),
                Role.FLEET_MANAGER).andExpect(status().isOk());
        assertEquals(List.of(available), ids(send(get("/drivers").param("q", "Disp " + tag)
                .param("status", "AVAILABLE"), Role.DISPATCHER)));
        assertEquals(List.of(), ids(send(get("/drivers").param("q", "Disp " + tag).param("status", "OFFLINE"),
                Role.DISPATCHER)));

        send(get("/drivers").param("status", "NOPE"), Role.DISPATCHER).andExpect(status().isBadRequest());
    }

    @Test
    void driverByUsername() throws Exception {
        String username = "uname" + unique();
        String body = json.writeValueAsString(Map.of("username", username, "password", "password-123",
                "name", "Nome " + unique()));
        send(post("/drivers").contentType(MediaType.APPLICATION_JSON).content(body), Role.FLEET_MANAGER)
                .andExpect(status().isCreated());
        send(get("/drivers").param("q", username), Role.DISPATCHER).andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void vehiclesQAndStatus() throws Exception {
        String tag = unique().toUpperCase();
        String byPlate = newVehicle("P" + tag, "VAN");
        String byType = newVehicle("Q" + unique().toUpperCase(), "Caminhao" + tag);
        String other = newVehicle("R" + unique().toUpperCase(), "VAN");

        List<String> found = ids(send(get("/vehicles").param("q", tag.toLowerCase()).param("limit", "100"),
                Role.DISPATCHER));
        assertTrue(found.containsAll(List.of(byPlate, byType)));
        assertTrue(!found.contains(other));

        send(put("/vehicles/" + byPlate).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("plate", "P" + tag, "type", "VAN", "status", "MAINTENANCE"))),
                Role.FLEET_MANAGER).andExpect(status().isOk());
        assertEquals(List.of(byPlate), ids(send(get("/vehicles").param("q", tag).param("status", "MAINTENANCE"),
                Role.DISPATCHER)));
        send(get("/vehicles").param("status", "NOPE"), Role.DISPATCHER).andExpect(status().isBadRequest());
    }

    @Test
    void placesQ() throws Exception {
        String tag = unique();
        String byName = newPlace("Armazem " + tag, "Rua A");
        String byAddress = newPlace("Outro " + unique(), "Avenida " + tag);
        String other = newPlace("Fora " + unique(), "Rua Z");

        List<String> found = ids(send(get("/places").param("q", tag.toUpperCase()).param("limit", "100"),
                Role.FLEET_MANAGER));
        assertTrue(found.containsAll(List.of(byName, byAddress)));
        assertTrue(!found.contains(other));
    }

    @Test
    void qIsLiteral() throws Exception {
        String tag = unique();
        String literal = newPlace("50%_off " + tag, "Rua A");
        newPlace("500xoff " + tag, "Rua A");
        assertEquals(List.of(literal), ids(send(get("/places").param("q", "50%_off " + tag), Role.DISPATCHER)));
        assertEquals(List.of(), ids(send(get("/places").param("q", "%" + tag + "%"), Role.DISPATCHER)));
        assertEquals(List.of(), ids(send(get("/places").param("q", "' OR 1=1 --"), Role.DISPATCHER)));
        assertEquals(List.of(), ids(send(get("/vehicles").param("q", "%_%\\"), Role.DISPATCHER)));
        assertEquals(List.of(), ids(send(get("/drivers").param("q", "_%_%_%_%"), Role.DISPATCHER)));
    }

    @Test
    void qTooLong400() throws Exception {
        for (String path : List.of("/drivers", "/vehicles", "/places")) {
            send(get(path).param("q", "a".repeat(101)), Role.ADMIN).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        }
    }

    @Test
    void inactiveHiddenByDefault() throws Exception {
        String tag = unique();
        String driver = newDriver("Gone " + tag, "L-" + unique());
        String vehicle = newVehicle("G" + tag.toUpperCase(), "VAN");
        String place = newPlace("Gone " + tag, "Rua A");
        send(delete("/drivers/" + driver), Role.FLEET_MANAGER).andExpect(status().isNoContent());
        send(delete("/vehicles/" + vehicle), Role.FLEET_MANAGER).andExpect(status().isNoContent());
        send(delete("/places/" + place), Role.DISPATCHER).andExpect(status().isNoContent());

        assertEquals(List.of(), ids(send(get("/drivers").param("q", tag), Role.ADMIN)));
        assertEquals(List.of(), ids(send(get("/vehicles").param("q", tag), Role.ADMIN)));
        assertEquals(List.of(), ids(send(get("/places").param("q", tag), Role.ADMIN)));

        send(get("/drivers").param("q", tag).param("includeInactive", "true"), Role.ADMIN)
                .andExpect(jsonPath("$.items[0].publicId").value(driver))
                .andExpect(jsonPath("$.items[0].active").value(false));
        send(get("/vehicles").param("q", tag).param("includeInactive", "true"), Role.FLEET_MANAGER)
                .andExpect(jsonPath("$.items[0].publicId").value(vehicle))
                .andExpect(jsonPath("$.items[0].active").value(false));
        send(get("/places").param("q", tag).param("includeInactive", "true"), Role.DISPATCHER)
                .andExpect(jsonPath("$.items[0].publicId").value(place))
                .andExpect(jsonPath("$.items[0].active").value(false));
    }

    @Test
    void includeInactiveNeedsWriteRole() throws Exception {
        send(get("/drivers").param("includeInactive", "true"), Role.DISPATCHER).andExpect(status().isForbidden());
        send(get("/vehicles").param("includeInactive", "true"), Role.DISPATCHER).andExpect(status().isForbidden());
        send(get("/places").param("includeInactive", "true"), Role.FLEET_MANAGER).andExpect(status().isForbidden());
        send(get("/drivers").param("includeInactive", "false"), Role.DISPATCHER).andExpect(status().isOk());
    }

    @Test
    void reactivateDriver() throws Exception {
        String username = "drv-" + unique();
        String created = json.writeValueAsString(Map.of("username", username, "password", "password-123",
                "name", "Volta " + unique()));
        String id = body(send(post("/drivers").contentType(MediaType.APPLICATION_JSON).content(created),
                Role.FLEET_MANAGER).andExpect(status().isCreated())).get("publicId").asString();
        send(put("/drivers/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Volta", "status", "AVAILABLE"))),
                Role.FLEET_MANAGER).andExpect(status().isOk());
        send(delete("/drivers/" + id), Role.FLEET_MANAGER).andExpect(status().isNoContent());
        mvc.perform(get("/driver/me").with(httpBasic(username, "password-123"))).andExpect(status().isUnauthorized());

        send(post("/drivers/" + id + "/reactivate"), Role.DISPATCHER).andExpect(status().isForbidden());
        send(post("/drivers/" + id + "/reactivate"), Role.FLEET_MANAGER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OFFLINE"))
                .andExpect(jsonPath("$.active").value(true));
        mvc.perform(get("/driver/me").with(httpBasic(username, "password-123"))).andExpect(status().isOk());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM status_changes WHERE reason = 'reactivate' "
                + "AND subject_id = (SELECT id FROM drivers WHERE public_id = ?)", Integer.class, id));

        send(post("/drivers/" + id + "/reactivate"), Role.ADMIN).andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        send(post("/drivers/driver_zzzzzz/reactivate"), Role.ADMIN).andExpect(status().isNotFound());
    }

    @Test
    void reactivateVehicleAndPlace() throws Exception {
        String plate = "V" + unique().toUpperCase();
        String vehicle = newVehicle(plate, "VAN");
        send(delete("/vehicles/" + vehicle), Role.FLEET_MANAGER).andExpect(status().isNoContent());
        // a placa continua reservada pelo veículo inativo
        send(post("/vehicles").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("plate", plate, "type", "VAN"))), Role.FLEET_MANAGER)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PLATE_TAKEN"));
        send(post("/vehicles/" + vehicle + "/reactivate"), Role.FLEET_MANAGER)
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.plate").value(plate));
        send(post("/vehicles/" + vehicle + "/reactivate"), Role.FLEET_MANAGER).andExpect(status().isOk());

        String place = newPlace("Volta " + unique(), "Rua A");
        send(delete("/places/" + place), Role.DISPATCHER).andExpect(status().isNoContent());
        send(post("/places/" + place + "/reactivate"), Role.FLEET_MANAGER).andExpect(status().isForbidden());
        send(post("/places/" + place + "/reactivate"), Role.DISPATCHER)
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(true));
        send(get("/places/" + place), Role.DISPATCHER).andExpect(status().isOk());
    }

    @Test
    void driverHasFleets() throws Exception {
        String driver = newDriver("Frotista " + unique(), "L-" + unique());
        String fleetB = fleet("B " + unique(), driver);
        String fleetA = fleet("A " + unique(), driver);
        String gone = fleet("Z " + unique(), driver);
        send(delete("/fleets/" + gone), Role.FLEET_MANAGER).andExpect(status().isNoContent());

        JsonNode fleets = body(send(get("/drivers/" + driver), Role.DISPATCHER).andExpect(status().isOk()))
                .get("fleets");
        assertEquals(2, fleets.size());
        assertEquals(fleetA, fleets.get(0).get("publicId").asString());
        assertEquals(fleetB, fleets.get(1).get("publicId").asString());
        assertTrue(fleets.get(0).get("name").asString().startsWith("A "));
    }

    private String fleet(String name, String driver) throws Exception {
        String payload = json.writeValueAsString(Map.of("name", name, "driverIds", List.of(driver)));
        return body(send(post("/fleets").contentType(MediaType.APPLICATION_JSON).content(payload),
                Role.FLEET_MANAGER).andExpect(status().isCreated())).get("publicId").asString();
    }

    @Test
    void driverListNoNPlusOne() throws Exception {
        String tag = unique();
        List<String> drivers = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            drivers.add(newDriver("Lote " + tag, "L-" + unique()));
        }
        for (String driver : drivers) {
            fleet("F " + unique(), driver);
        }
        SessionFactory sessions = emf.unwrap(SessionFactory.class);
        sessions.getStatistics().setStatisticsEnabled(true);
        sessions.getStatistics().clear();
        send(get("/drivers").param("q", tag).param("limit", "20"), Role.DISPATCHER)
                .andExpect(jsonPath("$.items.length()").value(20))
                .andExpect(jsonPath("$.items[0].fleets.length()").value(1));
        long statements = sessions.getStatistics().getPrepareStatementCount();
        sessions.getStatistics().setStatisticsEnabled(false);
        assertTrue(statements <= 5, "statements: " + statements);
    }

    @Test
    void vehicleHasDriverName() throws Exception {
        String vehicle = newVehicle("N" + unique().toUpperCase(), "VAN");
        String name = "Condutor " + unique();
        String body = json.writeValueAsString(Map.of("username", "drv-" + unique(), "password", "password-123",
                "name", name, "vehicleId", vehicle));
        send(post("/drivers").contentType(MediaType.APPLICATION_JSON).content(body), Role.FLEET_MANAGER)
                .andExpect(status().isCreated());
        send(get("/vehicles/" + vehicle), Role.DISPATCHER).andExpect(jsonPath("$.driverName").value(name))
                .andExpect(jsonPath("$.active").value(true));
        send(get("/vehicles").param("limit", "100"), Role.DISPATCHER).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.publicId == '" + vehicle + "')].driverName").value(name));
        String free = newVehicle("O" + unique().toUpperCase(), "VAN");
        send(get("/vehicles/" + free), Role.DISPATCHER).andExpect(jsonPath("$.driverName").doesNotExist());
    }

    @Test
    void fleetStatusRowsHavePosition() throws Exception {
        String withPosition = fixtures().createDriver(fixtures().createVehicle(),
                br.com.kjfleets.entity.DriverStatus.AVAILABLE);
        String without = fixtures().createDriver(fixtures().createVehicle(),
                br.com.kjfleets.entity.DriverStatus.AVAILABLE);
        jdbc.update("UPDATE drivers SET lat = -24.86, lng = -54.33, last_seen_at = now() WHERE public_id = ?",
                withPosition);

        JsonNode drivers = body(send(get("/dashboard/fleet/status"), Role.FLEET_MANAGER)
                .andExpect(status().isOk())).get("drivers");
        JsonNode first = null;
        JsonNode second = null;
        for (JsonNode row : drivers) {
            if (row.get("driverId").asString().equals(withPosition)) {
                first = row;
            } else if (row.get("driverId").asString().equals(without)) {
                second = row;
            }
        }
        assertEquals(-24.86, first.get("lat").asDouble());
        assertEquals(-54.33, first.get("lng").asDouble());
        assertTrue(second.get("lat").isNull());
        assertTrue(second.get("lng").isNull());
    }

    @Test
    void customerById() throws Exception {
        String tag = unique();
        var customer = authService.register(new RegisterRequest("c-" + tag, "password-123", "Cli " + tag,
                "4499", "cli." + tag + "@mail.com"));

        send(get("/customers/" + customer.publicId()), Role.DISPATCHER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicId").value(customer.publicId()))
                .andExpect(jsonPath("$.name").value("Cli " + tag))
                .andExpect(jsonPath("$.phone").value("4499"))
                .andExpect(jsonPath("$.email").value("cli." + tag + "@mail.com"));
        send(get("/customers/customer_zzzzzz"), Role.ADMIN).andExpect(status().isNotFound());
        send(get("/customers/" + customer.publicId()), Role.CUSTOMER).andExpect(status().isForbidden());
    }
}
