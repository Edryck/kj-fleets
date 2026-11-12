package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.DashboardDtos.Meta;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

public record DashboardPeriod(String period, ZoneId zone, Instant from, Instant to) {

    public static DashboardPeriod resolve(String period, ZoneId zone, Clock clock) {
        String name = period == null ? "today" : period;
        // 1m são 30 dias corridos, não mês civil
        long daysBack = switch (name) {
            case "today" -> 0;
            case "7d" -> 6;
            case "15d" -> 14;
            case "1m" -> 29;
            default -> throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "period: use today, 7d, 15d ou 1m");
        };
        Instant now = clock.instant();
        Instant from = now.atZone(zone).toLocalDate().minusDays(daysBack).atStartOfDay(zone).toInstant();
        return new DashboardPeriod(name, zone, from, now);
    }

    public DashboardPeriod previous() {
        Instant start = from.minus(Duration.between(from, to));
        return new DashboardPeriod(period, zone, start, from);
    }

    public Meta meta(Instant generatedAt) {
        return new Meta(generatedAt, zone.getId(), period, from, to);
    }
}
