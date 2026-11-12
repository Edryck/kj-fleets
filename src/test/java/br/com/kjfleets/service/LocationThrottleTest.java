package br.com.kjfleets.service;

import br.com.kjfleets.config.WebSocketProperties;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocationThrottleTest {

    private static final Instant T0 = Instant.parse("2026-11-12T10:00:00Z");
    // 0.001 grau de latitude ~ 111 m
    private static final double LAT = -24.86;
    private static final double LNG = -54.33;

    private final RealtimePublisher publisher = new RealtimePublisher(null, null, null, null, null,
            new WebSocketProperties(5, 20), null);
    private final String driver = "drv_test";

    @Test
    void firstPingBroadcasts() {
        assertTrue(publisher.shouldBroadcast(driver, LAT, LNG, T0));
    }

    @Test
    void withinIntervalSuppressed() {
        publisher.shouldBroadcast(driver, LAT, LNG, T0);
        assertFalse(publisher.shouldBroadcast(driver, LAT + 0.001, LNG, T0.plusSeconds(2)));
    }

    @Test
    void notMovedSuppressed() {
        publisher.shouldBroadcast(driver, LAT, LNG, T0);
        assertFalse(publisher.shouldBroadcast(driver, LAT + 0.00005, LNG, T0.plusSeconds(10)));
    }

    @Test
    void movedAfterIntervalBroadcasts() {
        publisher.shouldBroadcast(driver, LAT, LNG, T0);
        assertTrue(publisher.shouldBroadcast(driver, LAT + 0.0005, LNG, T0.plusSeconds(6)));
    }

    @Test
    void suppressedPingKeepsReferencePoint() {
        publisher.shouldBroadcast(driver, LAT, LNG, T0);
        publisher.shouldBroadcast(driver, LAT + 0.001, LNG, T0.plusSeconds(2));
        // a distância é contada do último broadcast, não do último ping
        assertTrue(publisher.shouldBroadcast(driver, LAT + 0.001, LNG, T0.plusSeconds(6)));
    }
}
