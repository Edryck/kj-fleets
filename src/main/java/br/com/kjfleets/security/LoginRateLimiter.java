package br.com.kjfleets.security;

import br.com.kjfleets.config.BusinessException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// janela deslizante em memória: some no restart, o que é aceitável para uma instância só
@Component
public class LoginRateLimiter {

    private final int maxAttempts;
    private final int maxKeys;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
    private volatile Instant lastPrune = Instant.EPOCH;

    @Autowired
    public LoginRateLimiter(@Value("${kjfleets.auth.login-max-attempts:5}") int maxAttempts,
                            @Value("${kjfleets.auth.login-window-s:300}") long windowSeconds, Clock clock) {
        this(maxAttempts, windowSeconds, clock, 100_000);
    }

    LoginRateLimiter(int maxAttempts, long windowSeconds, Clock clock, int maxKeys) {
        this.maxAttempts = maxAttempts;
        this.maxKeys = maxKeys;
        this.window = Duration.ofSeconds(windowSeconds);
        this.clock = clock;
    }

    public void check(String key) {
        Instant now = clock.instant();
        pruneAll(now);
        Deque<Instant> attempts = failures.get(key);
        if (attempts == null) {
            return;
        }
        synchronized (attempts) {
            dropOld(attempts, now);
            if (attempts.size() >= maxAttempts) {
                throw new BusinessException("TOO_MANY_ATTEMPTS", HttpStatus.TOO_MANY_REQUESTS,
                        "Muitas tentativas. Tente de novo em alguns minutos");
            }
        }
    }

    public void recordFailure(String key) {
        // teto contra spray de usernames: cheio mesmo depois de limpar, para de contar chaves novas
        if (!failures.containsKey(key) && failures.size() >= maxKeys) {
            lastPrune = Instant.EPOCH;
            pruneAll(clock.instant());
            if (failures.size() >= maxKeys) {
                return;
            }
        }
        Deque<Instant> attempts = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (attempts) {
            attempts.addLast(clock.instant());
        }
    }

    public void reset(String key) {
        failures.remove(key);
    }

    int trackedKeys() {
        return failures.size();
    }

    private void dropOld(Deque<Instant> attempts, Instant now) {
        Instant limit = now.minus(window);
        while (!attempts.isEmpty() && !attempts.peekFirst().isAfter(limit)) {
            attempts.pollFirst();
        }
    }

    // varre tudo no máximo uma vez por janela, senão um ataque com usernames aleatórios enche a memória
    private void pruneAll(Instant now) {
        if (now.isBefore(lastPrune.plus(window))) {
            return;
        }
        lastPrune = now;
        failures.entrySet().removeIf(entry -> {
            synchronized (entry.getValue()) {
                dropOld(entry.getValue(), now);
                return entry.getValue().isEmpty();
            }
        });
    }
}
