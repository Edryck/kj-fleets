package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// entrada de usuário desastrado ou mal-intencionado: nunca pode virar 500 nem dado salvo pela metade
class HostileInputTest extends IntegrationTest {

    private static final String LONG = "x".repeat(10_000);

    @Autowired
    private OrderRepository orders;

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions postJson(String url, String body, String auth) throws Exception {
        var request = post(url).contentType(MediaType.APPLICATION_JSON).content(body);
        if (auth != null) {
            request.header("Authorization", auth);
        }
        return mvc.perform(request);
    }

    private ResultActions postJson(String url, Object body, String auth) throws Exception {
        return postJson(url, json.writeValueAsString(body), auth);
    }

    private String customerBearer() throws Exception {
        String username = "h" + unique();
        postJson("/auth/register", Map.of("username", username, "password", "password-123", "name", "Cliente"), null)
                .andExpect(status().isCreated());
        String body = postJson("/auth/login", Map.of("username", username, "password", "password-123"), null)
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(body).get("token").asString();
    }

    private static Map<String, Object> point(Object lat, Object lng) {
        Map<String, Object> point = new HashMap<>();
        point.put("name", "Ponto " + UUID.randomUUID().toString().substring(0, 6));
        point.put("address", "Rua A, 1");
        point.put("lat", lat);
        point.put("lng", lng);
        return point;
    }

    private Map<String, Object> order() {
        Map<String, Object> body = new HashMap<>();
        body.put("pickup", point(-24.87, -54.33));
        body.put("dropoff", point(-24.88, -54.34));
        return body;
    }

    private void rejected(ResultActions result) throws Exception {
        result.andExpect(status().is4xxClientError()).andExpect(jsonPath("$.code").value(not("INTERNAL_ERROR")));
    }

