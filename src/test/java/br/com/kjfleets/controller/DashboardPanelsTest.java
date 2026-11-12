package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardPanelsTest extends IntegrationTest {

    private static final String PASSWORD = "password-123";

    @Autowired
    private JdbcTemplate jdbc;

    private OrderFixtures fixtures;

    private record Customer(String bearer) {
    }

    private record Driver(String id, String username) {
    }

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private Customer registerCustomer() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        authService.register(new RegisterRequest("cust-" + suffix, PASSWORD, "Cliente " + suffix, null,
                suffix + "@mail.com"));
        AppUser user = userRepository.findByUsername("cust-" + suffix).orElseThrow();
        return new Customer("Bearer " + jwtService.generate(user));
    }

    private Driver newDriver() throws Exception {
        String id = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String body = mvc.perform(get("/drivers/" + id).header("Authorization", bearer(Role.ADMIN)))
                .andReturn().getResponse().getContentAsString();
        return new Driver(id, json.readTree(body).get("username").asString());
    }

    private void assign(String orderId, Driver driver) throws Exception {
        mvc.perform(post("/orders/" + orderId + "/assign").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("driverId", driver.id())))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
    }

    private void dispatch(String orderId) throws Exception {
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
    }

    private void activity(String orderId, Driver driver, String code) throws Exception {
        mvc.perform(post("/driver/orders/" + orderId + "/activity").with(httpBasic(driver.username(), PASSWORD))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("code", code))))
                .andExpect(status().isOk());
    }

    private String panelText(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private JsonNode panel(String path, String bearer) throws Exception {
        return json.readTree(panelText(get(path).header("Authorization", bearer)));
    }

    private JsonNode driverPanel(Driver driver) throws Exception {
        return json.readTree(panelText(get("/driver/dashboard").with(httpBasic(driver.username(), PASSWORD))));
    }

    private static List<String> ids(JsonNode list, String field) {
        List<String> values = new ArrayList<>();
        list.forEach(item -> values.add(item.get(field).asString()));
        return values;
    }

    @Test
    void eachPanelReturnsItsBlocks() throws Exception {
        JsonNode admin = panel("/dashboard/admin", bearer(Role.ADMIN));
        assertFalse(admin.get("summary").get("previous").isNull());
        assertTrue(admin.get("alertCounts").isObject());
        assertTrue(admin.get("funnel").has("byStage"));
        assertTrue(admin.get("routing").has("savedKm"));
        assertTrue(admin.get("fleet").has("availableDrivers"));

        JsonNode dispatch = panel("/dashboard/dispatch", bearer(Role.DISPATCHER));
        assertTrue(dispatch.get("queue").has("unassigned"));
        assertTrue(dispatch.get("availableDrivers").isArray());
        assertTrue(dispatch.get("counts").has("waitingOrders"));
        assertTrue(dispatch.get("alerts").isArray());

        JsonNode fleet = panel("/dashboard/fleet", bearer(Role.FLEET_MANAGER));
        assertTrue(fleet.get("performance").has("drivers"));
        assertTrue(fleet.get("fleet").has("drivers"));
        JsonNode perDay = fleet.get("sizing").get("perDay");
        assertEquals(1, perDay.size());
        assertTrue(fleet.get("sizing").has("waitingOrders"));

        Customer customer = registerCustomer();
        fixtures.createOrder(customer.bearer());
        JsonNode customerPanel = panel("/customer/dashboard", customer.bearer());
        assertEquals(1, customerPanel.get("active").size());
        assertTrue(customerPanel.get("attention").isArray());
        assertEquals(1, customerPanel.get("summary").get("created").asLong());

        assertTrue(driverPanel(newDriver()).has("gps"));
    }

    @Test
    void sizingCoversPeriodDays() throws Exception {
        JsonNode perDay = panel("/dashboard/fleet?period=7d", bearer(Role.ADMIN)).get("sizing").get("perDay");
        assertEquals(7, perDay.size());
    }

    @Test
    void panelsOnEmptyData() throws Exception {
        JsonNode customer = panel("/customer/dashboard", registerCustomer().bearer());
        assertEquals(0, customer.get("active").size());
        assertEquals(0, customer.get("attention").size());
        assertEquals(0, customer.get("recentDelivered").size());
        assertTrue(customer.get("summary").get("successRate").get("rate").isNull());

        JsonNode driver = driverPanel(newDriver());
        assertTrue(driver.get("activeOrder").isNull());
        assertEquals(0, driver.get("queue").size());
        assertEquals(0, driver.get("today").get("completed").asLong());
        assertTrue(driver.get("gps").get("lastSeenAt").isNull());
        assertFalse(driver.get("gps").get("positionValid").asBoolean());
    }

    @Test
    void customerPanelHidesOthers() throws Exception {
        Customer a = registerCustomer();
        Customer b = registerCustomer();
        String mine = fixtures.createOrder(a.bearer());
        String theirs = fixtures.createOrder(b.bearer());
        Driver driver = newDriver();
        assign(mine, driver);
        dispatch(mine);

        String text = panelText(get("/customer/dashboard").header("Authorization", a.bearer()));
        JsonNode active = json.readTree(text).get("active");
        assertEquals(List.of(mine), ids(active, "orderId"));
        assertFalse(text.contains(theirs));
        // olha só as chaves do JSON; ids e tracking aleatórios podem conter "km"
        assertFalse(java.util.regex.Pattern.compile("\"\\w*(?i:km|algorithm)\\w*\"\\s*:").matcher(text).find());
        assertEquals(1, json.readTree(text).get("summary").get("created").asLong());
        assertTrue(active.get(0).get("driverName").asString().startsWith("Motorista"));
    }

    @Test
    void customerEtaOnlyWhenEnRoute() throws Exception {
        Customer customer = registerCustomer();
        String created = fixtures.createOrder(customer.bearer());
        String order = fixtures.createOrder(customer.bearer());
        Driver driver = newDriver();
        assign(order, driver);
        dispatch(order);

        JsonNode active = panel("/customer/dashboard", customer.bearer()).get("active");
        for (JsonNode item : active) {
            assertTrue(item.get("etaMinutes").isNull(), item.get("status").asString());
        }
        assertTrue(active.get(0).get("cancellable").asBoolean() ^ active.get(1).get("cancellable").asBoolean());

        activity(order, driver, "DRIVER_ENROUTE");
        for (JsonNode item : panel("/customer/dashboard", customer.bearer()).get("active")) {
            boolean enRoute = item.get("orderId").asString().equals(order);
            assertEquals(enRoute, !item.get("etaMinutes").isNull(), item.get("orderId").asString());
        }
        assertEquals(created, ids(panel("/customer/dashboard", customer.bearer()).get("active"), "orderId").get(0));
    }

    @Test
    void customerAttentionAndDelivered() throws Exception {
        Customer customer = registerCustomer();
        String failed = fixtures.createOrder(customer.bearer());
        String stale = fixtures.createOrder(customer.bearer());
        List<String> done = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            done.add(fixtures.createOrder(customer.bearer()));
        }
        jdbc.update("UPDATE orders SET status = 'FAILED', reason = 'endereço errado', finished_at = now() "
                + "WHERE public_id = ?", failed);
        jdbc.update("UPDATE tracking_statuses SET created_at = now() - interval '1 day' "
                + "WHERE order_id = (SELECT id FROM orders WHERE public_id = ?)", stale);
        for (int i = 0; i < done.size(); i++) {
            jdbc.update("UPDATE orders SET status = 'COMPLETED', finished_at = now() - make_interval(mins => ?), "
                    + "pod_value = CASE WHEN ? = 0 THEN 'ok' END WHERE public_id = ?", i, i, done.get(i));
        }

        JsonNode body = panel("/customer/dashboard", customer.bearer());
        JsonNode failedItem = null;
        JsonNode staleItem = null;
        for (JsonNode item : body.get("attention")) {
            if (item.get("orderId").asString().equals(failed)) {
                failedItem = item;
            } else if (item.get("orderId").asString().equals(stale)) {
                staleItem = item;
            }
        }
        assertEquals("FAILED", failedItem.get("kind").asString());
        assertEquals("endereço errado", failedItem.get("reason").asString());
        assertEquals("STALE", staleItem.get("kind").asString());
        assertTrue(staleItem.get("minutesInStage").asLong() >= 1439);

        JsonNode delivered = body.get("recentDelivered");
        assertEquals(10, delivered.size());
        assertEquals(done.get(0), delivered.get(0).get("orderId").asString());
        assertTrue(delivered.get(0).get("hasPod").asBoolean());
        assertFalse(delivered.get(1).get("hasPod").asBoolean());
    }

    @Test
    void customerAttentionFailedUsesFinishedAtWindow() throws Exception {
        Customer customer = registerCustomer();
        String failed = fixtures.createOrder(customer.bearer());
        jdbc.update("UPDATE orders SET status = 'FAILED', reason = 'recusado', created_at = now() - interval '60 days', "
                + "finished_at = now() WHERE public_id = ?", failed);

        JsonNode body = panel("/customer/dashboard", customer.bearer());
        boolean found = false;
        for (JsonNode item : body.get("attention")) {
            found |= item.get("orderId").asString().equals(failed);
        }
        assertTrue(found);
    }

    @Test
    void driverPanelOwnOnly() throws Exception {
        Driver a = newDriver();
        Driver b = newDriver();
        String mine = fixtures.createOrder(bearer(Role.DISPATCHER));
        String theirs = fixtures.createOrder(bearer(Role.DISPATCHER));
        String queuedLate = fixtures.createOrder(bearer(Role.DISPATCHER));
        String queuedEarly = fixtures.createOrder(bearer(Role.DISPATCHER));
        assign(mine, a);
        assign(theirs, b);
        assign(queuedEarly, a);
        assign(queuedLate, a);
        dispatch(mine);
        dispatch(theirs);
        jdbc.update("UPDATE tracking_statuses SET created_at = now() + interval '1 minute' WHERE code = 'assigned' "
                + "AND order_id = (SELECT id FROM orders WHERE public_id = ?)", queuedLate);

        JsonNode panelA = driverPanel(a);
        assertEquals(mine, panelA.get("activeOrder").get("orderId").asString());
        assertEquals(List.of(queuedEarly, queuedLate), ids(panelA.get("queue"), "orderId"));
        assertEquals(theirs, driverPanel(b).get("activeOrder").get("orderId").asString());
        assertEquals(0, driverPanel(b).get("queue").size());
    }

    @Test
    void driverTodayIgnoresPeriod() throws Exception {
        Driver driver = newDriver();
        String today = fixtures.createOrder(bearer(Role.DISPATCHER));
        String old = fixtures.createOrder(bearer(Role.DISPATCHER));
        assign(today, driver);
        jdbc.update("UPDATE orders SET status = 'COMPLETED', finished_at = now() WHERE public_id = ?", today);
        jdbc.update("UPDATE orders SET status = 'COMPLETED', driver_id = (SELECT id FROM drivers WHERE public_id = ?), "
                + "finished_at = now() - interval '3 days' WHERE public_id = ?", driver.id(), old);

        String body = panelText(get("/driver/dashboard").param("period", "1m")
                .with(httpBasic(driver.username(), PASSWORD)));
        JsonNode json = this.json.readTree(body);
        assertEquals(1, json.get("today").get("completed").asLong());
        assertEquals("today", json.get("meta").get("period").asString());
    }

    @Test
    void driverPodPendingFollowsProof() throws Exception {
        Driver driver = newDriver();
        String required = fixtures.createOrder(bearer(Role.DISPATCHER));
        jdbc.update("UPDATE orders SET pod_required = true WHERE public_id = ?", required);
        assign(required, driver);
        dispatch(required);
        for (String code : List.of("DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS")) {
            activity(required, driver, code);
        }
        assertTrue(driverPanel(driver).get("activeOrder").get("podPending").asBoolean());

        mvc.perform(post("/driver/orders/" + required + "/pod").with(httpBasic(driver.username(), PASSWORD))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("value", "ok"))))
                .andExpect(status().isOk());
        assertFalse(driverPanel(driver).get("activeOrder").get("podPending").asBoolean());

        Driver other = newDriver();
        String optional = fixtures.createOrder(bearer(Role.DISPATCHER));
        assign(optional, other);
        dispatch(optional);
        assertFalse(driverPanel(other).get("activeOrder").get("podPending").asBoolean());
    }

    @Test
    void rolePermissionsMatrix() throws Exception {
        Customer customer = registerCustomer();
        Map<String, List<Role>> allowed = Map.of(
                "/dashboard/admin", List.of(Role.ADMIN),
                "/dashboard/dispatch", List.of(Role.ADMIN, Role.DISPATCHER),
                "/dashboard/fleet", List.of(Role.ADMIN, Role.FLEET_MANAGER));
        for (var entry : allowed.entrySet()) {
            for (Role role : List.of(Role.ADMIN, Role.DISPATCHER, Role.FLEET_MANAGER)) {
                mvc.perform(get(entry.getKey()).header("Authorization", bearer(role)))
                        .andExpect(status().is(entry.getValue().contains(role) ? 200 : 403));
            }
            mvc.perform(get(entry.getKey()).header("Authorization", customer.bearer())).andExpect(status().isForbidden());
            mvc.perform(get(entry.getKey())).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/customer/dashboard").header("Authorization", customer.bearer())).andExpect(status().isOk());
        for (Role role : List.of(Role.ADMIN, Role.DISPATCHER, Role.FLEET_MANAGER)) {
            mvc.perform(get("/customer/dashboard").header("Authorization", bearer(role)))
                    .andExpect(status().isForbidden());
        }

        Driver driver = newDriver();
        mvc.perform(get("/dashboard/admin").with(httpBasic(driver.username(), PASSWORD)))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/driver/dashboard").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/driver/dashboard").header("Authorization", customer.bearer()))
                .andExpect(status().isUnauthorized());
    }
}
