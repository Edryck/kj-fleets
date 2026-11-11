package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DriverSelfControllerTest extends IntegrationTest {

    private static final String PASSWORD = "password-123";

    private String username;
    private String driverId;

    private void newDriverWithVehicle() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        username = "self-" + suffix;
        String vehicleBody = mvc.perform(post("/vehicles").header("Authorization", bearer(Role.FLEET_MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("plate", "S" + suffix.toUpperCase(), "type", "VAN"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String vehicleId = json.readTree(vehicleBody).get("publicId").asString();
        String body = mvc.perform(post("/drivers").header("Authorization", bearer(Role.FLEET_MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("username", username, "password", PASSWORD,
                                "name", "Self " + suffix, "vehicleId", vehicleId))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        driverId = json.readTree(body).get("publicId").asString();
    }

    private org.springframework.test.web.servlet.ResultActions sendLocation(String body) throws Exception {
        return mvc.perform(post("/driver/location").with(httpBasic(username, PASSWORD))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void meReturnsOwnData() throws Exception {
        newDriverWithVehicle();

        mvc.perform(get("/driver/me").with(httpBasic(username, PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.publicId").value(driverId))
                .andExpect(jsonPath("$.vehicle").exists());
    }

    @Test
    void locationIsSaved() throws Exception {
        newDriverWithVehicle();

        sendLocation("{\"lat\":-24.864,\"lng\":-54.336}").andExpect(status().isNoContent());

        mvc.perform(get("/drivers/" + driverId).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lat").value(-24.864))
                .andExpect(jsonPath("$.lng").value(-54.336))
                .andExpect(jsonPath("$.lastSeenAt").exists());
    }

    @Test
    void locationOutOfRangeIs400() throws Exception {
        newDriverWithVehicle();

        sendLocation("{\"lat\":91,\"lng\":0}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        sendLocation("{\"lat\":0,\"lng\":-181}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        sendLocation("{\"lng\":0}").andExpect(status().isBadRequest());
    }

    @Test
    void wrongPasswordIs401() throws Exception {
        newDriverWithVehicle();

        mvc.perform(get("/driver/me").with(httpBasic(username, "wrong-password")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }
}
