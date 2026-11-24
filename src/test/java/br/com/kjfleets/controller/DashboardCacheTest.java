package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// com 30 mil pedidos cada painel levava ~1 s e era repedido a cada poll; 10 s de cache por usuário seguram isso
@TestPropertySource(properties = "kjfleets.dashboard.cache-s=60")
class DashboardCacheTest extends IntegrationTest {

    private String summary(String bearer) throws Exception {
        return mvc.perform(get("/dashboard/orders/summary").header("Authorization", bearer))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private void createOrder(String bearer) throws Exception {
        String customer = json.readTree(mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("username", "dc" + System.nanoTime(),
                                "password", "password-123", "name", "Cache")))).andReturn().getResponse()
                .getContentAsString()).get("publicId").asString();
        mvc.perform(post("/orders").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("customerId", customer,
                        "pickup", Map.of("name", "A", "address", "Rua A", "lat", -24.87, "lng", -54.33),
                        "dropoff", Map.of("name", "B", "address", "Rua B", "lat", -24.88, "lng", -54.34)))))
                .andExpect(status().isCreated());
    }

    @Test
    void sameUserGetsCachedPanelWithinTtl() throws Exception {
        String admin = bearer(Role.ADMIN);
        String first = summary(admin);
        createOrder(admin);
        assertThat(summary(admin)).isEqualTo(first);
    }
}
