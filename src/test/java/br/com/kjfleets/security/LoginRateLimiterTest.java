package br.com.kjfleets.security;

import br.com.kjfleets.config.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LoginRateLimiterTest {

    private static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-24T12:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginRateLimiter limiter = new LoginRateLimiter(5, 300, clock);

    private void fail(String key, int times) {
        for (int i = 0; i < times; i++) {
            limiter.check(key);
            limiter.recordFailure(key);
        }
    }

    @Test
    void allowsUpToMax() {
        fail("ip|ana", 5);
        BusinessException e = assertThrows(BusinessException.class, () -> limiter.check("ip|ana"));
        assertEquals("TOO_MANY_ATTEMPTS", e.code());
        assertEquals(429, e.status().value());
    }

    @Test
    void successResets() {
        fail("ip|ana", 4);
        limiter.reset("ip|ana");
        fail("ip|ana", 4);
        assertDoesNotThrow(() -> limiter.check("ip|ana"));
    }

    @Test
    void limitResetsAfterWindow() {
        fail("ip|ana", 5);
        clock.now = clock.now.plus(Duration.ofSeconds(301));
        assertDoesNotThrow(() -> limiter.check("ip|ana"));
    }

    @Test
    void keysAreIndependent() {
        fail("ip|ana", 5);
        assertDoesNotThrow(() -> limiter.check("ip|bia"));
        assertDoesNotThrow(() -> limiter.check("outro-ip|ana"));
    }

    @Test
    void oldKeysArePruned() {
        fail("ip|ana", 1);
        clock.now = clock.now.plus(Duration.ofSeconds(301));
        limiter.check("ip|bia");
        assertEquals(0, limiter.trackedKeys());
    }

    // achado da revisão: spray de usernames aleatórios criava uma entrada por chave até a próxima varredura
    @Test
    void mapIsCappedUnderUsernameSpraying() {
        LoginRateLimiter small = new LoginRateLimiter(5, 300, clock, 10);
        for (int i = 0; i < 50; i++) {
            small.check("ip|user" + i);
            small.recordFailure("ip|user" + i);
        }
        assertEquals(10, small.trackedKeys());
    }
}
