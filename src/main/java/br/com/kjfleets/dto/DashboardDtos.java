package br.com.kjfleets.dto;

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
}
