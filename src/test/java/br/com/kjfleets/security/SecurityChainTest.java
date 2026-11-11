package br.com.kjfleets.security;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SecurityChainTest extends IntegrationTest {

    @Autowired
    AppUserRepository users;
    @Autowired
    PasswordEncoder encoder;
    @Autowired
    JwtService jwt;

    private AppUser create(Role role) {
        AppUser user = new AppUser();
        user.setUsername("u-" + UUID.randomUUID());
        user.setPasswordHash(encoder.encode("secret-123"));
        user.setRole(role);
        return users.save(user);
    }

    @Test
    void initialAdminExists() {
        AppUser admin = users.findByUsername("admin").orElseThrow();
        assertEquals(Role.ADMIN, admin.getRole());
        assertTrue(admin.isActive());
    }

    @Test
    void noTokenIs401() throws Exception {
        mvc.perform(get("/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void deactivatedUserTokenIs401() throws Exception {
        AppUser user = create(Role.DISPATCHER);
        String token = jwt.generate(user);
        user.setActive(false);
        users.save(user);

        mvc.perform(get("/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void driverRoleTokenIs401() throws Exception {
        String token = jwt.generate(create(Role.DRIVER));

        mvc.perform(get("/vehicles").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminJwtOnDriverRouteIs401() throws Exception {
        String token = jwt.generate(users.findByUsername("admin").orElseThrow());

        mvc.perform(get("/driver/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void customerBasicOnDriverRouteIs401() throws Exception {
        AppUser customer = create(Role.CUSTOMER);

        mvc.perform(get("/driver/me").with(httpBasic(customer.getUsername(), "secret-123")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void dispatcherCannotListUsersIs403() throws Exception {
        String token = jwt.generate(create(Role.DISPATCHER));

        mvc.perform(get("/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
