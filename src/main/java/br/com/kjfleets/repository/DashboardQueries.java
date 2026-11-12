package br.com.kjfleets.repository;

import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.dto.DashboardDtos.AlertType;
import br.com.kjfleets.dto.DashboardDtos.AlgorithmSavings;
import br.com.kjfleets.dto.DashboardDtos.DayPoint;
import br.com.kjfleets.dto.DashboardDtos.DriverMonth;
import br.com.kjfleets.dto.DashboardDtos.DriverPerformance;
import br.com.kjfleets.dto.DashboardDtos.DriverQueued;
import br.com.kjfleets.dto.DashboardDtos.DriverRow;
import br.com.kjfleets.dto.DashboardDtos.DriverToday;
import br.com.kjfleets.dto.DashboardDtos.DriversPerformance;
import br.com.kjfleets.dto.DashboardDtos.MonthPoint;
import br.com.kjfleets.dto.DashboardDtos.Rate;
import br.com.kjfleets.dto.DashboardDtos.RoutingSavings;
import br.com.kjfleets.dto.DashboardDtos.QueueItem;
import br.com.kjfleets.dto.DashboardDtos.ReasonCount;
import br.com.kjfleets.dto.DashboardDtos.StaleOrder;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.service.DashboardPeriod;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
public class DashboardQueries {

    public static final List<String> STAGES = List.of("UNASSIGNED", "ASSIGNED", "DISPATCHED", "DRIVER_ENROUTE",
            "ARRIVED", "IN_PROGRESS");

    // CREATED vira UNASSIGNED ou ASSIGNED conforme tenha motorista
    private static final String STAGE_CASE = "CASE WHEN o.status = 'CREATED' AND o.driver_id IS NULL THEN 'UNASSIGNED' "
            + "WHEN o.status = 'CREATED' THEN 'ASSIGNED' ELSE o.status END";

    private static final String ACTIVE = "o.status IN ('CREATED', 'DISPATCHED', 'DRIVER_ENROUTE', 'ARRIVED', 'IN_PROGRESS')";

    // só eventos que mudam o status contam; pod_registered, stop_completed etc. não zeram o relógio
    private static final String LAST_STAGE_EVENT = "(SELECT DISTINCT ON (t.order_id) t.order_id, t.created_at"
            + " FROM tracking_statuses t JOIN orders a ON a.id = t.order_id AND a.status IN ('CREATED', 'DISPATCHED',"
            + " 'DRIVER_ENROUTE', 'ARRIVED', 'IN_PROGRESS')"
            + " WHERE t.code IN ('created', 'dispatched', 'driver_enroute', 'arrived', 'in_progress')"
            + " ORDER BY t.order_id, t.created_at DESC)";

    private static final String AVAILABLE_NOW = "d.status = 'AVAILABLE' AND v.active AND v.status = 'AVAILABLE'"
            + " AND d.lat IS NOT NULL AND d.lng IS NOT NULL AND d.last_seen_at >= :freshSince";

