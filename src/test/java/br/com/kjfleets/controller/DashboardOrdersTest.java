package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.dto.DashboardDtos.StaleOrder;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.DashboardQueries;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardOrdersTest extends IntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DashboardQueries queries;

    @Autowired
    private DashboardProperties props;

    @Autowired
    private CustomerRepository customers;

    private OrderFixtures fixtures;

    private record Registered(String customerId, String bearer) {
    }

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private Registered registerCustomer() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        var response = authService.register(new RegisterRequest("cust-" + suffix, "password-123",
                "Cliente " + suffix, null, suffix + "@mail.com"));
        AppUser user = userRepository.findByUsername("cust-" + suffix).orElseThrow();
        return new Registered(response.publicId(), "Bearer " + jwtService.generate(user));
    }

    private void setStatus(String orderId, String status) {
        jdbc.update("UPDATE orders SET status = ? WHERE public_id = ?", status, orderId);
    }

    private void setReason(String orderId, String reason) {
        jdbc.update("UPDATE orders SET reason = ? WHERE public_id = ?", reason, orderId);
    }

    // troca o histórico do pedido por uma linha só, "minutesAgo" minutos atrás
    private void stage(String orderId, String status, String code, int minutesAgo) {
        setStatus(orderId, status);
        jdbc.update("DELETE FROM tracking_statuses WHERE order_id = (SELECT id FROM orders WHERE public_id = ?)",
                orderId);
        event(orderId, status, code, minutesAgo);
    }

    private void event(String orderId, String status, String code, int minutesAgo) {
        jdbc.update("INSERT INTO tracking_statuses (id, order_id, status, code, created_at) "
                        + "SELECT gen_random_uuid(), id, ?, ?, now() - make_interval(mins => ?) "
                        + "FROM orders WHERE public_id = ?",
                status, code, minutesAgo, orderId);
    }

    private JsonNode summary(String bearer, String... params) throws Exception {
        var request = get("/dashboard/orders/summary").header("Authorization", bearer);
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        String body = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private String cancel(String orderId, String bearer) throws Exception {
        mvc.perform(post("/orders/" + orderId + "/cancel").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", "teste"))).header("Authorization", bearer))
                .andExpect(status().isOk());
        return orderId;
    }

    @Test
    void summaryCountsAndRates() throws Exception {
        Registered c = registerCustomer();
        for (int i = 0; i < 3; i++) {
            setStatus(fixtures.createOrder(c.bearer()), "COMPLETED");
        }
        String failed = fixtures.createOrder(c.bearer());
        setStatus(failed, "FAILED");
        setReason(failed, "Endereço errado");
        setStatus(fixtures.createOrder(c.bearer()), "CANCELLED");

        JsonNode s = summary(c.bearer(), "period", "7d");
        assertEquals(5, s.get("created").asLong());
        assertEquals(3, s.get("completed").asLong());
        assertEquals(1, s.get("failed").asLong());
        assertEquals(1, s.get("cancelled").asLong());
        assertEquals(0.6, s.get("successRate").get("rate").asDouble(), 1e-9);
        assertEquals(5, s.get("successRate").get("n").asLong());
        assertEquals("Endereço errado", s.get("topFailureReasons").get(0).get("reason").asString());
        assertEquals("7d", s.get("meta").get("period").asString());
        assertTrue(s.get("podRate").isNull());
    }

    @Test
    void emptyDataGivesZerosAndNullRates() throws Exception {
        Registered c = registerCustomer();
        JsonNode s = summary(c.bearer());
        assertEquals(0, s.get("created").asLong());
        assertEquals(0, s.get("cancelledByCustomer").asLong());
        for (String rate : List.of("successRate", "failureRate", "cancelRate")) {
            assertTrue(s.get(rate).get("rate").isNull());
            assertEquals(0, s.get(rate).get("n").asLong());
        }
        assertTrue(s.get("avgWaitMinutes").isNull());
        assertTrue(s.get("avgCycleMinutes").isNull());
        assertEquals(0, s.get("topFailureReasons").size());
    }

    @Test
    void cancelledByCustomerVsStaff() throws Exception {
        Registered c = registerCustomer();
        cancel(fixtures.createOrder(c.bearer()), c.bearer());
        cancel(fixtures.createOrder(c.bearer()), bearer(Role.DISPATCHER));

        JsonNode s = summary(c.bearer());
        assertEquals(2, s.get("cancelled").asLong());
        assertEquals(1, s.get("cancelledByCustomer").asLong());
        assertEquals(1, s.get("cancelledByStaff").asLong());
    }

    @Test
    void cancelledWithoutActorIsUnknown() throws Exception {
        Registered c = registerCustomer();
        String id = fixtures.createOrder(c.bearer());
        stage(id, "CANCELLED", "cancelled", 5);

        JsonNode s = summary(c.bearer());
        assertEquals(1, s.get("cancelled").asLong());
        assertEquals(1, s.get("cancelledByUnknown").asLong());
        assertEquals(0, s.get("cancelledByCustomer").asLong());
        assertEquals(0, s.get("cancelledByStaff").asLong());
    }

    @Test
    void topFailureReasonsLimitedToFive() throws Exception {
        Registered c = registerCustomer();
        // motivo r0 aparece 3 vezes, r1 duas, r2..r5 uma
        int[] counts = {3, 2, 1, 1, 1, 1};
        for (int r = 0; r < counts.length; r++) {
            for (int k = 0; k < counts[r]; k++) {
                String id = fixtures.createOrder(c.bearer());
                setStatus(id, "FAILED");
                setReason(id, "r" + r);
            }
        }
        JsonNode reasons = summary(c.bearer()).get("topFailureReasons");
        assertEquals(5, reasons.size());
        assertEquals("r0", reasons.get(0).get("reason").asString());
        assertEquals(3, reasons.get(0).get("count").asLong());
        assertEquals("r1", reasons.get(1).get("reason").asString());
    }

    @Test
    void averagesAndPodRateForAdmin() throws Exception {
        long before = summary(bearer(Role.ADMIN)).get("podRate").get("n").asLong();
        Registered c = registerCustomer();
        String id = fixtures.createOrder(c.bearer());
        jdbc.update("UPDATE orders SET status = 'COMPLETED', pod_required = true, pod_value = 'ok', "
                + "dispatched_at = created_at + interval '10 minutes', "
                + "finished_at = created_at + interval '40 minutes' WHERE public_id = ?", id);
        String noPod = fixtures.createOrder(c.bearer());
        jdbc.update("UPDATE orders SET status = 'COMPLETED', pod_required = true WHERE public_id = ?", noPod);

        JsonNode own = summary(c.bearer());
        assertEquals(10.0, own.get("avgWaitMinutes").asDouble(), 0.01);
        assertEquals(30.0, own.get("avgCycleMinutes").asDouble(), 0.01);
        JsonNode admin = summary(bearer(Role.ADMIN));
        assertTrue(admin.get("podRate").get("n").asLong() >= before + 2);
        assertNotNull(admin.get("podRate").get("rate"));
    }

    @Test
    void compareOnlyForAdmin() throws Exception {
        assertFalse(summary(bearer(Role.ADMIN), "compare", "true").get("previous").isNull());
        assertTrue(summary(bearer(Role.DISPATCHER), "compare", "true").get("previous").isNull());
        assertTrue(summary(bearer(Role.ADMIN)).get("previous").isNull());
    }

    @Test
    void customerSeesOnlyOwn() throws Exception {
        Registered a = registerCustomer();
        Registered b = registerCustomer();
        fixtures.createOrder(a.bearer());
        fixtures.createOrder(b.bearer());
        fixtures.createOrder(b.bearer());

        assertEquals(1, summary(a.bearer()).get("created").asLong());
        assertEquals(2, summary(b.bearer()).get("created").asLong());
    }

    private List<StaleOrder> stale(Registered c) {
        UUID customerId = customers.findByPublicId(c.customerId()).orElseThrow().getId();
        return queries.staleOrders(props, Instant.now(), customerId);
    }

    @Test
    void staleByStageLimits() throws Exception {
        Registered c = registerCustomer();
        String over = fixtures.createOrder(c.bearer());
        String under = fixtures.createOrder(c.bearer());
        String enroute = fixtures.createOrder(c.bearer());
        stage(over, "DISPATCHED", "dispatched", 16);
        stage(under, "DISPATCHED", "dispatched", 14);
        stage(enroute, "DRIVER_ENROUTE", "driver_enroute", 61);

        List<StaleOrder> result = stale(c);
        assertEquals(List.of(enroute, over), result.stream().map(StaleOrder::orderId).toList());
        assertEquals("DRIVER_ENROUTE", result.get(0).stage());
        assertEquals(60, result.get(0).limitMin());
        assertEquals(61, result.get(0).minutesInStage());
        assertEquals("DISPATCHED", result.get(1).stage());
    }

    @Test
    void unassignedAndAssignedUseOwnLimits() throws Exception {
        Registered c = registerCustomer();
        String unassigned = fixtures.createOrder(c.bearer());
        String assigned = fixtures.createOrder(c.bearer());
        stage(unassigned, "CREATED", "created", 31);
        stage(assigned, "CREATED", "created", 16);
        // pedido atribuído: tem motorista, mas segue CREATED
        String vehicle = fixtures.createVehicle();
        fixtures.createDriver(vehicle, DriverStatus.AVAILABLE);
        jdbc.update("UPDATE orders SET driver_id = (SELECT id FROM drivers LIMIT 1) WHERE public_id = ?", assigned);

        Map<String, String> stages = new HashMap<>();
        stale(c).forEach(s -> stages.put(s.orderId(), s.stage()));
        assertEquals("UNASSIGNED", stages.get(unassigned));
        assertEquals("ASSIGNED", stages.get(assigned));
    }

    @Test
    void nonStatusEventDoesNotResetClock() throws Exception {
        Registered c = registerCustomer();
        String id = fixtures.createOrder(c.bearer());
        stage(id, "DISPATCHED", "dispatched", 20);
        event(id, "DISPATCHED", "pod_registered", 1);
        event(id, "DISPATCHED", "stop_completed", 1);

        List<StaleOrder> result = stale(c);
        assertEquals(1, result.size());
        assertTrue(result.get(0).minutesInStage() >= 19);
    }

    @Test
    void funnelPermissions() throws Exception {
        for (Role role : List.of(Role.FLEET_MANAGER, Role.CUSTOMER)) {
            mvc.perform(get("/dashboard/orders/funnel").header("Authorization", bearer(role)))
                    .andExpect(status().isForbidden());
        }
        Registered c = registerCustomer();
        String id = fixtures.createOrder(c.bearer());
        stage(id, "DISPATCHED", "dispatched", 30);

        for (Role role : List.of(Role.ADMIN, Role.DISPATCHER)) {
            String body = mvc.perform(get("/dashboard/orders/funnel").header("Authorization", bearer(role)))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            JsonNode funnel = json.readTree(body);
            assertEquals("now", funnel.get("meta").get("period").asString());
            assertTrue(funnel.get("meta").get("from").isNull());
            for (String stage : List.of("UNASSIGNED", "ASSIGNED", "DISPATCHED", "DRIVER_ENROUTE", "ARRIVED",
                    "IN_PROGRESS")) {
                assertTrue(funnel.get("byStage").get(stage).asLong() >= 0);
                assertTrue(funnel.get("staleByStage").get(stage).asLong() >= 0);
            }
            assertTrue(funnel.get("byStage").get("DISPATCHED").asLong() >= 1);
            assertTrue(funnel.get("staleByStage").get("DISPATCHED").asLong() >= 1);
        }
    }

    @Test
    void invalidPeriodIs400() throws Exception {
        mvc.perform(get("/dashboard/orders/summary").param("period", "2d")
                .header("Authorization", bearer(Role.ADMIN))).andExpect(status().isBadRequest());
    }
}
