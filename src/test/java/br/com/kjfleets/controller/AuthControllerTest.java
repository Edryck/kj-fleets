package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest extends IntegrationTest {

    private ResultActions send(String url, Object body, String auth) throws Exception {
        var request = post(url).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (auth != null) {
            request.header("Authorization", auth);
        }
        return mvc.perform(request);
    }

    private ResultActions register(String username) throws Exception {
        return send("/auth/register", Map.of("username", username, "password", "password-123", "name", "Cliente"), null);
    }

    private String unique() {
        return "u" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void registerCreatesCustomer() throws Exception {
        String username = unique();
        register(username)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publicId").value(matchesPattern("customer_[a-z0-9]{6}")))
                .andExpect(jsonPath("$.username").value(username));
    }

    @Test
    void registerDuplicateIs409() throws Exception {
        String username = unique();
        register(username).andExpect(status().isCreated());
        register(username).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @Test
    void usernameIsCaseInsensitive() throws Exception {
        String username = unique();
        register(username).andExpect(status().isCreated());
        register(" " + username.toUpperCase() + " ")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @Test
    void shortPasswordIs400() throws Exception {
        send("/auth/register", Map.of("username", unique(), "password", "1234567", "name", "X"), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void loginReturnsToken() throws Exception {
        send("/auth/login", Map.of("username", "admin", "password", "admin-pass-123"), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.expiresAt").isNotEmpty());
    }

    @Test
    void loginNormalizesUsername() throws Exception {
        send("/auth/login", Map.of("username", " ADMIN ", "password", "admin-pass-123"), null)
                .andExpect(status().isOk());
    }

    @Test
    void loginFailuresAreIdentical() throws Exception {
        AppUser inactive = authService.newUser(unique(), "password-123", Role.DISPATCHER);
        inactive.setActive(false);
        userRepository.save(inactive);
        String driver = unique();
        authService.newUser(driver, "password-123", Role.DRIVER);

        String[][] cases = {
                {unique(), "password-123"},
                {"admin", "wrong-password"},
                {inactive.getUsername(), "password-123"},
                {driver, "password-123"},
        };
        String expected = null;
        for (String[] c : cases) {
            String body = send("/auth/login", Map.of("username", c[0], "password", c[1]), null)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                    .andExpect(jsonPath("$.message").value("Usuário ou senha inválidos"))
                    .andReturn().getResponse().getContentAsString();
            var node = json.readTree(body);
            String signature = node.get("status") + node.get("code").asString() + node.get("message").asString();
            if (expected == null) {
                expected = signature;
            }
            assertEquals(expected, signature);
        }
    }

    @Test
    void adminCreatesAndListsUsers() throws Exception {
        String username = unique();
        send("/users", Map.of("username", username, "password", "password-123", "role", "DISPATCHER"),
                bearer(Role.ADMIN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.role").value("DISPATCHER"))
                .andExpect(jsonPath("$.active").value(true));

        mvc.perform(get("/users").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].username").isNotEmpty())
                .andExpect(jsonPath("$.total").isNumber())
                .andExpect(content().string(not(containsString("passwordHash"))));
    }

    @Test
    void listIncludesInactiveUsersSortedByUsername() throws Exception {
        String inactiveName = "zz" + unique();
        AppUser inactive = authService.newUser(inactiveName, "password-123", Role.DISPATCHER);
        inactive.setActive(false);
        userRepository.save(inactive);

        mvc.perform(get("/users").param("limit", "100").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.username=='" + inactiveName + "')].active").value(false));

        var items = json.readTree(mvc.perform(get("/users").param("limit", "100")
                        .header("Authorization", bearer(Role.ADMIN)))
                .andReturn().getResponse().getContentAsString()).get("items");
        java.util.List<String> names = new java.util.ArrayList<>();
        items.forEach(i -> names.add(i.get("username").asString()));
        assertEquals(names.stream().sorted().toList(), names);
    }

    @Test
    void createUserRejectsCustomerRole() throws Exception {
        send("/users", Map.of("username", unique(), "password", "password-123", "role", "CUSTOMER"),
                bearer(Role.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        send("/users", Map.of("username", unique(), "password", "password-123", "role", "DRIVER"),
                bearer(Role.ADMIN))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createUserDuplicateIs409() throws Exception {
        send("/users", Map.of("username", "ADMIN", "password", "password-123", "role", "DISPATCHER"),
                bearer(Role.ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @ParameterizedTest
    @EnumSource(names = {"DISPATCHER", "FLEET_MANAGER", "CUSTOMER"})
    void nonAdminOnUsersIs403(Role role) throws Exception {
        mvc.perform(get("/users").header("Authorization", bearer(role)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
