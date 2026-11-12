package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderSearchTest extends IntegrationTest {

    @Autowired
    private OrderRepository orders;

    private record Created(String publicId, String trackingNumber) {
    }

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private Created create(String pickup, String dropoff, String bearer) throws Exception {
        Map<String, Object> body = Map.of(
                "pickup", Map.of("name", pickup, "address", "Rua A, 1", "lat", -24.87, "lng", -54.33),
                "dropoff", Map.of("name", dropoff, "address", "Rua B, 2", "lat", -24.87, "lng", -54.33));
        String response = mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).header("Authorization", bearer))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var node = json.readTree(response);
        return new Created(node.get("publicId").asString(), node.get("trackingNumber").asString());
    }

    private Created create(String pickup, String dropoff) throws Exception {
        return create(pickup, dropoff, bearer(Role.DISPATCHER));
    }

    private ResultActions list(String bearer, String... params) throws Exception {
        MockHttpServletRequestBuilder request = get("/orders").header("Authorization", bearer).param("limit", "100");
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return mvc.perform(request);
    }

    private List<String> ids(ResultActions result) throws Exception {
        String response = result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> ids = new ArrayList<>();
        json.readTree(response).get("items").forEach(item -> ids.add(item.get("publicId").asString()));
        return ids;
    }

    private List<String> search(String q, String... extra) throws Exception {
        String[] params = new String[extra.length + 2];
        params[0] = "q";
        params[1] = q;
        System.arraycopy(extra, 0, params, 2, extra.length);
        return ids(list(bearer(Role.DISPATCHER), params));
    }

    @Test
    void qMatchesTrackingNumber() throws Exception {
        Created order = create("Origem " + unique(), "Destino " + unique());
        create("Origem " + unique(), "Destino " + unique());

        assertEquals(List.of(order.publicId()), search("  " + order.trackingNumber().toLowerCase() + " "));
    }

    @Test
    void qMatchesPickupOrDropoffName() throws Exception {
        String tag = unique();
        Created byPickup = create("Armazem " + tag + " Norte", "Destino " + unique());
        Created byDropoff = create("Origem " + unique(), "Loja " + tag + " Sul");
        create("Origem " + unique(), "Destino " + unique());

        List<String> found = search("ARMAZEM " + tag);
        assertEquals(List.of(byPickup.publicId()), found);
        assertEquals(List.of(byDropoff.publicId()), search("loja " + tag));
        assertEquals(2, search(tag).size());
    }

    @Test
    void qIsLiteral() throws Exception {
        String tag = unique();
        Created literal = create("Promo 50%_off " + tag, "Destino " + unique());
        Created lookalike = create("Promo 50Zxoff " + tag, "Destino " + unique());
        Created backslash = create("Pasta a\\b " + tag, "Destino " + unique());
        Created plain = create("Pasta ab " + tag, "Destino " + unique());

        assertEquals(List.of(literal.publicId()), search("50%_off " + tag));
        assertEquals(List.of(backslash.publicId()), search("a\\b " + tag));
        List<String> percent = search("%");
        assertEquals(false, percent.contains(lookalike.publicId()) || percent.contains(plain.publicId()));
    }

    @Test
    void blankQMeansNoFilter() throws Exception {
        Created order = create("Origem " + unique(), "Destino " + unique());

        assertEquals(true, search("   ", "limit", "100").contains(order.publicId()));
    }

    @Test
    void qTooLong400() throws Exception {
        list(bearer(Role.DISPATCHER), "q", "a".repeat(101)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        list(bearer(Role.DISPATCHER), "q", "a".repeat(100)).andExpect(status().isOk());
    }

    @Test
    void qDoesNotDuplicateRowsOrBreakCount() throws Exception {
        String tag = unique();
        create("Mesmo " + tag, "Mesmo " + tag);
        create("Mesmo " + tag, "Outro " + unique());
        create("Outro " + unique(), "Mesmo " + tag);

        list(bearer(Role.DISPATCHER), "q", tag).andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items.length()").value(3));
        list(bearer(Role.DISPATCHER), "q", tag, "limit", "2", "offset", "2")
                .andExpect(jsonPath("$.total").value(3)).andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void sortByStatusAsc() throws Exception {
        String tag = unique();
        Created created = create("Ordena " + tag, "Destino " + unique());
        Created completed = create("Ordena " + tag, "Destino " + unique());
        Created cancelled = create("Ordena " + tag, "Destino " + unique());
        setStatus(completed.publicId(), OrderStatus.COMPLETED);
        setStatus(cancelled.publicId(), OrderStatus.CANCELLED);

        List<String> asc = ids(list(bearer(Role.DISPATCHER), "q", tag, "sort", "status", "dir", "asc"));
        assertEquals(List.of(cancelled.publicId(), completed.publicId(), created.publicId()), asc);
        List<String> desc = ids(list(bearer(Role.DISPATCHER), "q", tag, "sort", "status", "dir", "desc"));
        assertEquals(List.of(created.publicId(), completed.publicId(), cancelled.publicId()), desc);
    }

    @Test
    void defaultOrderIsNewestFirst() throws Exception {
        String tag = unique();
        Created first = create("Ordem " + tag, "Destino " + unique());
        Created second = create("Ordem " + tag, "Destino " + unique());

        assertEquals(List.of(second.publicId(), first.publicId()), search(tag));
        assertEquals(List.of(first.publicId(), second.publicId()), search(tag, "dir", "asc"));
    }

    @Test
    void invalidSortOrDir400() throws Exception {
        list(bearer(Role.DISPATCHER), "sort", "trackingNumber").andExpect(status().isBadRequest());
        list(bearer(Role.DISPATCHER), "dir", "up").andExpect(status().isBadRequest());
    }

    @Test
    void customerSearchOwnOnly() throws Exception {
        String tag = unique();
        String suffix = unique();
        authService.register(new RegisterRequest("cust-" + suffix, "password-123",
                "Cliente " + suffix, null, suffix + "@mail.com"));
        AppUser user = userRepository.findByUsername("cust-" + suffix).orElseThrow();
        String own = "Bearer " + jwtService.generate(user);
        Created mine = create("Meu " + tag, "Destino " + unique(), own);
        Created other = create("Alheio " + tag, "Destino " + unique());

        assertEquals(List.of(mine.publicId()), ids(list(own, "q", tag)));
        assertEquals(List.of(), ids(list(own, "q", other.trackingNumber())));
    }

    private void setStatus(String publicId, OrderStatus status) {
        Order order = orders.findByPublicId(publicId).orElseThrow();
        order.setStatus(status);
        orders.save(order);
    }
}
