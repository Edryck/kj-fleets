package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DashboardPeriodTest {

    private static final ZoneId SAO_PAULO = ZoneId.of("America/Sao_Paulo");
    // 23:30 de 11/11 em São Paulo, já é dia 12 em UTC
    private static final Instant NOW = Instant.parse("2026-11-12T02:30:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private static DashboardPeriod resolve(String period) {
        return DashboardPeriod.resolve(period, SAO_PAULO, CLOCK);
    }

    @Test
    void todayUsesDashboardTimezone() {
        DashboardPeriod period = resolve(null);

        assertEquals("today", period.period());
        assertEquals(Instant.parse("2026-11-11T03:00:00Z"), period.from());
        assertEquals(NOW, period.to());
        assertEquals(period.from(), resolve("today").from());
    }

    @Test
    void sevenDaysStartsSixDaysBefore() {
        assertEquals(Instant.parse("2026-11-05T03:00:00Z"), resolve("7d").from());
    }

    @Test
    void fifteenDaysStartsFourteenDaysBefore() {
        assertEquals(Instant.parse("2026-10-28T03:00:00Z"), resolve("15d").from());
    }

    @Test
    void oneMonthIsThirtyDays() {
        assertEquals(Instant.parse("2026-10-13T03:00:00Z"), resolve("1m").from());
    }

    @Test
    void invalidPeriodIs400() {
        BusinessException ex = assertThrows(BusinessException.class, () -> resolve("30d"));

        assertEquals("VALIDATION_ERROR", ex.code());
        assertEquals(400, ex.status().value());
        assertEquals("period: use today, 7d, 15d ou 1m", ex.getMessage());
    }

    @Test
    void previousWindowSameLength() {
        DashboardPeriod period = resolve("7d");
        DashboardPeriod previous = period.previous();

        assertEquals(period.from(), previous.to());
        assertEquals(Duration.between(period.from(), period.to()), Duration.between(previous.from(), previous.to()));
    }

    @Test
    void metaCarriesWindow() {
        DashboardPeriod period = resolve("1m");
        var meta = period.meta(NOW);

        assertEquals(NOW, meta.generatedAt());
        assertEquals("America/Sao_Paulo", meta.timezone());
        assertEquals("1m", meta.period());
        assertEquals(period.from(), meta.from());
        assertEquals(period.to(), meta.to());
    }
}
