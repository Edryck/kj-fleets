package br.com.kjfleets.security;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// ataques de quem não deveria entrar ou quer ver o que não é dele
class SecurityAttackTest extends IntegrationTest {

    @Value("${kjfleets.jwt-secret}")
    private String secret;

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions postJson(String url, Object body, String auth) throws Exception {
        var request = post(url).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (auth != null) {
            request.header("Authorization", auth);
        }
        return mvc.perform(request);
    }

    private String loginBearer(String username, String password) throws Exception {
        String body = postJson("/auth/login", Map.of("username", username, "password", password), null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(body).get("token").asString();
    }

    private String newCustomer() throws Exception {
        String username = "s" + unique();
        postJson("/auth/register", Map.of("username", username, "password", "password-123", "name", "Cliente"), null)
                .andExpect(status().isCreated());
        return loginBearer(username, "password-123");
    }

    private String createOrder(String bearer) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("pickup", Map.of("name", "O " + unique(), "address", "Rua A", "lat", -24.87, "lng", -54.33));
        body.put("dropoff", Map.of("name", "D " + unique(), "address", "Rua B", "lat", -24.88, "lng", -54.34));
        String created = postJson("/orders", body, bearer).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(created).get("publicId").asString();
    }

    private ResultActions me(String authorization) throws Exception {
        return mvc.perform(get("/me").header("Authorization", authorization));
    }

    private static String b64(String raw) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void tamperedSignatureRejected() throws Exception {
        String token = tokenFor(Role.ADMIN);
        char last = token.charAt(token.length() - 5);
        String tampered = token.substring(0, token.length() - 5) + (last == 'A' ? 'B' : 'A') + token.substring(token.length() - 4);
        me("Bearer " + tampered).andExpect(status().isUnauthorized());
    }

    @Test
    void tamperedPayloadRejected() throws Exception {
        String[] parts = tokenFor(Role.CUSTOMER).split("\\.");
        String forged = parts[0] + "." + b64("{\"sub\":\"admin-user\",\"role\":\"ADMIN\"}") + "." + parts[2];
        me("Bearer " + forged).andExpect(status().isUnauthorized());
    }

    @Test
    void algNoneRejected() throws Exception {
        tokenFor(Role.ADMIN);
        String token = b64("{\"alg\":\"none\"}") + "." + b64("{\"sub\":\"admin-user\",\"role\":\"ADMIN\"}") + ".";
        me("Bearer " + token).andExpect(status().isUnauthorized());
    }

    @Test
    void otherSecretRejected() throws Exception {
        tokenFor(Role.ADMIN);
        String token = Jwts.builder().subject("admin-user").claim("role", "ADMIN")
                .expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(Keys.hmacShaKeyFor("outro-segredo-com-mais-de-32-bytes-xyz".getBytes(StandardCharsets.UTF_8)))
                .compact();
        me("Bearer " + token).andExpect(status().isUnauthorized());
    }