    public record Counts(long created, long completed, long failed, long cancelled, long cancelledByCustomer, long cancelledByStaff,
                         long podHits, long podN, Double avgWaitMinutes, Double avgCycleMinutes) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public DashboardQueries(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static Double minutes(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private static MapSqlParameterSource window(DashboardPeriod period, UUID customerId) {
        return new MapSqlParameterSource("from", utc(period.from())).addValue("to", utc(period.to()))
                .addValue("customerId", customerId);
    }

    private static String customerFilter(UUID customerId) {
        return customerId == null ? "" : " AND o.customer_id = :customerId";
    }

    private static String driverFleetFilter(UUID fleetId) {
        return fleetId == null ? "" : " AND d.id IN (SELECT df.driver_id FROM driver_fleet df WHERE df.fleet_id = :fleetId)";
    }

    public Counts ordersCounts(DashboardPeriod period, UUID customerId) {
        String sql = "SELECT count(*) AS created,"
                + " count(*) FILTER (WHERE o.status = 'COMPLETED') AS completed,"
                + " count(*) FILTER (WHERE o.status = 'FAILED') AS failed,"
                + " count(*) FILTER (WHERE o.status = 'CANCELLED') AS cancelled,"
                + " count(*) FILTER (WHERE o.status = 'CANCELLED' AND EXISTS (SELECT 1 FROM tracking_statuses t"
                + "   WHERE t.order_id = o.id AND t.code = 'cancelled' AND t.actor_role = 'CUSTOMER')) AS by_customer,"
                + " count(*) FILTER (WHERE o.status = 'CANCELLED' AND EXISTS (SELECT 1 FROM tracking_statuses t"
                + "   WHERE t.order_id = o.id AND t.code = 'cancelled'"
                + "   AND t.actor_role IN ('ADMIN', 'DISPATCHER', 'FLEET_MANAGER'))) AS by_staff,"
                + " count(*) FILTER (WHERE o.status = 'COMPLETED' AND o.pod_required AND o.pod_value IS NOT NULL) AS pod_hits,"
                + " count(*) FILTER (WHERE o.status = 'COMPLETED' AND o.pod_required) AS pod_n,"
                + " avg(extract(epoch FROM o.dispatched_at - o.created_at) / 60) AS avg_wait,"
                + " avg(extract(epoch FROM o.finished_at - o.dispatched_at) / 60)"
                + "   FILTER (WHERE o.status = 'COMPLETED') AS avg_cycle"
                + " FROM orders o WHERE o.created_at >= :from AND o.created_at < :to" + customerFilter(customerId);
        return jdbc.queryForObject(sql, window(period, customerId), (rs, i) -> new Counts(rs.getLong("created"),
                rs.getLong("completed"), rs.getLong("failed"), rs.getLong("cancelled"), rs.getLong("by_customer"), rs.getLong("by_staff"),
                rs.getLong("pod_hits"), rs.getLong("pod_n"), minutes(rs.getBigDecimal("avg_wait")),
                minutes(rs.getBigDecimal("avg_cycle"))));
    }

    public List<ReasonCount> topFailureReasons(DashboardPeriod period, UUID customerId) {
        String sql = "SELECT o.reason, count(*) AS total FROM orders o WHERE o.status = 'FAILED' AND o.reason IS NOT NULL"
                + " AND o.created_at >= :from AND o.created_at < :to" + customerFilter(customerId)
                + " GROUP BY o.reason ORDER BY total DESC, o.reason LIMIT 5";
        return jdbc.query(sql, window(period, customerId),
                (rs, i) -> new ReasonCount(rs.getString("reason"), rs.getLong("total")));
    }

    public Map<String, Long> countByStage() {
        Map<String, Long> result = new LinkedHashMap<>();
        STAGES.forEach(stage -> result.put(stage, 0L));
        jdbc.query("SELECT " + STAGE_CASE + " AS stage, count(*) AS total FROM orders o WHERE " + ACTIVE
                        + " GROUP BY 1",
                (RowCallbackHandler) rs -> {
                    result.put(rs.getString("stage"), rs.getLong("total"));
                });
        return result;
    }

    private static String staleRows(UUID customerId) {
        return "SELECT s.public_id, s.tracking_number, s.stage, s.limit_min, s.seconds,"
                + " floor(s.seconds / 60)::bigint AS minutes FROM ("
                + "  SELECT o.public_id, o.tracking_number, stage.name AS stage, stage.limit_min,"
                + "   extract(epoch FROM (:now - COALESCE(l.created_at, o.created_at))) AS seconds"
                + "  FROM orders o"
                + "  LEFT JOIN " + LAST_STAGE_EVENT + " l ON l.order_id = o.id"
                + "  CROSS JOIN LATERAL (SELECT " + STAGE_CASE + " AS name, CASE"
                + "   WHEN o.status = 'CREATED' AND o.driver_id IS NULL THEN :unassigned"
                + "   WHEN o.status = 'CREATED' THEN :assigned"
                + "   WHEN o.status = 'DISPATCHED' THEN :dispatched"
                + "   WHEN o.status = 'DRIVER_ENROUTE' THEN :enroute"
                + "   WHEN o.status = 'ARRIVED' THEN :arrived"
                + "   ELSE :inProgress END AS limit_min) stage"
                + "  WHERE " + ACTIVE + customerFilter(customerId) + ") s"
                + " WHERE s.seconds > s.limit_min * 60";
    }

    private static MapSqlParameterSource staleParams(DashboardProperties p, Instant now, UUID customerId) {
        return new MapSqlParameterSource("now", utc(now))
                .addValue("customerId", customerId)
                .addValue("unassigned", p.staleUnassignedMin()).addValue("assigned", p.staleAssignedMin())
                .addValue("dispatched", p.staleDispatchedMin()).addValue("enroute", p.staleEnrouteMin())
                .addValue("arrived", p.staleArrivedMin()).addValue("inProgress", p.staleInProgressMin());
    }

    private static final RowMapper<StaleOrder> STALE_MAPPER = (rs, i) -> new StaleOrder(rs.getString("public_id"),
            rs.getString("tracking_number"), rs.getString("stage"), rs.getLong("minutes"), rs.getInt("limit_min"));

    // sem limite: o funil conta por etapa em cima da lista inteira
    public List<StaleOrder> staleOrders(DashboardProperties p, Instant now, UUID customerId) {
        return jdbc.query(staleRows(customerId) + " ORDER BY s.seconds DESC", staleParams(p, now, customerId),
                STALE_MAPPER);
    }

    public List<StaleOrder> staleTop(DashboardProperties p, Instant now, int limit) {
        return jdbc.query(staleRows(null) + " ORDER BY s.seconds DESC LIMIT :limit",
                staleParams(p, now, null).addValue("limit", limit), STALE_MAPPER);
    }

    public long staleCount(DashboardProperties p, Instant now) {
        return jdbc.queryForObject("SELECT count(*) FROM (" + staleRows(null) + ") c", staleParams(p, now, null),
                Long.class);
    }

    // stage é UNASSIGNED ou ASSIGNED; o mais antigo na etapa vem primeiro
    public List<QueueItem> queueItems(String stage, Instant now, int limit) {
        String sql = "SELECT o.public_id, o.tracking_number, pickup.name AS pickup_name, dropoff.name AS dropoff_name,"
                + " floor(extract(epoch FROM (:now - COALESCE(l.created_at, o.created_at))) / 60)::bigint AS minutes"
                + " FROM orders o"
                + " LEFT JOIN payloads pl ON pl.order_id = o.id"
                + " LEFT JOIN places pickup ON pickup.id = pl.pickup_id"
                + " LEFT JOIN places dropoff ON dropoff.id = pl.dropoff_id"
                + " LEFT JOIN " + LAST_STAGE_EVENT + " l ON l.order_id = o.id"
                + " WHERE " + ACTIVE + " AND " + STAGE_CASE + " = :stage"
                + " ORDER BY COALESCE(l.created_at, o.created_at), o.public_id LIMIT :limit";
        MapSqlParameterSource params = new MapSqlParameterSource("now", utc(now)).addValue("stage", stage)
                .addValue("limit", limit);
        return jdbc.query(sql, params, (rs, i) -> new QueueItem(rs.getString("public_id"),
                rs.getString("tracking_number"), rs.getString("pickup_name"), rs.getString("dropoff_name"),
                rs.getLong("minutes")));
    }

    public Map<String, Long> driversByStatus(UUID fleetId) {
        return countStatuses("SELECT d.status AS status, count(*) AS total FROM drivers d WHERE d.active"
                + driverFleetFilter(fleetId) + " GROUP BY d.status", fleetId, DriverStatus.values());
    }

    public Map<String, Long> vehiclesByStatus(UUID fleetId) {
        String filter = fleetId == null ? "" : " AND v.id IN (SELECT d.vehicle_id FROM drivers d"
                + " JOIN driver_fleet df ON df.driver_id = d.id WHERE df.fleet_id = :fleetId)";
        return countStatuses("SELECT v.status AS status, count(*) AS total FROM vehicles v WHERE v.active" + filter
                + " GROUP BY v.status", fleetId, VehicleStatus.values());
    }

    private Map<String, Long> countStatuses(String sql, UUID fleetId, Enum<?>[] values) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (Enum<?> value : values) {
            result.put(value.name(), 0L);
        }
        jdbc.query(sql, new MapSqlParameterSource("fleetId", fleetId),
                (RowCallbackHandler) rs -> result.put(rs.getString("status"), rs.getLong("total")));
        return result;
    }

    // availableOnly: AVAILABLE com veículo disponível e posição recente (mesma regra de "disponível" do painel)
    public List<DriverRow> driverRows(UUID fleetId, Instant freshSince, boolean availableOnly) {
        String sql = "SELECT d.public_id, d.name, d.status, v.plate, v.status AS vehicle_status,"
                + " (SELECT o.public_id FROM orders o WHERE o.driver_id = d.id"
                + "   AND o.status IN ('DISPATCHED', 'DRIVER_ENROUTE', 'ARRIVED', 'IN_PROGRESS')"
                + "   ORDER BY o.created_at, o.public_id LIMIT 1) AS active_order,"
                + " (SELECT count(*) FROM orders o WHERE o.driver_id = d.id AND o.status = 'CREATED') AS queue_size,"
                + " d.last_seen_at, (d.last_seen_at IS NULL OR d.last_seen_at < :freshSince) AS ping_stale, d.lat, d.lng"
                + " FROM drivers d LEFT JOIN vehicles v ON v.id = d.vehicle_id"
                + " WHERE d.active" + driverFleetFilter(fleetId) + (availableOnly ? " AND " + AVAILABLE_NOW : "")
                + " ORDER BY d.name, d.public_id";
        MapSqlParameterSource params = new MapSqlParameterSource("freshSince", utc(freshSince))
                .addValue("fleetId", fleetId);
        return jdbc.query(sql, params, (rs, i) -> {
            Timestamp seen = rs.getTimestamp("last_seen_at");
            return new DriverRow(rs.getString("public_id"), rs.getString("name"), rs.getString("status"),
                    rs.getString("plate"), rs.getString("vehicle_status"), rs.getString("active_order"),
                    rs.getLong("queue_size"), seen == null ? null : seen.toInstant(), rs.getBoolean("ping_stale"),
                    (Double) rs.getObject("lat"), (Double) rs.getObject("lng"));
        });
    }

    // tempo BUSY / (AVAILABLE + BUSY) do status_changes, cortado em [from, to]; a última linha antes de from
    // entra como estado inicial porque o intervalo dela é recortado em from
    public DriversPerformance driversPerformance(DashboardPeriod period, UUID fleetId, Instant now) {
        String sql = "WITH ord AS ("
                + "  SELECT o.driver_id,"
                + "   count(*) FILTER (WHERE o.status = 'COMPLETED' AND o.finished_at >= :from AND o.finished_at < :to) AS completed,"
                + "   count(*) FILTER (WHERE o.status = 'FAILED' AND o.finished_at >= :from AND o.finished_at < :to) AS failed,"
                + "   count(*) FILTER (WHERE o.dispatched_at >= :from AND o.dispatched_at < :to) AS orders"
                + "  FROM orders o WHERE o.driver_id IS NOT NULL AND (o.finished_at >= :from OR o.dispatched_at >= :from)"
                + "  GROUP BY o.driver_id),"
                + " disp AS ("
                + "  SELECT o.driver_id, avg(extract(epoch FROM a.t - d.t) / 60) AS minutes"
                + "  FROM orders o"
                + "  JOIN LATERAL (SELECT max(t.created_at) AS t FROM tracking_statuses t"
                + "   WHERE t.order_id = o.id AND t.code = 'dispatched') d ON true"
                + "  JOIN LATERAL (SELECT min(t.created_at) AS t FROM tracking_statuses t"
                + "   WHERE t.order_id = o.id AND t.code = 'arrived' AND t.created_at >= d.t) a ON true"
                + "  WHERE o.driver_id IS NOT NULL AND (o.finished_at >= :from OR o.finished_at IS NULL) AND a.t >= :from AND a.t < :to GROUP BY o.driver_id),"
                + " spans AS ("
                + "  SELECT s.subject_id, s.to_status, extract(epoch FROM (LEAST(COALESCE(s.next_at, :to), :to)"
                + "   - GREATEST(s.changed_at, :from))) AS secs"
                + "  FROM (SELECT c.subject_id, c.to_status, c.changed_at,"
                + "   LEAD(c.changed_at) OVER (PARTITION BY c.subject_id ORDER BY c.changed_at, c.id) AS next_at"
                + "   FROM status_changes c WHERE c.subject_type = 'DRIVER' AND c.changed_at < :to) s),"
                + " busy AS ("
                + "  SELECT subject_id,"
                + "   sum(secs) FILTER (WHERE to_status = 'BUSY') AS busy_secs,"
                + "   sum(secs) FILTER (WHERE to_status IN ('AVAILABLE', 'BUSY')) AS working_secs"
                + "  FROM spans WHERE secs > 0 GROUP BY subject_id)"
                + " SELECT d.public_id, d.name, COALESCE(ord.completed, 0) AS completed, COALESCE(ord.failed, 0) AS failed,"
                + " COALESCE(ord.orders, 0) AS orders, disp.minutes,"
                + " round(busy.busy_secs / NULLIF(busy.working_secs, 0) * 100, 1) AS busy_pct"
                + " FROM drivers d LEFT JOIN ord ON ord.driver_id = d.id LEFT JOIN disp ON disp.driver_id = d.id"
                + " LEFT JOIN busy ON busy.subject_id = d.id"
                + " WHERE d.active" + driverFleetFilter(fleetId)
                + " ORDER BY completed DESC, d.name, d.public_id";
        MapSqlParameterSource params = window(period, null).addValue("fleetId", fleetId);
        List<DriverPerformance> drivers = jdbc.query(sql, params, (rs, i) -> new DriverPerformance(
                rs.getString("public_id"), rs.getString("name"), rs.getLong("completed"), rs.getLong("failed"),
                Rate.of(rs.getLong("completed"), rs.getLong("completed") + rs.getLong("failed")),
                minutes(rs.getBigDecimal("minutes")), minutes(rs.getBigDecimal("busy_pct")), rs.getLong("orders")));
        List<String> idle = drivers.stream().filter(d -> d.completed() == 0).map(DriverPerformance::driverId).toList();
        return new DriversPerformance(period.meta(now), drivers, idle);
    }

    public RoutingSavings routingSavings(DashboardPeriod period, Instant now) {
        MapSqlParameterSource params = window(period, null);
        Map<String, AlgorithmSavings> byAlgorithm = new LinkedHashMap<>();
        double[] totals = new double[4]; // rotas, planejado, base, soma dos percentuais
        jdbc.query("SELECT r.algorithm, count(*) AS routes, sum(r.total_km) AS planned, sum(r.baseline_km) AS baseline,"
                        + " sum(r.savings_pct) AS pct FROM routes r JOIN orders o ON o.id = r.order_id"
                        + " WHERE o.status = 'COMPLETED' AND o.finished_at >= :from AND o.finished_at < :to"
                        + " GROUP BY r.algorithm ORDER BY r.algorithm", params, (RowCallbackHandler) rs -> {
                    long routes = rs.getLong("routes");
                    double planned = rs.getDouble("planned");
                    double baseline = rs.getDouble("baseline");
                    double pct = rs.getDouble("pct");
                    byAlgorithm.put(rs.getString("algorithm"),
                            new AlgorithmSavings(routes, baseline - planned, pct / routes));
                    totals[0] += routes;
                    totals[1] += planned;
                    totals[2] += baseline;
                    totals[3] += pct;
                });
        long[] batch = jdbc.queryForObject("SELECT count(*) AS n, count(*) FILTER (WHERE a.details LIKE '% lote') AS hits"
                + " FROM orders o LEFT JOIN LATERAL (SELECT t.details FROM tracking_statuses t"
                + "  WHERE t.order_id = o.id AND t.code = 'assigned' ORDER BY t.created_at DESC LIMIT 1) a ON true"
                + " WHERE o.dispatched_at >= :from AND o.dispatched_at < :to", params,
                (rs, i) -> new long[]{rs.getLong("n"), rs.getLong("hits")});
        long routes = (long) totals[0];
        return new RoutingSavings(period.meta(now), routes, totals[1], totals[2], totals[2] - totals[1],
                routes == 0 ? null : totals[3] / routes, byAlgorithm, Rate.of(batch[1], batch[0]));
    }

    // 13 meses (12 fechados + o atual) no fuso do painel, zerados quando vazios; coorte pela criação do pedido
    private static final String MONTHS = "WITH m AS (SELECT to_char(g, 'YYYY-MM') AS month, g AT TIME ZONE :zone AS s,"
            + " (g + interval '1 month') AT TIME ZONE :zone AS e FROM generate_series("
            + " date_trunc('month', CAST(:now AS timestamptz) AT TIME ZONE :zone) - interval '12 months',"
            + " date_trunc('month', CAST(:now AS timestamptz) AT TIME ZONE :zone), interval '1 month') g)";

    public List<MonthPoint> yearly(Instant now, java.time.ZoneId zone, UUID customerId) {
        String sql = MONTHS + " SELECT m.month, count(o.id) AS created,"
                + " count(o.id) FILTER (WHERE o.status = 'COMPLETED') AS completed,"
                + " count(o.id) FILTER (WHERE o.status = 'FAILED') AS failed,"
                + " count(o.id) FILTER (WHERE o.status = 'CANCELLED') AS cancelled,"
                + " avg(extract(epoch FROM o.finished_at - o.dispatched_at) / 60) FILTER (WHERE o.status = 'COMPLETED') AS cycle,"
                + " sum(r.baseline_km - r.total_km) AS saved, avg(r.savings_pct) AS pct"
                + " FROM m LEFT JOIN orders o ON o.created_at >= m.s AND o.created_at < m.e" + customerFilter(customerId)
                + " LEFT JOIN routes r ON r.order_id = o.id AND o.status = 'COMPLETED'"
                + " GROUP BY m.month ORDER BY m.month";
        MapSqlParameterSource params = new MapSqlParameterSource("now", utc(now)).addValue("zone", zone.getId())
                .addValue("customerId", customerId);
        return jdbc.query(sql, params, (rs, i) -> new MonthPoint(rs.getString("month"), rs.getLong("created"),
                rs.getLong("completed"), rs.getLong("failed"), rs.getLong("cancelled"),
                Rate.of(rs.getLong("completed"), rs.getLong("completed") + rs.getLong("failed") + rs.getLong("cancelled")),
                minutes(rs.getBigDecimal("cycle")), minutes(rs.getBigDecimal("saved")), minutes(rs.getBigDecimal("pct"))));
    }

    public List<DriverMonth> completedByDriverMonth(Instant now, java.time.ZoneId zone) {
        String sql = MONTHS + " SELECT d.public_id, d.name, to_char(o.created_at AT TIME ZONE :zone, 'YYYY-MM') AS month,"
                + " count(*) AS completed FROM orders o JOIN drivers d ON d.id = o.driver_id"
                + " WHERE o.status = 'COMPLETED' AND o.created_at >= (SELECT min(s) FROM m)"
                + " AND o.created_at < (SELECT max(e) FROM m)"
                + " GROUP BY d.public_id, d.name, month ORDER BY month, d.name, d.public_id";
        MapSqlParameterSource params = new MapSqlParameterSource("now", utc(now)).addValue("zone", zone.getId());
        return jdbc.query(sql, params, (rs, i) -> new DriverMonth(rs.getString("public_id"), rs.getString("name"),
                rs.getString("month"), rs.getLong("completed")));
    }

    public record AlertRow(AlertType type, int severity, String subjectType, String subjectId, Instant since,
                           Double n1, Double n2, String s1) {
    }

    private static final String DRIVER_ACTIVE_ORDER = "SELECT 1 FROM orders o WHERE o.driver_id = d.id"
            + " AND o.status IN ('DISPATCHED', 'DRIVER_ENROUTE', 'ARRIVED', 'IN_PROGRESS')";

    private static final String MAINTENANCE_SINCE = "SELECT max(c.changed_at) AS at FROM status_changes c"
            + " WHERE c.subject_type = 'VEHICLE' AND c.subject_id = v.id AND c.to_status = 'MAINTENANCE'";

    // colunas: type, sev (1 a 3), subject_type, subject_id, since, n1, n2, s1; uma ramificação por regra
    private static String alertUnion() {
        return "SELECT 'STALE_ORDER' AS type, CASE WHEN s.seconds > 2 * s.limit_min * 60 THEN 3 ELSE 2 END AS sev,"
                + " 'ORDER' AS subject_type, s.public_id AS subject_id,"
                + " CAST(:now AS timestamptz) - make_interval(secs => s.seconds) AS since,"
                + " CAST(s.minutes AS double precision) AS n1, CAST(s.limit_min AS double precision) AS n2, s.stage AS s1"
                + " FROM (" + staleRows(null) + ") s"
                + " UNION ALL SELECT 'DRIVER_NO_SIGNAL', CASE WHEN EXISTS (" + DRIVER_ACTIVE_ORDER + ") THEN 3 ELSE 2 END,"
                + " 'DRIVER', d.public_id, d.last_seen_at, NULL, NULL, NULL FROM drivers d"
                + " WHERE d.active AND d.status IN ('BUSY', 'AVAILABLE') AND d.last_seen_at < :noSignalBefore"
                + " UNION ALL SELECT 'STATUS_INCONSISTENT', 3, 'DRIVER', d.public_id,"
                + " COALESCE((SELECT max(c.changed_at) FROM status_changes c WHERE c.subject_type = 'DRIVER'"
                + "  AND c.subject_id = d.id), CAST(:now AS timestamptz)), NULL, NULL, d.status FROM drivers d"
                + " WHERE d.active AND ((d.status = 'BUSY' AND NOT EXISTS (" + DRIVER_ACTIVE_ORDER + "))"
                + "  OR (d.status = 'AVAILABLE' AND EXISTS (" + DRIVER_ACTIVE_ORDER + ")))"
                + " UNION ALL SELECT 'VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER', 2, 'DRIVER', d.public_id,"
                + " COALESCE((" + MAINTENANCE_SINCE + "), CAST(:now AS timestamptz)), NULL, NULL, v.plate"
                + " FROM drivers d JOIN vehicles v ON v.id = d.vehicle_id"
                + " WHERE d.active AND d.status = 'AVAILABLE' AND v.status = 'MAINTENANCE'"
                + " UNION ALL SELECT 'DEMAND_OVER_CAPACITY', 3, 'FLEET', NULL, x.oldest,"
                + " CAST(x.waiting AS double precision), CAST(x.free AS double precision), NULL FROM ("
                + "  SELECT (SELECT count(*) FROM orders o WHERE o.status = 'CREATED' AND o.driver_id IS NULL) AS waiting,"
                + "   (SELECT min(o.created_at) FROM orders o WHERE o.status = 'CREATED' AND o.driver_id IS NULL) AS oldest,"
                + "   (SELECT count(*) FROM drivers d JOIN vehicles v ON v.id = d.vehicle_id WHERE d.active AND "
                + AVAILABLE_NOW + ") AS free) x WHERE x.waiting > x.free"
                + " UNION ALL SELECT 'SUSPICIOUS_STOP', 1, 'ORDER', o.public_id, rs.visited_at, CAST(rs.seq AS double precision),"
                + " rs.distancem, rs.type FROM route_stops rs JOIN routes r ON r.id = rs.route_id"
                + " JOIN orders o ON o.id = r.order_id"
                + " WHERE rs.type <> 'START' AND rs.visited_at >= :stopsSince"
                + " AND (rs.distancem IS NULL OR rs.distancem > :suspiciousM)"
                + " UNION ALL SELECT 'ROUTE_MISSING', 2, 'ORDER', o.public_id, f.at, NULL, NULL, f.details FROM orders o"
                + " JOIN LATERAL (SELECT t.created_at AS at, t.details FROM tracking_statuses t"
                + "  WHERE t.order_id = o.id AND t.code = 'route_failed' ORDER BY t.created_at DESC LIMIT 1) f ON true"
                + " WHERE " + ACTIVE + " AND NOT EXISTS (SELECT 1 FROM routes r WHERE r.order_id = o.id)"
                + " UNION ALL SELECT 'LONG_MAINTENANCE', 1, 'VEHICLE', v.public_id, m.at, NULL, NULL, v.plate"
                + " FROM vehicles v JOIN LATERAL (" + MAINTENANCE_SINCE
                + ") m ON true"
                + " WHERE v.active AND v.status = 'MAINTENANCE' AND m.at < :maintenanceBefore";
    }

    private static MapSqlParameterSource alertParams(DashboardProperties p, RoutingProperties r, Instant now,
                                                     double suspiciousRatio) {
        return staleParams(p, now, null).addValue("freshSince", utc(now.minusSeconds(r.positionMaxAgeS())))
                .addValue("noSignalBefore", utc(now.minusSeconds(2L * r.positionMaxAgeS())))
                .addValue("stopsSince", utc(now.minus(java.time.Duration.ofHours(24))))
                .addValue("suspiciousM", r.arrivalRadiusM() * suspiciousRatio)
                .addValue("maintenanceBefore", utc(now.minus(java.time.Duration.ofDays(p.maintenanceAlertDays()))));
    }

    public Map<AlertType, Long> alertCounts(DashboardProperties p, RoutingProperties r, Instant now, double ratio) {
        Map<AlertType, Long> result = new java.util.EnumMap<>(AlertType.class);
        for (AlertType type : AlertType.values()) {
            result.put(type, 0L);
        }
        jdbc.query("SELECT u.type, count(*) AS total FROM (" + alertUnion() + ") u GROUP BY u.type",
                alertParams(p, r, now, ratio), (RowCallbackHandler) rs ->
                        result.put(AlertType.valueOf(rs.getString("type")), rs.getLong("total")));
        return result;
    }

    // ordem: mais grave primeiro, depois o mais antigo; id desempata
    public List<AlertRow> alertRows(DashboardProperties p, RoutingProperties r, Instant now, double ratio,
                                    java.util.Collection<AlertType> types, int limit) {
        if (types.isEmpty()) {
            return List.of();
        }
        String sql = "SELECT u.* FROM (" + alertUnion() + ") u WHERE u.type IN (:types)"
                + " ORDER BY u.sev DESC, u.since, u.subject_id, u.type, u.n1 LIMIT :limit";
        MapSqlParameterSource params = alertParams(p, r, now, ratio)
                .addValue("types", types.stream().map(Enum::name).collect(Collectors.toList()))
                .addValue("limit", limit);
        return jdbc.query(sql, params, (rs, i) -> {
            Timestamp since = rs.getTimestamp("since");
            return new AlertRow(AlertType.valueOf(rs.getString("type")), rs.getInt("sev"),
                    rs.getString("subject_type"), rs.getString("subject_id"), since.toInstant(),
                    (Double) rs.getObject("n1"), (Double) rs.getObject("n2"), rs.getString("s1"));
        });
    }

    // pedidos criados e motoristas distintos com entrega concluída, por dia local do período
    public List<DayPoint> perDay(DashboardPeriod period) {
        String sql = "SELECT to_char(g.day, 'YYYY-MM-DD') AS day,"
                + " (SELECT count(*) FROM orders o WHERE o.created_at >= g.day AT TIME ZONE :zone"
                + "   AND o.created_at < (g.day + interval '1 day') AT TIME ZONE :zone AND o.created_at >= :from AND o.created_at < :to) AS created,"
                + " (SELECT count(DISTINCT o.driver_id) FROM orders o WHERE o.status = 'COMPLETED'"
                + "   AND o.finished_at >= g.day AT TIME ZONE :zone AND o.finished_at < (g.day + interval '1 day') AT TIME ZONE :zone"
                + "   AND o.finished_at >= :from AND o.finished_at < :to) AS drivers"
                + " FROM generate_series(CAST(:fromDay AS timestamp), CAST(:toDay AS timestamp), interval '1 day') AS g(day)"
                + " ORDER BY g.day";
        MapSqlParameterSource params = window(period, null).addValue("zone", period.zone().getId())
                .addValue("fromDay", period.from().atZone(period.zone()).toLocalDate().toString())
                .addValue("toDay", period.to().atZone(period.zone()).toLocalDate().toString());
        return jdbc.query(sql, params, (rs, i) -> new DayPoint(rs.getString("day"), rs.getLong("created"),
                rs.getLong("drivers")));
    }

    // fila do motorista: CREATED atribuídos a ele; assignedAt é o último evento "assigned"
    public List<DriverQueued> driverQueue(UUID driverId) {
        String sql = "SELECT o.public_id, pickup.name AS pickup_name, dropoff.name AS dropoff_name,"
                + " COALESCE((SELECT max(t.created_at) FROM tracking_statuses t WHERE t.order_id = o.id"
                + "   AND t.code = 'assigned'), o.created_at) AS assigned_at"
                + " FROM orders o"
                + " LEFT JOIN payloads pl ON pl.order_id = o.id"
                + " LEFT JOIN places pickup ON pickup.id = pl.pickup_id"
                + " LEFT JOIN places dropoff ON dropoff.id = pl.dropoff_id"
                + " WHERE o.status = 'CREATED' AND o.driver_id = :driverId ORDER BY assigned_at, o.public_id";
        return jdbc.query(sql, new MapSqlParameterSource("driverId", driverId), (rs, i) -> new DriverQueued(
                rs.getString("public_id"), rs.getString("pickup_name"), rs.getString("dropoff_name"),
                rs.getTimestamp("assigned_at").toInstant()));
    }

    public DriverToday driverToday(UUID driverId, String username, DashboardPeriod today) {
        String sql = "SELECT"
                + " (SELECT count(*) FROM orders o WHERE o.driver_id = :driverId AND o.status = 'COMPLETED'"
                + "   AND o.finished_at >= :from AND o.finished_at < :to) AS completed,"
                + " (SELECT count(*) FROM orders o WHERE o.driver_id = :driverId AND o.status = 'FAILED'"
                + "   AND o.finished_at >= :from AND o.finished_at < :to) AS failed,"
                + " (SELECT count(*) FROM route_stops s WHERE s.completed_by = :username AND s.type <> 'START'"
                + "   AND s.visited_at >= :from AND s.visited_at < :to) AS stops";
        MapSqlParameterSource params = window(today, null).addValue("driverId", driverId).addValue("username", username);
        return jdbc.queryForObject(sql, params, (rs, i) -> new DriverToday(rs.getLong("completed"),
                rs.getLong("failed"), rs.getLong("stops")));
    }
}
