package br.com.kjfleets.controller;

import br.com.kjfleets.RoadFixtureTest;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GraphControllerTest extends RoadFixtureTest {

    private static final String ROUTE = "/graph/route?fromLat=-24.86&fromLng=-54.33&toLat=-24.866&toLng=-54.321";

    @Test
    void graphEndpointsPermissions() throws Exception {
        for (Role role : new Role[]{Role.CUSTOMER}) {
            mvc.perform(get("/graph/status").header("Authorization", bearer(role))).andExpect(status().isForbidden());
            mvc.perform(get(ROUTE).header("Authorization", bearer(role))).andExpect(status().isForbidden());
        }
        mvc.perform(get("/graph/status")).andExpect(status().isUnauthorized());
        for (Role role : new Role[]{Role.ADMIN, Role.DISPATCHER, Role.FLEET_MANAGER}) {
            mvc.perform(get("/graph/status").header("Authorization", bearer(role))).andExpect(status().isOk());
        }
    }

    @Test
    void statusAndRoute() throws Exception {
        mvc.perform(get("/graph/status").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mode").value("ROAD"))
                .andExpect(jsonPath("$.loaded").value(true)).andExpect(jsonPath("$.nodes").value(greaterThan(0)));
        mvc.perform(get(ROUTE).header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.distanceSource").value("ROAD"))
                .andExpect(jsonPath("$.km").value(greaterThan(0.0)))
                .andExpect(jsonPath("$.path.length()").value(greaterThan(1)));
        mvc.perform(get("/graph/route?fromLat=-24.86&fromLng=-54.33&toLat=-30&toLng=-40")
                        .header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.distanceSource").value("HAVERSINE"));
        mvc.perform(get("/graph/route?fromLat=95&fromLng=-54.33&toLat=-24&toLng=-54")
                        .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isBadRequest());
    }
}
