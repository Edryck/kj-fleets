package br.com.kjfleets.security;

import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Role;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    private static final String SECRET = "test-secret-with-at-least-32-bytes-0123456789";
    private final JwtService jwt = new JwtService(SECRET);

    private AppUser admin() {
        AppUser user = new AppUser();
        user.setUsername("admin");
        user.setRole(Role.ADMIN);
        return user;
    }

    @Test
    void shortSecretFailsFast() {
        assertThrows(IllegalStateException.class, () -> new JwtService("short"));
    }

    @Test
    void roundTrip() {
        String token = jwt.generate(admin());

        assertEquals(Optional.of("admin"), jwt.username(token));
        Duration diff = Duration.between(Instant.now().plus(JwtService.EXPIRATION), jwt.expiresAt(token)).abs();
        assertTrue(diff.compareTo(Duration.ofMinutes(1)) < 0);
    }

    @Test
    void tokenIsSignedWithHs256() throws Exception {
        // com 64 bytes o jjwt escolheria HS512 se o algoritmo não fosse explícito
        JwtService longKey = new JwtService("x".repeat(64));
        String header = new String(Base64.getUrlDecoder().decode(longKey.generate(admin()).split("\\.")[0]));

        assertTrue(header.contains("\"alg\":\"HS256\""));
    }

    @Test
    void tamperedTokenIsEmpty() {
        String token = jwt.generate(admin());
        // mexe no meio da assinatura: o último caractere pode ter só bits de padding e não mudar nada
        int signatureStart = token.lastIndexOf('.') + 1;
        int middle = signatureStart + (token.length() - signatureStart) / 2;
        char original = token.charAt(middle);
        String tampered = token.substring(0, middle) + (original == 'A' ? 'B' : 'A') + token.substring(middle + 1);

        assertTrue(jwt.username(tampered).isEmpty());
    }

    @Test
    void expiredTokenIsEmpty() {
        String token = Jwts.builder()
                .subject("admin")
                .claim("role", "ADMIN")
                .expiration(Date.from(Instant.now().minusSeconds(1)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertTrue(jwt.username(token).isEmpty());
    }
}
