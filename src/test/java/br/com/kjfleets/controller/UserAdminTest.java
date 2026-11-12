package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserAdminTest extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    private AppUser staff(Role role) {
        return authService.newUser("u" + UUID.randomUUID().toString().substring(0, 8), "password-123", role);
    }

    private String bearerOf(AppUser user) {
        return "Bearer " + jwtService.generate(user);
    }

    private ResultActions setRole(String auth, String publicId, String role) throws Exception {
        return mvc.perform(put("/users/" + publicId).header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("role", role))));
    }

    private ResultActions action(String auth, String publicId, String action) throws Exception {
        return mvc.perform(post("/users/" + publicId + "/" + action).header("Authorization", auth));
    }

    private ResultActions login(String username) throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username, "password", "password-123"))));
    }

    @Test
    void listHasPublicId() throws Exception {
        AppUser user = staff(Role.DISPATCHER);
        mvc.perform(get("/users?limit=200").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].publicId").value(hasItem(user.getPublicId())))
                .andExpect(jsonPath("$.items[0].password").doesNotExist())
                .andExpect(jsonPath("$.items[0].passwordHash").doesNotExist());
    }

    @Test
    void changeRole() throws Exception {
        AppUser user = staff(Role.DISPATCHER);
        String token = bearerOf(user);
        mvc.perform(post("/vehicles").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{}")).andExpect(status().isForbidden());
        setRole(bearer(Role.ADMIN), user.getPublicId(), "FLEET_MANAGER")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("FLEET_MANAGER"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        // mesmo token antigo: o filtro lê o papel do banco
        mvc.perform(post("/vehicles").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{}")).andExpect(status().isBadRequest());
    }

    @Test
    void deactivateBlocksLoginAndRest() throws Exception {
        AppUser user = staff(Role.DISPATCHER);
        String token = bearerOf(user);
        mvc.perform(get("/me").header("Authorization", token)).andExpect(status().isOk());
        action(bearer(Role.ADMIN), user.getPublicId(), "deactivate").andExpect(status().isNoContent());
        action(bearer(Role.ADMIN), user.getPublicId(), "deactivate").andExpect(status().isNoContent());
        login(user.getUsername()).andExpect(status().isUnauthorized());
        mvc.perform(get("/me").header("Authorization", token)).andExpect(status().isUnauthorized());
    }

    @Test
    void reactivate() throws Exception {
        AppUser user = staff(Role.DISPATCHER);
        action(bearer(Role.ADMIN), user.getPublicId(), "reactivate").andExpect(status().isNoContent());
        action(bearer(Role.ADMIN), user.getPublicId(), "deactivate").andExpect(status().isNoContent());
        action(bearer(Role.ADMIN), user.getPublicId(), "reactivate").andExpect(status().isNoContent());
        login(user.getUsername()).andExpect(status().isOk());
    }

    @Test
    void selfDemoteAndDeactivateRefused() throws Exception {
        AppUser admin = staff(Role.ADMIN);
        String auth = bearerOf(admin);
        setRole(auth, admin.getPublicId(), "DISPATCHER").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
        action(auth, admin.getPublicId(), "deactivate").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
        setRole(auth, admin.getPublicId(), "ADMIN").andExpect(status().isOk());
    }

    @Test
    void staleCallerIsRefused() {
        AppUser stale = staff(Role.ADMIN);
        AppUser target = staff(Role.DISPATCHER);
        jdbc.update("update users set role = 'DISPATCHER' where id = ?", stale.getId());
        for (Runnable call : List.<Runnable>of(
                () -> authService.updateUser(stale.getUsername(), target.getPublicId(), Role.ADMIN),
                () -> authService.setUserActive(stale.getUsername(), target.getPublicId(), false),
                () -> authService.setUserActive(stale.getUsername(), target.getPublicId(), true))) {
            BusinessException e = assertThrows(BusinessException.class, call::run);
            assertEquals(HttpStatus.FORBIDDEN, e.status());
        }
        assertEquals("DISPATCHER", jdbc.queryForObject("select role from users where id = ?", String.class,
                target.getId()));
    }

    @Test
    void deactivatedCallerIsRefused() {
        AppUser stale = staff(Role.ADMIN);
        AppUser target = staff(Role.ADMIN);
        jdbc.update("update users set active = false where id = ?", stale.getId());
        assertThrows(BusinessException.class,
                () -> authService.updateUser(stale.getUsername(), target.getPublicId(), Role.DISPATCHER));
    }

    @Test
    void lastTwoAdminsCannotBothFall() throws Exception {
        AppUser a = staff(Role.ADMIN);
        AppUser b = staff(Role.ADMIN);
        List<String> others = jdbc.queryForList(
                "select id::text from users where role = 'ADMIN' and active and id not in (?, ?)",
                String.class, a.getId(), b.getId());
        others.forEach(id -> jdbc.update("update users set active = false where id = ?::uuid", id));
        try {
            authService.updateUser(a.getUsername(), b.getPublicId(), Role.DISPATCHER);
            // b agora é um chamador velho (token ainda válido, papel já mudou)
            BusinessException e = assertThrows(BusinessException.class,
                    () -> authService.updateUser(b.getUsername(), a.getPublicId(), Role.DISPATCHER));
            assertEquals(HttpStatus.FORBIDDEN, e.status());
            assertEquals(1, jdbc.queryForObject(
                    "select count(*) from users where role = 'ADMIN' and active and id in (?, ?)", Integer.class,
                    a.getId(), b.getId()));
        } finally {
            others.forEach(id -> jdbc.update("update users set active = true where id = ?::uuid", id));
        }
    }

    @Test
    void cannotManageCustomerOrDriver() throws Exception {
        AppUser customer = staff(Role.CUSTOMER);
        AppUser driver = staff(Role.DRIVER);
        for (AppUser target : List.of(customer, driver)) {
            setRole(bearer(Role.ADMIN), target.getPublicId(), "DISPATCHER").andExpect(status().isBadRequest());
            action(bearer(Role.ADMIN), target.getPublicId(), "deactivate").andExpect(status().isBadRequest());
            action(bearer(Role.ADMIN), target.getPublicId(), "reactivate").andExpect(status().isBadRequest());
        }
    }

    @Test
    void cannotAssignCustomerOrDriverRole() throws Exception {
        AppUser user = staff(Role.DISPATCHER);
        setRole(bearer(Role.ADMIN), user.getPublicId(), "CUSTOMER").andExpect(status().isBadRequest());
        setRole(bearer(Role.ADMIN), user.getPublicId(), "DRIVER").andExpect(status().isBadRequest());
        setRole(bearer(Role.ADMIN), user.getPublicId(), "BOGUS").andExpect(status().isBadRequest());
    }

    @Test
    void nonAdminForbidden() throws Exception {
        AppUser user = staff(Role.DISPATCHER);
        String auth = bearer(Role.DISPATCHER);
        setRole(auth, user.getPublicId(), "ADMIN").andExpect(status().isForbidden());
        action(auth, user.getPublicId(), "deactivate").andExpect(status().isForbidden());
        action(auth, user.getPublicId(), "reactivate").andExpect(status().isForbidden());
        mvc.perform(get("/users").header("Authorization", auth)).andExpect(status().isForbidden());
    }

    @Test
    void unknownUser404() throws Exception {
        setRole(bearer(Role.ADMIN), "usr_zzzzzz", "ADMIN").andExpect(status().isNotFound());
        action(bearer(Role.ADMIN), "usr_zzzzzz", "deactivate").andExpect(status().isNotFound());
    }
}