    @Test
    void emojiPasswordRoundTrip() throws Exception {
        String username = "e" + unique();
        String password = "senha🔒çã1";
        postJson("/auth/register", Map.of("username", username, "password", password, "name", "Emoji"), null)
                .andExpect(status().isCreated());
        postJson("/auth/login", Map.of("username", username, "password", password), null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
    }

    // BCrypt só olha 72 bytes e o Spring recusa mais que isso; emoji ocupa 4 bytes
    @Test
    void passwordOver72BytesRejectedNot500() throws Exception {
        String password = "🔒".repeat(20);
        rejected(postJson("/auth/register", Map.of("username", "p" + unique(), "password", password, "name", "X"), null));
        rejected(postJson("/auth/login", Map.of("username", "admin", "password", password), null));
        rejected(postJson("/me/password", Map.of("currentPassword", password, "newPassword", password),
                bearer(Role.ADMIN)));
    }

    @Test
    void emojiAndAccentsInNames() throws Exception {
        String username = "a" + unique();
        String name = "José 🚚 Ñandú";
        postJson("/auth/register", Map.of("username", username, "password", "password-123", "name", name), null)
                .andExpect(status().isCreated());
        String token = json.readTree(postJson("/auth/login", Map.of("username", username, "password", "password-123"),
                null).andReturn().getResponse().getContentAsString()).get("token").asString();
        mvc.perform(get("/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value(name));
    }

    static Stream<Arguments> blankRegistrations() {
        return Stream.of(
                Arguments.of("   ", "password-123", "Nome"),
                Arguments.of("b" + UUID.randomUUID().toString().substring(0, 8), "password-123", ""),
                Arguments.of("c" + UUID.randomUUID().toString().substring(0, 8), "        ", "Nome"),
                Arguments.of("d" + UUID.randomUUID().toString().substring(0, 8), "password-123", "   "));
    }

    @ParameterizedTest
    @MethodSource("blankRegistrations")
    void blankFieldsRejected(String username, String password, String name) throws Exception {
        rejected(postJson("/auth/register", Map.of("username", username, "password", password, "name", name), null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"username", "name", "password", "email", "phone"})
    void hugeStringsRejectedOnRegister(String field) throws Exception {
        Map<String, Object> body = new HashMap<>(Map.of("username", "g" + unique(), "password", "password-123",
                "name", "Nome"));
        body.put(field, field.equals("email") ? LONG + "@mail.com" : LONG);
        rejected(postJson("/auth/register", body, null));
    }

    @Test
    void hugeNotesRejectedOnOrder() throws Exception {
        Map<String, Object> body = order();
        body.put("notes", LONG);
        long before = orders.count();
        rejected(postJson("/orders", body, customerBearer()));
        assertEquals(before, orders.count());
    }

    @Test
    void hugePointNameRejected() throws Exception {
        Map<String, Object> body = order();
        @SuppressWarnings("unchecked")
        Map<String, Object> pickup = (Map<String, Object>) body.get("pickup");
        pickup.put("name", LONG);
        pickup.put("address", LONG);
        rejected(postJson("/orders", body, customerBearer()));
    }

    @Test
    void hugeBodyRejected() throws Exception {
        String body = "{\"username\":\"" + "y".repeat(1_000_000) + "\",\"password\":\"password-123\"}";
        rejected(postJson("/auth/login", body, null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{", "[]", "null", "\"texto\"", "{\"username\": 123, \"password\": []}", ""})
    void malformedJson(String body) throws Exception {
        rejected(postJson("/auth/login", body, null));
    }

    @Test
    void wrongTypeInOrder() throws Exception {
        Map<String, Object> body = order();
        body.put("pickup", point("abc", -54.33));
        rejected(postJson("/orders", body, customerBearer()));
    }

    @Test
    void injectionStoredAsText() throws Exception {
        String sql = "'); DROP TABLE orders;--";
        String html = "<script>alert(1)</script>";
        Map<String, Object> body = order();
        body.put("notes", sql + " " + html);
        String bearer = customerBearer();
        String created = postJson("/orders", body, bearer).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = json.readTree(created).get("publicId").asString();
        mvc.perform(get("/orders/" + id).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.notes").value(sql + " " + html));
    }

    static Stream<Arguments> badCoordinates() {
        return Stream.of(Arguments.of(91, -54.0), Arguments.of(-24.0, -181), Arguments.of("NaN", -54.0),
                Arguments.of(-24.0, "Infinity"));
    }

    @ParameterizedTest
    @MethodSource("badCoordinates")
    void invalidCoordinatesOnOrder(Object lat, Object lng) throws Exception {
        Map<String, Object> body = order();
        body.put("pickup", point(lat, lng));
        rejected(postJson("/orders", body, customerBearer()));
    }

    @ParameterizedTest
    @MethodSource("badCoordinates")
    void invalidCoordinatesOnDriverLocation(Object lat, Object lng) throws Exception {
        String suffix = unique();
        String username = "loc-" + suffix;
        postJson("/drivers", Map.of("username", username, "password", "password-123", "name", "Loc"),
                bearer(Role.FLEET_MANAGER)).andExpect(status().isCreated());
        Map<String, Object> body = new HashMap<>();
        body.put("lat", lat);
        body.put("lng", lng);
        rejected(mvc.perform(post("/driver/location").with(httpBasic(username, "password-123"))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))));
    }

    static Stream<Arguments> badVehicleNumbers() {
        return Stream.of(Arguments.of("capacityKg", -1), Arguments.of("capacityKg", 0),
                Arguments.of("volumeM3", -1), Arguments.of("odometerKm", -1),
                Arguments.of("year", 0), Arguments.of("year", 3000));
    }

    @ParameterizedTest
    @MethodSource("badVehicleNumbers")
    void negativeAndZeroNumbersOnVehicle(String field, int value) throws Exception {
        Map<String, Object> body = new HashMap<>(Map.of("plate", "N" + unique().toUpperCase(), "type", "VAN"));
        body.put(field, value);
        rejected(postJson("/vehicles", body, bearer(Role.FLEET_MANAGER)));
    }

    @Test
    void hugePlateRejected() throws Exception {
        rejected(postJson("/vehicles", Map.of("plate", LONG, "type", LONG), bearer(Role.FLEET_MANAGER)));
    }

    @Test
    void tooManyWaypoints() throws Exception {
        Map<String, Object> body = order();
        List<Map<String, Object>> waypoints = new ArrayList<>();
        for (int i = 0; i < 51; i++) {
            waypoints.add(point(-24.8, -54.3));
        }
        body.put("waypoints", waypoints);
        rejected(postJson("/orders", body, customerBearer()));
    }

    @Test
    void unknownIdsGive404() throws Exception {
        Map<String, Object> body = order();
        body.put("customerId", "customer_zzzzzz");
        postJson("/orders", body, bearer(Role.ADMIN)).andExpect(status().is(anyOf(is(400), is(404), is(422))));
        postJson("/orders/order_zzzzzz/assign", Map.of("driverId", "driver_zzzzzz"), bearer(Role.ADMIN))
                .andExpect(status().isNotFound());
    }
}
