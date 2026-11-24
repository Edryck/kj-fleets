package br.com.kjfleets.security;

import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// o Basic Auth do motorista confere a senha a cada ping, e o BCrypt custa ~100 ms de CPU de propósito.
// Guarda só acertos, pela chave hash salvo + SHA-256 da senha: trocar a senha muda o hash e invalida sozinho.
// Desativação não depende disto, o usuário é relido do banco em toda requisição.
public class CachingPasswordEncoder implements PasswordEncoder {

    private final PasswordEncoder delegate;
    private final Duration ttl;
    private final Clock clock;
    private final int maxEntries;
    private final Map<String, Instant> verified = new ConcurrentHashMap<>();

    public CachingPasswordEncoder(PasswordEncoder delegate, Duration ttl, Clock clock, int maxEntries) {
        this.delegate = delegate;
        this.ttl = ttl;
        this.clock = clock;
        this.maxEntries = maxEntries;
    }

    @Override
    public String encode(CharSequence rawPassword) {
        return delegate.encode(rawPassword);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (rawPassword == null || encodedPassword == null) {
            return delegate.matches(rawPassword, encodedPassword);
        }
        String key = encodedPassword + "|" + sha256(rawPassword);
        Instant now = clock.instant();
        Instant until = verified.get(key);
        if (until != null && now.isBefore(until)) {
            return true;
        }
        boolean ok = delegate.matches(rawPassword, encodedPassword);
        if (ok) {
            // teto simples: cheio, limpa tudo; o pior caso é um BCrypt a mais por motorista
            if (verified.size() >= maxEntries) {
                verified.clear();
            }
            verified.put(key, now.plus(ttl));
        } else {
            verified.remove(key);
        }
        return ok;
    }

    int size() {
        return verified.size();
    }

    private static String sha256(CharSequence raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
