package br.com.kjfleets.repository;

import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.dto.DashboardDtos.DriverRow;
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
        return "SELECT s.public_id, s.tracking_number, s.stage, s.limit_min,"
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
                + "   AND o.status IN ('DISPATCHED', 'DRIVER_ENROUTE', 'ARRIVED', 'IN_PROGRESS') LIMIT 1) AS active_order,"
                + " (SELECT count(*) FROM orders o WHERE o.driver_id = d.id AND o.status = 'CREATED') AS queue_size,"
                + " d.last_seen_at, (d.last_seen_at IS NULL OR d.last_seen_at < :freshSince) AS ping_stale"
                + " FROM drivers d LEFT JOIN vehicles v ON v.id = d.vehicle_id"
                + " WHERE d.active" + driverFleetFilter(fleetId) + (availableOnly ? " AND " + AVAILABLE_NOW : "")
                + " ORDER BY d.name, d.public_id";
        MapSqlParameterSource params = new MapSqlParameterSource("freshSince", utc(freshSince))
                .addValue("fleetId", fleetId);
        return jdbc.query(sql, params, (rs, i) -> {
            Timestamp seen = rs.getTimestamp("last_seen_at");
            return new DriverRow(rs.getString("public_id"), rs.getString("name"), rs.getString("status"),
                    rs.getString("plate"), rs.getString("vehicle_status"), rs.getString("active_order"),
                    rs.getLong("queue_size"), seen == null ? null : seen.toInstant(), rs.getBoolean("ping_stale"));
        });
    }
}
