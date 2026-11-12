package br.com.kjfleets.dto;

import br.com.kjfleets.dto.RouteDtos.NextStop;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record Meta(Instant generatedAt, String timezone, String period, Instant from, Instant to) {
        // blocos "agora" não têm janela, então period fica "now" e from/to nulos
        public static Meta now(Instant generatedAt, ZoneId zone) {
            return new Meta(generatedAt, zone.getId(), "now", null, null);
        }
    }

    public record Rate(Double rate, long n) {
        public static Rate of(long hits, long n) {
            return new Rate(n == 0 ? null : (double) hits / n, n);
        }
    }

    public record ReasonCount(String reason, long count) {
    }

    public record OrdersSummary(Meta meta, long created, long completed, long failed, long cancelled,
                                long cancelledByCustomer, long cancelledByStaff, long cancelledByUnknown, Rate successRate, Rate failureRate,
                                Rate cancelRate, List<ReasonCount> topFailureReasons, Double avgWaitMinutes,
                                Double avgCycleMinutes, Rate podRate, OrdersSummary previous) {
    }

    public record StaleOrder(String orderId, String trackingNumber, String stage, long minutesInStage, int limitMin) {
    }

    public record Funnel(Meta meta, Map<String, Long> byStage, Map<String, Long> staleByStage) {
    }

    public record QueueItem(String orderId, String trackingNumber, String pickupName, String dropoffName,
                            long minutesInStage) {
    }

    public record InProgressItem(String orderId, String status, String driverId, String driverName, Integer etaMinutes,
                                 int stopsDone, int stopsTotal) {
    }

    public record Paged<T>(List<T> items, long total) {
    }

    public record DispatchQueue(Meta meta, Paged<QueueItem> unassigned, Paged<QueueItem> assignedNotDispatched,
                                Paged<InProgressItem> inProgress, Paged<StaleOrder> stale) {
    }

    public record DriverRow(String driverId, String name, String status, String vehiclePlate, String vehicleStatus,
                            String activeOrderId, long queueSize, Instant lastSeenAt, boolean pingStale) {
    }

    public record FleetStatus(Meta meta, Map<String, Long> driversByStatus, Map<String, Long> vehiclesByStatus,
                              long waitingOrders, long availableDrivers, List<DriverRow> drivers,
                              List<DriverRow> availableDriversList) {
    }

    public record DriverPerformance(String driverId, String name, long completed, long failed, Rate successRate,
                                    Double avgDispatchToArrivedMinutes, Double busyPct, long orders) {
    }

    public record DriversPerformance(Meta meta, List<DriverPerformance> drivers, List<String> idleDriverIds) {
    }

    public record AlgorithmSavings(long routes, double savedKm, Double avgSavingsPct) {
    }

    public record RoutingSavings(Meta meta, long routes, double plannedKm, double baselineKm, double savedKm,
                                 Double avgSavingsPct, Map<String, AlgorithmSavings> byAlgorithm, Rate batchDispatchPct) {
    }

    public record MonthPoint(String month, long created, long completed, long failed, long cancelled, Rate successRate,
                             Double avgCycleMinutes, Double savedKm, Double avgSavingsPct) {
    }

    public record DriverMonth(String driverId, String name, String month, long completed) {
    }

    public record YearlyTrends(Meta meta, List<MonthPoint> months, List<DriverMonth> byDriver) {
    }

    public enum AlertType {
        STALE_ORDER, DRIVER_NO_SIGNAL, STATUS_INCONSISTENT, VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER,
        DEMAND_OVER_CAPACITY, SUSPICIOUS_STOP, ROUTE_MISSING, LONG_MAINTENANCE
    }

    public enum Severity { LOW, MEDIUM, HIGH }

    public record Alert(AlertType type, Severity severity, String subjectType, String subjectId, String message,
                        String suggestedAction, Instant since) {
    }

    public record Alerts(Meta meta, List<Alert> items, Map<AlertType, Long> counts) {
    }

    public record FleetCounts(Map<String, Long> driversByStatus, Map<String, Long> vehiclesByStatus,
                              long waitingOrders, long availableDrivers) {
    }

    public record AdminPanel(Meta meta, OrdersSummary summary, Funnel funnel, FleetCounts fleet,
                             RoutingSavings routing, Map<AlertType, Long> alertCounts) {
    }

    public record DispatchPanel(Meta meta, DispatchQueue queue, List<DriverRow> availableDrivers, FleetCounts counts,
                                OrdersSummary summary, List<Alert> alerts) {
    }

    public record DayPoint(String day, long ordersCreated, long driversWithDelivery) {
    }

    public record Sizing(long waitingOrders, long availableDrivers, List<DayPoint> perDay) {
    }

    public record FleetPanel(Meta meta, FleetStatus fleet, List<Alert> alerts, DriversPerformance performance,
                             Sizing sizing) {
    }

    // etaMinutes só em DRIVER_ENROUTE, ARRIVED e IN_PROGRESS
    public record CustomerActive(String orderId, String trackingNumber, String status, Integer etaMinutes,
                                 int stopsDone, int stopsTotal, boolean cancellable, String driverName) {
    }

    // kind: FAILED ou STALE
    public record CustomerAttention(String orderId, String trackingNumber, String kind, String reason,
                                    Long minutesInStage) {
    }

    public record CustomerDelivered(String orderId, String trackingNumber, Instant finishedAt, boolean hasPod) {
    }

    public record CustomerPanel(Meta meta, List<CustomerActive> active, List<CustomerAttention> attention,
                                OrdersSummary summary, List<CustomerDelivered> recentDelivered) {
    }

    public record DriverActive(String orderId, String status, NextStop nextStop, int stopsDone, int stopsTotal,
                               boolean podPending) {
    }

    public record DriverQueued(String orderId, String pickupName, String dropoffName, Instant assignedAt) {
    }

    public record DriverToday(long completed, long failed, long stopsCompleted) {
    }

    public record Gps(Instant lastSeenAt, Long positionAgeS, boolean positionValid) {
    }

    public record DriverPanel(Meta meta, DriverActive activeOrder, List<DriverQueued> queue, DriverToday today,
                              Gps gps) {
    }
}
