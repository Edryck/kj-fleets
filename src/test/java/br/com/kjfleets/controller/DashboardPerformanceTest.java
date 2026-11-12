package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.dto.DashboardDtos.DriverPerformance;
import br.com.kjfleets.dto.DashboardDtos.DriversPerformance;
import br.com.kjfleets.dto.DashboardDtos.MonthPoint;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.DashboardQueries;
import br.com.kjfleets.service.DashboardPeriod;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardPerformanceTest extends IntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DashboardQueries queries;

    @Autowired
    private DashboardProperties props;

    private OrderFixtures fixtures;

    @Autowired
    private CustomerRepository customers;

    private record Registered(String username, String bearer) {
    }

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private Registered registerCustomer() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        authService.register(new RegisterRequest("cust-" + suffix, "password-123", "Cliente " + suffix, null,
                suffix + "@mail.com"));
        AppUser user = userRepository.findByUsername("cust-" + suffix).orElseThrow();
        return new Registered("cust-" + suffix, "Bearer " + jwtService.generate(user));
    }

    private String driver() throws Exception {
        return fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
    }

    private JsonNode call(String path, Role role, String... params) throws Exception {
        var request = get(path).header("Authorization", bearer(role));
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        String body = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private DashboardPeriod window(Instant from, Instant to) {
        return new DashboardPeriod("custom", props.timezone(), from, to);
    }

    private DriverPerformance row(DriversPerformance result, String driverId) {
        return result.drivers().stream().filter(r -> r.driverId().equals(driverId)).findFirst().orElse(null);
    }

    // pedido do motorista já finalizado "minutesAgo" minutos atrás
    private String finishedOrder(String driverId, String bearer, String status, int minutesAgo) throws Exception {
        String id = fixtures.createOrder(bearer);
        jdbc.update("UPDATE orders SET status = ?, driver_id = (SELECT id FROM drivers WHERE public_id = ?),"
                        + " dispatched_at = now() - make_interval(mins => ?), finished_at = now() - make_interval(mins => ?)"
                        + " WHERE public_id = ?",
                status, driverId, minutesAgo + 30, minutesAgo, id);
        return id;
    }

    private void track(String orderId, String code, String details, int minutesAgo) {
        jdbc.update("INSERT INTO tracking_statuses (id, order_id, status, code, details, created_at) "
                        + "SELECT gen_random_uuid(), id, status, ?, ?, now() - make_interval(mins => ?) "
                        + "FROM orders WHERE public_id = ?", code, details, minutesAgo, orderId);
    }

    private void route(String orderId, String algorithm, double totalKm, double baselineKm, double savingsPct) {
        jdbc.update("INSERT INTO routes (id, order_id, algorithm, mode, total_km, baseline_km, savings_pct, eta_minutes,"
                        + " computed_at) SELECT gen_random_uuid(), id, ?, 'AUTO', ?, ?, ?, 10, now() FROM orders"
                        + " WHERE public_id = ?", algorithm, totalKm, baselineKm, savingsPct, orderId);
    }

    private void statusChange(String driverId, String to, Instant at) {
        jdbc.update("INSERT INTO status_changes (id, subject_type, subject_id, to_status, changed_at, changed_by, reason)"
                + " SELECT gen_random_uuid(), 'DRIVER', id, ?, ?, 'teste', 'teste' FROM drivers WHERE public_id = ?",
                to, java.sql.Timestamp.from(at), driverId);
    }

    private void clearHistory(String driverId) {
        jdbc.update("DELETE FROM status_changes WHERE subject_type = 'DRIVER' AND subject_id ="
                + " (SELECT id FROM drivers WHERE public_id = ?)", driverId);
    }

    @Test
    void performanceCountsPerDriver() throws Exception {
        String busy = driver();
        String other = driver();
        finishedOrder(busy, bearer(Role.DISPATCHER), "COMPLETED", 10);
        finishedOrder(busy, bearer(Role.DISPATCHER), "COMPLETED", 20);
        finishedOrder(busy, bearer(Role.DISPATCHER), "FAILED", 30);
        finishedOrder(other, bearer(Role.DISPATCHER), "COMPLETED", 40);
        finishedOrder(busy, bearer(Role.DISPATCHER), "COMPLETED", 60 * 24 * 40);

        DriversPerformance result = queries.driversPerformance(window(Instant.now().minus(1, ChronoUnit.DAYS), Instant.now()), null, Instant.now());
        var row = row(result, busy);
        assertEquals(2, row.completed());
        assertEquals(1, row.failed());
        assertEquals(3, row.successRate().n());
        assertEquals(2.0 / 3, row.successRate().rate(), 1e-9);
        assertEquals(1, row(result, other).completed());
        assertTrue(result.drivers().indexOf(row) <= result.drivers().indexOf(row(result, other)));

        JsonNode http = call("/dashboard/drivers/performance", Role.FLEET_MANAGER, "period", "today");
        assertNotNull(http.get("drivers"));
        assertNotNull(http.get("idleDriverIds"));
    }

    @Test
    void busyPctClipsAtWindowEdges() throws Exception {
        Instant from = Instant.now().minus(10, ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS);
        Instant to = from.plus(4, ChronoUnit.HOURS);
        String clipped = driver();
        String noHistory = driver();
        String onlyBefore = driver();
        String onlyOffline = driver();
        clearHistory(clipped);
        clearHistory(noHistory);
        clearHistory(onlyBefore);
        clearHistory(onlyOffline);
        statusChange(clipped, "AVAILABLE", from.minus(2, ChronoUnit.HOURS));
        statusChange(clipped, "BUSY", from.plus(1, ChronoUnit.HOURS));
        statusChange(clipped, "AVAILABLE", from.plus(3, ChronoUnit.HOURS));
        statusChange(onlyBefore, "BUSY", from.minus(5, ChronoUnit.HOURS));
        statusChange(onlyOffline, "OFFLINE", from.minus(5, ChronoUnit.HOURS));

        DriversPerformance result = queries.driversPerformance(window(from, to), null, Instant.now());
        assertEquals(50.0, row(result, clipped).busyPct());
        assertNull(row(result, noHistory).busyPct());
        assertEquals(100.0, row(result, onlyBefore).busyPct());
        assertNull(row(result, onlyOffline).busyPct());
        result.drivers().stream().filter(r -> r.busyPct() != null)
                .forEach(r -> assertTrue(r.busyPct() >= 0 && r.busyPct() <= 100));
    }

    @Test
    void dispatchToArrivedAverage() throws Exception {
        String driver = driver();
        String a = finishedOrder(driver, bearer(Role.DISPATCHER), "COMPLETED", 5);
        String b = finishedOrder(driver, bearer(Role.DISPATCHER), "COMPLETED", 5);
        track(a, "dispatched", null, 60);
        track(a, "arrived", null, 50);
        track(b, "dispatched", null, 60);
        track(b, "arrived", null, 40);

        var row = row(queries.driversPerformance(window(Instant.now().minus(1, ChronoUnit.DAYS), Instant.now()), null, Instant.now()), driver);
        assertEquals(15.0, row.avgDispatchToArrivedMinutes(), 0.01);
    }

    @Test
    void idleDriversListed() throws Exception {
        String worker = driver();
        String idle = driver();
        finishedOrder(worker, bearer(Role.DISPATCHER), "COMPLETED", 10);

        DriversPerformance result = queries.driversPerformance(window(Instant.now().minus(1, ChronoUnit.DAYS), Instant.now()), null, Instant.now());
        assertTrue(result.idleDriverIds().contains(idle));
        assertTrue(!result.idleDriverIds().contains(worker));
    }

    @Test
    void savingsTotalsAndByAlgorithm() throws Exception {
        Instant from = Instant.now().minus(1, ChronoUnit.DAYS);
        var before = queries.routingSavings(window(from, Instant.now().plusSeconds(60)), Instant.now());
        String driver = driver();
        route(finishedOrder(driver, bearer(Role.DISPATCHER), "COMPLETED", 10), "TWO_OPT", 8, 10, 20);
        route(finishedOrder(driver, bearer(Role.DISPATCHER), "COMPLETED", 10), "TWO_OPT", 6, 10, 40);
        route(finishedOrder(driver, bearer(Role.DISPATCHER), "FAILED", 10), "TWO_OPT", 1, 100, 99);
        route(finishedOrder(driver, bearer(Role.DISPATCHER), "COMPLETED", 60 * 24 * 40), "HELD_KARP", 1, 100, 99);

        var after = queries.routingSavings(window(from, Instant.now().plusSeconds(60)), Instant.now());
        var twoOptBefore = before.byAlgorithm().get("TWO_OPT");
        var twoOpt = after.byAlgorithm().get("TWO_OPT");
        assertEquals(before.routes() + 2, after.routes());
        assertEquals(before.plannedKm() + 14, after.plannedKm(), 1e-6);
        assertEquals(before.baselineKm() + 20, after.baselineKm(), 1e-6);
        assertEquals(before.savedKm() + 6, after.savedKm(), 1e-6);
        assertEquals((twoOptBefore == null ? 0 : twoOptBefore.routes()) + 2, twoOpt.routes());

        JsonNode http = call("/dashboard/routing/savings", Role.DISPATCHER, "period", "today");
        assertNotNull(http.get("byAlgorithm"));
    }

    @Test
    void batchDispatchPct() throws Exception {
        String driver = driver();
        Instant from = Instant.now().minus(1, ChronoUnit.HOURS);
        var before = queries.routingSavings(window(from, Instant.now().plusSeconds(60)), Instant.now()).batchDispatchPct();
        String batch = finishedOrder(driver, bearer(Role.DISPATCHER), "DISPATCHED", 5);
        String manual = finishedOrder(driver, bearer(Role.DISPATCHER), "DISPATCHED", 5);
        track(batch, "assigned", "Fulano (ABC1234) lote", 40);
        track(manual, "assigned", "Fulano (ABC1234)", 40);
        // reatribuição manual depois do lote vale: conta o último assigned
        track(manual, "assigned", "Fulano (ABC1234) lote", 35);
        track(manual, "assigned", "Beltrano (XYZ9876)", 30);

        var after = queries.routingSavings(window(from, Instant.now().plusSeconds(60)), Instant.now()).batchDispatchPct();
        assertEquals(before.n() + 2, after.n());
        long hitsBefore = Math.round((before.rate() == null ? 0 : before.rate()) * before.n());
        assertEquals(hitsBefore + 1, Math.round(after.rate() * after.n()));
    }

    @Test
    void yearlyHasThirteenZeroFilledMonths() throws Exception {
        JsonNode body = call("/dashboard/trends/yearly", Role.ADMIN);
        JsonNode months = body.get("months");
        assertEquals(13, months.size());
        String previous = "";
        for (JsonNode month : months) {
            assertTrue(month.get("month").asString().compareTo(previous) > 0);
            previous = month.get("month").asString();
        }
        assertEquals(java.time.YearMonth.now(props.timezone()).toString(), previous);

        List<MonthPoint> empty = queries.yearly(Instant.now(), props.timezone(), UUID.randomUUID());
        assertEquals(13, empty.size());
        assertTrue(empty.stream().allMatch(p -> p.created() == 0 && p.completed() == 0));
        assertNull(empty.get(0).successRate().rate());
    }

    @Test
    void yearlyMonthBoundaryInTimezone() throws Exception {
        Registered customer = registerCustomer();
        UUID customerId = customers.findByUserUsername(customer.username()).orElseThrow().getId();
        String id = fixtures.createOrder(customer.bearer());
        jdbc.update("UPDATE orders SET created_at = '2026-11-01T02:00:00Z' WHERE public_id = ?", id);

        List<MonthPoint> months = queries.yearly(Instant.parse("2026-11-12T12:00:00Z"), props.timezone(), customerId);
        assertEquals("2025-11", months.get(0).month());
        assertEquals("2026-11", months.get(12).month());
        assertEquals(1, months.stream().filter(m -> m.month().equals("2026-10")).findFirst().orElseThrow().created());
        assertEquals(0, months.stream().filter(m -> m.month().equals("2026-11")).findFirst().orElseThrow().created());
    }

    @Test
    void yearlyCustomerOwnOnly() throws Exception {
        Registered mine = registerCustomer();
        Registered stranger = registerCustomer();
        fixtures.createOrder(mine.bearer());
        fixtures.createOrder(stranger.bearer());

        var request = get("/dashboard/trends/yearly").header("Authorization", mine.bearer());
        JsonNode body = json.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString());
        assertTrue(body.get("byDriver").isNull());
        JsonNode current = body.get("months").get(12);
        assertEquals(1, current.get("created").asLong());
        assertTrue(current.get("savedKm").isNull());
        assertTrue(current.get("avgSavingsPct").isNull());
        assertTrue(current.get("avgCycleMinutes").isNull());

        JsonNode manager = call("/dashboard/trends/yearly", Role.FLEET_MANAGER);
        assertTrue(manager.get("byDriver").isArray());
    }

    @Test
    void permissions() throws Exception {
        mvc.perform(get("/dashboard/drivers/performance").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/drivers/performance").header("Authorization", bearer(Role.CUSTOMER)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/routing/savings").header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/trends/yearly").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/drivers/performance").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk());
    }
}
