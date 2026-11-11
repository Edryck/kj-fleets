package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.entity.TrackingStatus;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.TrackingStatusRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderQueryTest extends IntegrationTest {

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

    private Map<String, Object> newPoint(String name) {
        return Map.of("name", name, "address", "Rua A, 1", "lat", -24.87, "lng", -54.33);
    }

    private Map<String, Object> body() {
        Map<String, Object> body = new HashMap<>();
        body.put("pickup", newPoint("Origem " + unique()));
        body.put("dropoff", newPoint("Destino " + unique()));
        return body;
    }

    private String create(Map<String, Object> body, String bearer) throws Exception {
        MockHttpServletRequestBuilder request = post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).header("Authorization", bearer);
        String response = mvc.perform(request).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    // janela de tempo isola os pedidos deste teste dos de outras classes que compartilham o banco
    private ResultActions list(String bearer, String... params) throws Exception {
        MockHttpServletRequestBuilder request = get("/orders").header("Authorization", bearer).param("limit", "100");
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return mvc.perform(request);
    }

    private List<String> publicIds(ResultActions result) throws Exception {
        String response = result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> ids = new ArrayList<>();
        json.readTree(response).get("items").forEach(item -> ids.add(item.get("publicId").asString()));
        return ids;
    }

    private void setStatus(String publicId, OrderStatus status) {
        Order order = orders.findByPublicId(publicId).orElseThrow();
        order.setStatus(status);
        orders.save(order);
    }

    @Test
    void staffSeesAllCustomerSeesOwn() throws Exception {
        Instant start = Instant.now().minusSeconds(1);
        Registered a = registerCustomer();
        Registered b = registerCustomer();
        String orderA = create(body(), a.bearer());
        String orderB = create(body(), b.bearer());

        list(bearer(Role.FLEET_MANAGER), "from", start.toString())
                .andExpect(jsonPath("$.items[*].publicId", hasItems(orderA, orderB)));
        list(a.bearer())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].publicId").value(orderA));
    }

    @Test
    void customerFiltersAreIgnored() throws Exception {
        Registered a = registerCustomer();
        Registered b = registerCustomer();
        String orderA = create(body(), a.bearer());
        create(body(), b.bearer());

        list(a.bearer(), "customerId", b.customerId(), "driverId", "driver_zzzzzz")
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].publicId").value(orderA));
    }

    @Test
    void otherCustomersOrderIs404() throws Exception {
        Registered a = registerCustomer();
        Registered b = registerCustomer();
        String orderA = create(body(), a.bearer());
        String orderB = create(body(), b.bearer());

        mvc.perform(get("/orders/" + orderB).header("Authorization", a.bearer())).andExpect(status().isNotFound());
        mvc.perform(get("/orders/" + orderB + "/tracking").header("Authorization", a.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/orders/" + orderA).header("Authorization", a.bearer())).andExpect(status().isOk());
    }

    @Test
    void filtersByStatusAndActive() throws Exception {
        Instant start = Instant.now().minusSeconds(1);
        String created = create(body(), bearer(Role.ADMIN));
        String dispatched = create(body(), bearer(Role.ADMIN));
        setStatus(dispatched, OrderStatus.DISPATCHED);

        list(bearer(Role.FLEET_MANAGER), "from", start.toString(), "status", "DISPATCHED")
                .andExpect(jsonPath("$.items[*].publicId", hasItem(dispatched)))
                .andExpect(jsonPath("$.items[*].publicId", not(hasItem(created))));
        list(bearer(Role.FLEET_MANAGER), "from", start.toString(), "active", "true")
                .andExpect(jsonPath("$.items[*].publicId", hasItem(dispatched)))
                .andExpect(jsonPath("$.items[*].publicId", not(hasItem(created))));
        list(bearer(Role.FLEET_MANAGER), "from", start.toString(), "active", "false")
                .andExpect(jsonPath("$.items[*].publicId", hasItem(created)))
                .andExpect(jsonPath("$.items[*].publicId", not(hasItem(dispatched))));
    }

    @Test
    void filtersByDateRange() throws Exception {
        Instant start = Instant.now().minusSeconds(1);
        String order = create(body(), bearer(Role.ADMIN));

        list(bearer(Role.FLEET_MANAGER), "from", Instant.now().plus(1, ChronoUnit.DAYS).toString())
                .andExpect(jsonPath("$.items[*].publicId", not(hasItem(order))));
        list(bearer(Role.FLEET_MANAGER), "to", start.toString())
                .andExpect(jsonPath("$.items[*].publicId", not(hasItem(order))));
    }

    @Test
    void orderedByCreatedAtDesc() throws Exception {
        Instant start = Instant.now().minusSeconds(1);
        String older = create(body(), bearer(Role.ADMIN));
        String newer = create(body(), bearer(Role.ADMIN));

        List<String> ids = publicIds(list(bearer(Role.FLEET_MANAGER), "from", start.toString()));
        assertTrue(ids.indexOf(newer) >= 0 && ids.indexOf(older) >= 0);
        assertTrue(ids.indexOf(newer) < ids.indexOf(older));
    }

    @Test
    void detailHasEverything() throws Exception {
        Registered customer = registerCustomer();
        Map<String, Object> body = body();
        body.put("waypoints", List.of(newPoint("Parada 1"), newPoint("Parada 2"), newPoint("Parada 3")));
        body.put("items", List.of(Map.of("name", "Caixa", "quantity", 2)));
        body.put("notes", "Portão azul");
        body.put("meta", Map.of("externalRef", "PED-1"));
        body.put("podRequired", true);
        String id = create(body, customer.bearer());

        mvc.perform(get("/orders/" + id).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicId").value(id))
                .andExpect(jsonPath("$.customer.publicId").value(customer.customerId()))
                .andExpect(jsonPath("$.waypoints[*].name", contains("Parada 1", "Parada 2", "Parada 3")))
                .andExpect(jsonPath("$.items[0].name").value("Caixa"))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.notes").value("Portão azul"))
                .andExpect(jsonPath("$.meta.externalRef").value("PED-1"))
                .andExpect(jsonPath("$.podRequired").value(true));
    }

    @Test
    void detailKeepsItemOrder() throws Exception {
        Map<String, Object> body = body();
        body.put("items", List.of(Map.of("name", "C", "quantity", 1), Map.of("name", "A", "quantity", 1),
                Map.of("name", "B", "quantity", 1)));
        String id = create(body, bearer(Role.ADMIN));

        mvc.perform(get("/orders/" + id).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].name", contains("C", "A", "B")));
    }

    @Test
    void trackingIsChronological() throws Exception {
        String id = create(body(), bearer(Role.ADMIN));
        setStatus(id, OrderStatus.DISPATCHED);
        trackings.save(TrackingStatus.of(orders.findByPublicId(id).orElseThrow(), "dispatched",
                "Saiu para entrega", -24.9, -54.4));

        mvc.perform(get("/orders/" + id + "/tracking").header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].code").value("created"))
                .andExpect(jsonPath("$[0].status").value("CREATED"))
                .andExpect(jsonPath("$[1].code").value("dispatched"))
                .andExpect(jsonPath("$[1].status").value("DISPATCHED"))
                .andExpect(jsonPath("$[1].details").value("Saiu para entrega"))
                .andExpect(jsonPath("$[1].lat").value(-24.9))
                .andExpect(jsonPath("$[1].lng").value(-54.4))
                .andExpect(jsonPath("$[1].at").exists());
    }
}
