package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.TrackingStatusRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderCreateTest extends IntegrationTest {

    @Autowired
    private OrderRepository orders;

    @Autowired
    private TrackingStatusRepository trackings;

    private record Registered(String customerId, String bearer) {
    }

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private Registered registerCustomer() {
        String suffix = unique();
        var response = authService.register(new RegisterRequest("cust-" + suffix, "password-123",
                "Cliente " + suffix, null, suffix + "@mail.com"));
        AppUser user = userRepository.findByUsername("cust-" + suffix).orElseThrow();
        return new Registered(response.publicId(), "Bearer " + jwtService.generate(user));
    }

    private ResultActions createOrder(Object body, String bearer) throws Exception {
        MockHttpServletRequestBuilder request = post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).header("Authorization", bearer);
        return mvc.perform(request);
    }

    private Map<String, Object> newPoint(String name) {
        return Map.of("name", name, "address", "Rua A, 1", "lat", -24.87, "lng", -54.33);
    }

    private String createPlace(String name) throws Exception {
        String response = mvc.perform(post("/places").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(newPoint(name))).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    private Map<String, Object> body() {
        Map<String, Object> body = new HashMap<>();
        body.put("pickup", newPoint("Origem " + unique()));
        body.put("dropoff", newPoint("Destino " + unique()));
        return body;
    }

    @Test
    void customerCreatesWithNewPlaces() throws Exception {
        Registered customer = registerCustomer();
        Map<String, Object> body = body();
        String pickupName = (String) ((Map<?, ?>) body.get("pickup")).get("name");

        String response = createOrder(body, customer.bearer())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.customer.publicId").value(customer.customerId()))
                .andExpect(jsonPath("$.trackingNumber").value(matchesPattern("KJ[A-Z0-9]{8}")))
                .andExpect(jsonPath("$.pickup.name").value(pickupName))
                .andReturn().getResponse().getContentAsString();

        String pickupId = json.readTree(response).get("pickup").get("publicId").asString();
        mvc.perform(get("/places/" + pickupId).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(pickupName));
    }

    @Test
    void staffUsesPlaceIdAndCustomerId() throws Exception {
        Registered customer = registerCustomer();
        Map<String, Object> body = body();
        body.put("pickup", Map.of("placeId", createPlace("Depósito " + unique())));
        body.put("customerId", customer.customerId());

        createOrder(body, bearer(Role.DISPATCHER))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customer.publicId").value(customer.customerId()))
                .andExpect(jsonPath("$.pickup.publicId").value(matchesPattern("place_[a-z0-9]{6}")));
    }

    @Test
    void staffWithoutCustomer() throws Exception {
        createOrder(body(), bearer(Role.ADMIN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customer").value(nullValue()));
    }

    @Test
    void unknownCustomerIdIs404() throws Exception {
        Map<String, Object> body = body();
        body.put("customerId", "customer_zzzzzz");
        createOrder(body, bearer(Role.ADMIN)).andExpect(status().isNotFound());
    }

    @Test
    void customerIdIgnoredForCustomer() throws Exception {
        Registered own = registerCustomer();
        Registered other = registerCustomer();
        Map<String, Object> body = body();
        body.put("customerId", other.customerId());

        createOrder(body, own.bearer())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customer.publicId").value(own.customerId()));
    }

    @Test
    void customerRoleWithoutCustomerRowIs404() throws Exception {
        createOrder(body(), bearer(Role.CUSTOMER)).andExpect(status().isNotFound());
    }

    @Test
    void pointWithBothIs400() throws Exception {
        Map<String, Object> both = body();
        both.put("pickup", Map.of("placeId", "place_abcdef", "name", "X"));
        createOrder(both, bearer(Role.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        Map<String, Object> empty = body();
        empty.put("dropoff", Map.of());
        createOrder(empty, bearer(Role.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void newPlaceNeedsNameLatLng() throws Exception {
        Map<String, Object> body = body();
        body.put("dropoff", Map.of("name", "Sem coordenadas"));
        createOrder(body, bearer(Role.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void latOutOfRangeIs400() throws Exception {
        Map<String, Object> body = body();
        body.put("dropoff", Map.of("name", "Longe", "lat", 91.0, "lng", -54.33));
        createOrder(body, bearer(Role.ADMIN)).andExpect(status().isBadRequest());
    }

    @Test
    void inactivePlaceIs404() throws Exception {
        String placeId = createPlace("Apagado " + unique());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/places/" + placeId)
                .header("Authorization", bearer(Role.ADMIN))).andExpect(status().isNoContent());
        Map<String, Object> body = body();
        body.put("pickup", Map.of("placeId", placeId));
        createOrder(body, bearer(Role.ADMIN)).andExpect(status().isNotFound());
    }

    @Test
    void missingDropoffIs422() throws Exception {
        Map<String, Object> body = body();
        body.remove("dropoff");
        createOrder(body, bearer(Role.ADMIN))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ORDER_PAYLOAD_INCOMPLETE"));
    }

    @Test
    void tooManyWaypointsIs400() throws Exception {
        Map<String, Object> body = body();
        List<Object> waypoints = new ArrayList<>();
        for (int i = 0; i < 51; i++) {
            waypoints.add(newPoint("Parada " + i));
        }
        body.put("waypoints", waypoints);
        createOrder(body, bearer(Role.ADMIN)).andExpect(status().isBadRequest());
    }

    @Test
    void waypointsKeepOrder() throws Exception {
        Map<String, Object> body = body();
        body.put("waypoints", List.of(newPoint("Primeira"), newPoint("Segunda")));
        createOrder(body, bearer(Role.ADMIN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.waypoints", hasSize(2)))
                .andExpect(jsonPath("$.waypoints[0].name").value("Primeira"))
                .andExpect(jsonPath("$.waypoints[1].name").value("Segunda"));
    }

    @Test
    void itemsValidated() throws Exception {
        Map<String, Object> invalid = body();
        invalid.put("items", List.of(Map.of("name", "Caixa", "quantity", 0)));
        createOrder(invalid, bearer(Role.ADMIN)).andExpect(status().isBadRequest());

        Map<String, Object> valid = body();
        valid.put("items", List.of(Map.of("name", "Caixa P", "quantity", 2), Map.of("name", "Caixa G", "quantity", 1)));
        createOrder(valid, bearer(Role.ADMIN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].name").value("Caixa P"))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.items[1].name").value("Caixa G"));
    }

    @Test
    void metaRoundTripsAndMustBeObject() throws Exception {
        Map<String, Object> valid = body();
        valid.put("meta", Map.of("externalRef", "PED-991"));
        valid.put("podRequired", true);
        valid.put("notes", "Interfone 12");
        createOrder(valid, bearer(Role.ADMIN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.meta.externalRef").value("PED-991"))
                .andExpect(jsonPath("$.podRequired").value(true))
                .andExpect(jsonPath("$.notes").value("Interfone 12"));

        Map<String, Object> invalid = body();
        invalid.put("meta", List.of(1, 2));
        createOrder(invalid, bearer(Role.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void createWritesTrackingCreated() throws Exception {
        String response = createOrder(body(), bearer(Role.DISPATCHER))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        Order order = orders.findByPublicId(json.readTree(response).get("publicId").asString()).orElseThrow();

        var rows = trackings.findByOrderOrderByCreatedAtAscIdAsc(order);
        assertEquals(1, rows.size());
        assertEquals("created", rows.get(0).getCode());
        assertEquals(OrderStatus.CREATED, rows.get(0).getStatus());
    }

    @Test
    void fleetManagerCannotCreate() throws Exception {
        createOrder(body(), bearer(Role.FLEET_MANAGER)).andExpect(status().isForbidden());
    }

    @Test
    void nullWaypointIs400() throws Exception {
        Map<String, Object> body = body();
        body.put("waypoints", java.util.Collections.singletonList(null));
        createOrder(body, bearer(Role.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void nullItemIs400() throws Exception {
        Map<String, Object> body = body();
        body.put("items", java.util.Collections.singletonList(null));
        createOrder(body, bearer(Role.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void blankPlaceIdIsAbsent() throws Exception {
        Map<String, Object> onlyBlank = body();
        onlyBlank.put("pickup", Map.of("placeId", "  "));
        createOrder(onlyBlank, bearer(Role.ADMIN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        Map<String, Object> withNew = body();
        withNew.put("pickup", Map.of("placeId", "", "name", "Novo", "lat", -24.87, "lng", -54.33));
        createOrder(withNew, bearer(Role.ADMIN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pickup.name").value("Novo"));
    }
}
