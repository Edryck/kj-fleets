package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.matchesPattern;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MeTest extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    private String unique() {
        return "u" + UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions changePassword(String auth, String current, String next) throws Exception {
        return mvc.perform(put("/me/password").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("currentPassword", current, "newPassword", next))));
    }

    private ResultActions login(String username, String password) throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", password))));
    }

    private String registerCustomer(String username) throws Exception {
        mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                Map.of("username", username, "password", "password-123", "name", "Maria", "email", "m@x.com",
                        "phone", "1199"))));
        return "Bearer " + jwtService.generate(userRepository.findByUsername(username).orElseThrow());
    }

    @Test
    void meForStaff() throws Exception {
        for (Role role : new Role[]{Role.ADMIN, Role.DISPATCHER, Role.FLEET_MANAGER}) {
            mvc.perform(get("/me").header("Authorization", bearer(role)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value(role.name().toLowerCase() + "-user"))
                    .andExpect(jsonPath("$.role").value(role.name()))
                    .andExpect(jsonPath("$.publicId").value(matchesPattern("usr_[a-z0-9]{6}")))
                    .andExpect(jsonPath("$.name").doesNotExist());
        }
    }

    @Test
    void meForCustomer() throws Exception {
        String username = unique();
        String auth = registerCustomer(username);
        mvc.perform(get("/me").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("CUSTOMER"))
                .andExpect(jsonPath("$.publicId").value(matchesPattern("customer_[a-z0-9]{6}")))
                .andExpect(jsonPath("$.name").value("Maria"))
                .andExpect(jsonPath("$.email").value("m@x.com"))
                .andExpect(jsonPath("$.phone").value("1199"));
    }

    @Test
    void meRequiresAuth() throws Exception {
        mvc.perform(get("/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void changePassword() throws Exception {
        String username = unique();
        String auth = "Bearer " + jwtService.generate(authService.newUser(username, "password-123", Role.DISPATCHER));
        changePassword(auth, "password-123", "new-password-1").andExpect(status().isNoContent());
        login(username, "new-password-1").andExpect(status().isOk());
        login(username, "password-123").andExpect(status().isUnauthorized());
    }

    @Test
    void wrongCurrentPassword() throws Exception {
        String username = unique();
        String auth = "Bearer " + jwtService.generate(authService.newUser(username, "password-123", Role.DISPATCHER));
        changePassword(auth, "errada-123", "new-password-1")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        login(username, "password-123").andExpect(status().isOk());
    }

    @Test
    void shortNewPassword() throws Exception {
        changePassword(bearer(Role.DISPATCHER), "password-123", "curta")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void existingUsersBackfilled() {
        String username = unique();
        AppUser user = authService.newUser(username, "password-123", Role.DISPATCHER);
        jdbc.update("update users set public_id = null where id = ?", user.getId());
        authService.backfillPublicIds();
        String id = jdbc.queryForObject("select public_id from users where id = ?", String.class, user.getId());
        assertTrue(id.matches("usr_[a-z0-9]{6}"));
        authService.backfillPublicIds();
        assertTrue(id.equals(jdbc.queryForObject("select public_id from users where id = ?", String.class, user.getId())));
    }
}