    @Test
    void expiredTokenRejected() throws Exception {
        tokenFor(Role.ADMIN);
        String token = Jwts.builder().subject("admin-user").claim("role", "ADMIN")
                .issuedAt(Date.from(Instant.now().minusSeconds(7200)))
                .expiration(Date.from(Instant.now().minusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .compact();
        me("Bearer " + token).andExpect(status().isUnauthorized());
    }

    @Test
    void garbageAuthorizationRejected() throws Exception {
        me("Bearer ").andExpect(status().isUnauthorized());
        me("Bearer a.b.c").andExpect(status().isUnauthorized());
        me("Basic " + b64("admin-user:password-123")).andExpect(status().isUnauthorized());
        me("Token " + tokenFor(Role.ADMIN)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"CUSTOMER", "FLEET_MANAGER", "DISPATCHER"})
    void roleEscalationBlocked(Role role) throws Exception {
        postJson("/users", Map.of("username", "x" + unique(), "password", "password-123", "role", "ADMIN"),
                bearer(role)).andExpect(status().isForbidden());
        mvc.perform(get("/users").header("Authorization", bearer(role))).andExpect(status().isForbidden());
    }

    @Test
    void customerCannotReadOtherCustomersOrder() throws Exception {
        String orderOfA = createOrder(newCustomer());
        mvc.perform(get("/orders/" + orderOfA).header("Authorization", newCustomer()))
                .andExpect(status().is(anyOf(is(403), is(404))));
    }

    @Test
    void customerListShowsOnlyOwnOrders() throws Exception {
        String orderOfA = createOrder(newCustomer());
        String body = mvc.perform(get("/orders?limit=100").header("Authorization", newCustomer()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(orderOfA);
    }

    @Test
    void customerCannotTouchOtherCustomersPlace() throws Exception {
        String bearerA = newCustomer();
        String created = postJson("/customer/places",
                Map.of("name", "Casa " + unique(), "address", "Rua C", "lat", -24.8, "lng", -54.3), bearerA)
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String placeId = json.readTree(created).get("publicId").asString();
        String bearerB = newCustomer();
        mvc.perform(get("/customer/places/" + placeId).header("Authorization", bearerB))
                .andExpect(status().is(anyOf(is(403), is(404))));
        mvc.perform(put("/customer/places/" + placeId).header("Authorization", bearerB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Roubada", "lat", -24.8, "lng", -54.3))))
                .andExpect(status().is(anyOf(is(403), is(404))));
    }

    @Test
    void driverCannotSeeUnassignedOrderNorUseJwtLogin() throws Exception {
        String orderId = createOrder(newCustomer());
        String username = "drv-" + unique();
        postJson("/drivers", Map.of("username", username, "password", "password-123", "name", "Motorista"),
                bearer(Role.FLEET_MANAGER)).andExpect(status().isCreated());
        mvc.perform(get("/driver/orders/" + orderId).with(httpBasic(username, "password-123")))
                .andExpect(status().is(anyOf(is(403), is(404))));
        postJson("/auth/login", Map.of("username", username, "password", "password-123"), null)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void driverBasicAuthWithHugePasswordIs401() throws Exception {
        String username = "drv-" + unique();
        postJson("/drivers", Map.of("username", username, "password", "password-123", "name", "Motorista"),
                bearer(Role.FLEET_MANAGER)).andExpect(status().isCreated());
        mvc.perform(get("/driver/me").with(httpBasic(username, "🔒".repeat(30))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void customerCannotUseDriverOrStaffRoutes() throws Exception {
        String bearer = newCustomer();
        mvc.perform(get("/driver/me").header("Authorization", bearer)).andExpect(status().isUnauthorized());
        mvc.perform(get("/drivers").header("Authorization", bearer)).andExpect(status().isForbidden());
        mvc.perform(get("/dashboard").header("Authorization", bearer)).andExpect(status().is(anyOf(is(403), is(404))));
    }

    @Test
    void errorsLeakNothing() throws Exception {
        String[] bodies = {
                mvc.perform(get("/orders/order_zzzzzz").header("Authorization", bearer(Role.ADMIN)))
                        .andReturn().getResponse().getContentAsString(),
                mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":"))
                        .andReturn().getResponse().getContentAsString(),
                mvc.perform(get("/orders?limit=abc").header("Authorization", bearer(Role.ADMIN)))
                        .andReturn().getResponse().getContentAsString(),
                mvc.perform(get("/nao-existe").header("Authorization", bearer(Role.ADMIN)))
                        .andReturn().getResponse().getContentAsString(),
        };
        for (String body : bodies) {
            assertThat(body).doesNotContain("org.", "java.", "Exception", "SQL", "select ", "stack");
        }
    }

    @Test
    void passwordNeverReturned() throws Exception {
        String username = "pw" + unique();
        String register = postJson("/auth/register",
                Map.of("username", username, "password", "password-123", "name", "Cliente"), null)
                .andReturn().getResponse().getContentAsString();
        String meBody = me(loginBearer(username, "password-123")).andReturn().getResponse().getContentAsString();
        String users = mvc.perform(get("/users?limit=100").header("Authorization", bearer(Role.ADMIN)))
                .andReturn().getResponse().getContentAsString();
        for (String body : new String[]{register, meBody, users}) {
            assertThat(body.toLowerCase()).doesNotContain("password", "$2a$", "$2b$");
        }
    }

    @Test
    void deactivatedUserTokenRejected() throws Exception {
        String username = "d" + unique();
        String created = postJson("/users", Map.of("username", username, "password", "password-123", "role", "DISPATCHER"),
                bearer(Role.ADMIN)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String bearer = loginBearer(username, "password-123");
        me(bearer).andExpect(status().isOk());
        mvc.perform(post("/users/" + json.readTree(created).get("publicId").asString() + "/deactivate")
                .header("Authorization", bearer(Role.ADMIN))).andExpect(status().isNoContent());
        me(bearer).andExpect(status().isUnauthorized());
        postJson("/auth/login", Map.of("username", username, "password", "password-123"), null)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void bruteForceGets429() throws Exception {
        String username = "bf" + unique();
        postJson("/auth/register", Map.of("username", username, "password", "password-123", "name", "Alvo"), null)
                .andExpect(status().isCreated());
        for (int i = 0; i < 5; i++) {
            postJson("/auth/login", Map.of("username", username, "password", "chute-" + i), null)
                    .andExpect(status().isUnauthorized());
        }
        postJson("/auth/login", Map.of("username", username, "password", "password-123"), null)
                .andExpect(status().isTooManyRequests())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.code")
                        .value("TOO_MANY_ATTEMPTS"));
        // outro usuário do mesmo IP continua entrando
        loginBearer(registerAndReturn(), "password-123");
    }

    private String registerAndReturn() throws Exception {
        String username = "ok" + unique();
        postJson("/auth/register", Map.of("username", username, "password", "password-123", "name", "Ok"), null)
                .andExpect(status().isCreated());
        return username;
    }
}
