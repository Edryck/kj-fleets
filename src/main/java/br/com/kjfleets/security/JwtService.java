package br.com.kjfleets.security;

import br.com.kjfleets.entity.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Service
public class JwtService {

    public static final Duration EXPIRATION = Duration.ofHours(8);

    private final SecretKey key;

    public JwtService(@Value("${kjfleets.jwt-secret}") String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET precisa de pelo menos 32 bytes");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public String generate(AppUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getUsername())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(EXPIRATION)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public Instant expiresAt(String token) {
        return parse(token).getExpiration().toInstant();
    }

    public Optional<String> username(String token) {
        try {
            return Optional.ofNullable(parse(token).getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
