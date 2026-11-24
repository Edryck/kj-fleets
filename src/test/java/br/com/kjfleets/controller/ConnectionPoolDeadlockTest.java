package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

// achado do teste de carga: o listener AFTER_COMMIT pedia uma 2ª conexão enquanto a 1ª ainda estava presa,
// e com o pool cheio de pedidos simultâneos todo mundo esperava todo mundo até o timeout
@TestPropertySource(properties = {
        "spring.datasource.hikari.maximum-pool-size=2",
        "spring.datasource.hikari.connection-timeout=3000"
})
class ConnectionPoolDeadlockTest extends IntegrationTest {

    @Test
    void concurrentOrderCreationDoesNotExhaustPool() throws Exception {
        String bearer = bearer(Role.ADMIN);
        String customerId = json.readTree(mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("username", "pool" + System.nanoTime(),
                                "password", "password-123", "name", "Pool")))).andReturn().getResponse()
                .getContentAsString()).get("publicId").asString();
        String body = json.writeValueAsString(Map.of("customerId", customerId,
                "pickup", Map.of("name", "A", "address", "Rua A", "lat", -24.87, "lng", -54.33),
                "dropoff", Map.of("name", "B", "address", "Rua B", "lat", -24.88, "lng", -54.34)));

        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Callable<Integer>> calls = new ArrayList<>();
            for (int i = 0; i < 16; i++) {
                calls.add(() -> mvc.perform(post("/orders").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus());
            }
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : pool.invokeAll(calls)) {
                statuses.add(f.get());
            }
            assertThat(statuses).containsOnly(201);
        } finally {
            pool.shutdownNow();
        }
    }
}
