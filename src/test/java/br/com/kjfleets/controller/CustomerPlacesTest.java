package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CustomerPlacesTest extends IntegrationTest {

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private String newCustomer() {
        String suffix = unique();
        authService.register(new RegisterRequest("cp-" + suffix, "password-123", "Cliente " + suffix, null,
                suffix + "@mail.com"));
        return "Bearer " + jwtService.generate(userRepository.findByUsername("cp-" + suffix).orElseThrow());
    }

    private Map<String, Object> placeBody(String name) {
        return Map.of("name", name, "address", "Rua B, 2", "lat", -24.87, "lng", -54.33);
    }

    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                               String bearer, Object body) throws Exception {
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return mvc.perform(request.header("Authorization", bearer));
    }

    private String createPlace(String bearer, String path, String name) throws Exception {
        String response = send(post(path), bearer, placeBody(name)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private ResultActions order(String bearer, Object pickup, Object dropoff) throws Exception {
        return send(post("/orders"), bearer, Map.of("pickup", pickup, "dropoff", dropoff));
    }

    @Test
    void customerCrudOwnPlaces() throws Exception {
        String bearer = newCustomer();
        String name = "Casa " + unique();
        String id = createPlace(bearer, "/customer/places", name);

        send(get("/customer/places").param("q", name), bearer, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].publicId").value(id));
        send(get("/customer/places/" + id), bearer, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(name));
        send(put("/customer/places/" + id), bearer, placeBody(name + " 2")).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(name + " 2"));
        send(delete("/customer/places/" + id), bearer, null).andExpect(status().isNoContent());
        send(get("/customer/places/" + id), bearer, null).andExpect(status().isNotFound());
        send(get("/customer/places").param("q", name), bearer, null).andExpect(jsonPath("$.items.length()").value(0));
        send(get("/customer/places"), bearer(Role.ADMIN), null).andExpect(status().isForbidden());
    }

    @Test
    void customerCannotSeeOthersPlaces() throws Exception {
        String owner = newCustomer();
        String other = newCustomer();
        String id = createPlace(owner, "/customer/places", "Privado " + unique());

        send(get("/customer/places/" + id), other, null).andExpect(status().isNotFound());
        send(put("/customer/places/" + id), other, placeBody("x")).andExpect(status().isNotFound());
        send(delete("/customer/places/" + id), other, null).andExpect(status().isNotFound());
        send(get("/customer/places").param("limit", "100"), other, null)
                .andExpect(jsonPath("$.items[*].publicId", not(hasItem(id))));
    }

    @Test
    void staffPlacesListExcludesCustomerPlaces() throws Exception {
        String bearer = newCustomer();
        String name = "Oculto " + unique();
        String id = createPlace(bearer, "/customer/places", name);

        send(get("/places").param("q", name), bearer(Role.ADMIN), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
        send(get("/places/" + id), bearer(Role.ADMIN), null).andExpect(status().isNotFound());
        send(put("/places/" + id), bearer(Role.ADMIN), placeBody("x")).andExpect(status().isNotFound());
        send(delete("/places/" + id), bearer(Role.ADMIN), null).andExpect(status().isNotFound());
        send(post("/places/" + id + "/reactivate"), bearer(Role.ADMIN), null).andExpect(status().isNotFound());
    }

    @Test
    void customerOrderWithOwnPlace() throws Exception {
        String bearer = newCustomer();
        String id = createPlace(bearer, "/customer/places", "Minha " + unique());

        order(bearer, Map.of("placeId", id), Map.of("placeId", id)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.pickup.publicId").value(id));
    }

    @Test
    void foreignPlaceIs404() throws Exception {
        String owner = newCustomer();
        String other = newCustomer();
        String id = createPlace(owner, "/customer/places", "Alheia " + unique());
        Map<String, Object> inline = Map.of("name", "Novo " + unique(), "lat", -24.8, "lng", -54.3);

        order(other, Map.of("placeId", id), inline).andExpect(status().isNotFound());
        send(get("/orders"), other, null).andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void customerCanStillUseStaffPlace() throws Exception {
        String shared = createPlace(bearer(Role.ADMIN), "/places", "Compartilhado " + unique());

        order(newCustomer(), Map.of("placeId", shared), Map.of("placeId", shared)).andExpect(status().isCreated());
    }

    @Test
    void customerInlinePlaceBecomesTheirs() throws Exception {
        String bearer = newCustomer();
        String name = "Inline " + unique();
        order(bearer, Map.of("name", name, "lat", -24.8, "lng", -54.3), Map.of("name", "Outro " + unique(), "lat", -24.8,
                "lng", -54.3)).andExpect(status().isCreated());

        send(get("/customer/places").param("q", name), bearer, null).andExpect(jsonPath("$.items.length()").value(1));
        send(get("/places").param("q", name), bearer(Role.ADMIN), null).andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void editPlaceInActiveOrder409() throws Exception {
        String bearer = newCustomer();
        String id = createPlace(bearer, "/customer/places", "Em uso " + unique());
        String free = createPlace(bearer, "/customer/places", "Livre " + unique());
        order(bearer, Map.of("placeId", id), Map.of("placeId", free)).andExpect(status().isCreated());

        send(put("/customer/places/" + id), bearer, placeBody("novo")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESOURCE_IN_USE"));
        String unused = createPlace(bearer, "/customer/places", "Solto " + unique());
        send(put("/customer/places/" + unused), bearer, placeBody("ok")).andExpect(status().isOk());
    }

    @Test
    void staffCanUseCustomerPlace() throws Exception {
        String id = createPlace(newCustomer(), "/customer/places", "Do cliente " + unique());

        order(bearer(Role.DISPATCHER), Map.of("placeId", id), Map.of("placeId", id)).andExpect(status().isCreated());
    }
}
