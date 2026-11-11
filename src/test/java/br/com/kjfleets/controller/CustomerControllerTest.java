package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CustomerControllerTest extends IntegrationTest {

    @Test
    void listAndSearch() throws Exception {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        var first = authService.register(new RegisterRequest("a-" + tag, "password-123", "Ana " + tag, null,
                "ana." + tag + "@mail.com"));
        authService.register(new RegisterRequest("b-" + tag, "password-123", "Bruno " + tag, null,
                "bruno." + tag + "@mail.com"));

        mvc.perform(get("/customers").param("q", "ANA." + tag).header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].publicId").value(first.publicId()))
                .andExpect(jsonPath("$.items[0].email").value("ana." + tag + "@mail.com"));

        mvc.perform(get("/customers").param("q", tag).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].name").value("Ana " + tag));

        mvc.perform(get("/customers").header("Authorization", bearer(Role.ADMIN))).andExpect(status().isOk());
        mvc.perform(get("/customers").header("Authorization", bearer(Role.CUSTOMER))).andExpect(status().isForbidden());
    }
}
