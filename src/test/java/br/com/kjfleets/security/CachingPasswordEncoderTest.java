package br.com.kjfleets.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CachingPasswordEncoderTest {

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

    // finge o BCrypt: confere "hash-de-<senha>" e conta quantas vezes foi chamado
    private static class CountingEncoder implements PasswordEncoder {
        int matches;

        @Override
        public String encode(CharSequence raw) {
            return "hash-de-" + raw;
        }

        @Override
        public boolean matches(CharSequence raw, String encoded) {
            matches++;
            return encoded.equals("hash-de-" + raw);
        }
    }

    private final MutableClock clock = new MutableClock();
    private final CountingEncoder bcrypt = new CountingEncoder();
    private final CachingPasswordEncoder encoder = new CachingPasswordEncoder(bcrypt, Duration.ofMinutes(5), clock, 3);

    @Test
    void secondCorrectLoginSkipsBcrypt() {
        assertTrue(encoder.matches("senha-123", "hash-de-senha-123"));
        assertTrue(encoder.matches("senha-123", "hash-de-senha-123"));
        assertEquals(1, bcrypt.matches);
    }

    @Test
    void wrongPasswordIsNeverCachedAndAlwaysChecked() {
        assertFalse(encoder.matches("errada", "hash-de-senha-123"));
        assertFalse(encoder.matches("errada", "hash-de-senha-123"));
        assertEquals(2, bcrypt.matches);
    }

    @Test
    void otherPasswordForSameHashIsChecked() {
        encoder.matches("senha-123", "hash-de-senha-123");
        assertFalse(encoder.matches("senha-1234", "hash-de-senha-123"));
        assertEquals(2, bcrypt.matches);
    }

    @Test
    void changedPasswordHashIsCheckedAgain() {
        encoder.matches("senha-123", "hash-de-senha-123");
        assertFalse(encoder.matches("senha-123", "hash-de-nova"));
        assertEquals(2, bcrypt.matches);
    }

    @Test
    void entryExpiresAfterTtl() {
        encoder.matches("senha-123", "hash-de-senha-123");
        clock.now = clock.now.plus(Duration.ofMinutes(6));
        encoder.matches("senha-123", "hash-de-senha-123");
        assertEquals(2, bcrypt.matches);
    }

    @Test
    void cacheIsBounded() {
        for (int i = 0; i < 10; i++) {
            encoder.matches("s" + i, "hash-de-s" + i);
        }
        assertTrue(encoder.size() <= 3);
    }

    @Test
    void encodeDelegates() {
        assertEquals("hash-de-x", encoder.encode("x"));
    }
}
