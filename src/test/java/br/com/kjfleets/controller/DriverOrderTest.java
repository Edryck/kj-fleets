package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DriverOrderTest extends IntegrationTest {

    private static final String PASSWORD = "password-123";

    private OrderFixtures fixtures;

    private record TestDriver(String id, String username) {
    }

    @BeforeEach
    void setUp() {
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    private TestDriver newDriver() throws Exception {
        String driverId = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String username = body(mvc.perform(get("/drivers/" + driverId).header("Authorization", bearer(Role.ADMIN))))
                .get("username").asString();
        return new TestDriver(driverId, username);
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private ResultActions postJson(String path, Object payload, String bearer) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload)).header("Authorization", bearer));
    }

    private ResultActions driverGet(TestDriver driver, String path) throws Exception {
        return mvc.perform(get(path).with(httpBasic(driver.username(), PASSWORD)));
    }

    private ResultActions driverPost(TestDriver driver, String path, Object payload) throws Exception {
        return mvc.perform(post(path).with(httpBasic(driver.username(), PASSWORD))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload)));
    }

    private String newOrder(boolean podRequired) throws Exception {
        Map<String, Object> point = Map.of("name", "Ponto " + UUID.randomUUID(), "lat", -24.87, "lng", -54.33);
        Map<String, Object> payload = Map.of("pickup", point, "dropoff", point, "podRequired", podRequired,
                "notes", "portão azul");
        return body(postJson("/orders", payload, bearer(Role.DISPATCHER))).get("publicId").asString();
    }

    private String assign(String orderId, TestDriver driver) throws Exception {
        postJson("/orders/" + orderId + "/assign", Map.of("driverId", driver.id()), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());
        return orderId;
    }

    private String assigned(TestDriver driver) throws Exception {
        return assign(newOrder(false), driver);
    }

    private void dispatch(String orderId) throws Exception {
        mvc.perform(post("/orders/" + orderId + "/dispatch").header("Authorization", bearer(Role.DISPATCHER)))
                .andExpect(status().isOk());
    }

    // o pedido novo pode cair em qualquer página do banco compartilhado; anda até achar
    private JsonNode availableItem(TestDriver driver, String orderId) throws Exception {
        int offset = 0;
        while (true) {
            JsonNode page = body(driverGet(driver, "/driver/orders?available=true&limit=100&offset=" + offset)
                    .andExpect(status().isOk()));
            for (JsonNode item : page.get("items")) {
                if (item.get("publicId").asString().equals(orderId)) {
                    return item;
                }
            }
            offset += 100;
            if (offset >= page.get("total").asLong()) {
                throw new AssertionError("pedido " + orderId + " não apareceu na lista de disponíveis");
            }
        }
    }

    @Test
    void listsOnlyOwnActiveFirst() throws Exception {
        TestDriver driver = newDriver();
        TestDriver other = newDriver();
        String cancelled = assigned(driver);
        postJson("/orders/" + cancelled + "/cancel", Map.of("reason", "desistiu"), bearer(Role.DISPATCHER))
                .andExpect(status().isOk());
        String created = assigned(driver);
        String dispatched = assigned(driver);
        dispatch(dispatched);
        String foreign = assigned(other);

        driverGet(driver, "/driver/orders").andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items[*].publicId").value(contains(dispatched, created, cancelled)))
                .andExpect(jsonPath("$.items[*].publicId").value(not(hasItem(foreign))));
    }

    @Test
    void availableHidesCustomerData() throws Exception {
        TestDriver driver = newDriver();
        String orderId = newOrder(false);

        JsonNode item = availableItem(driver, orderId);

        assertFalse(item.has("customer"));
        assertFalse(item.has("notes"));
        assertFalse(item.has("meta"));
        assertFalse(item.get("podRequired").asBoolean());
    }

    @Test
    void detailOfOtherDriverIs404() throws Exception {
        TestDriver driver = newDriver();
        TestDriver other = newDriver();
        String orderId = assigned(driver);

        JsonNode detail = body(driverGet(driver, "/driver/orders/" + orderId).andExpect(status().isOk()));
        assertEquals(orderId, detail.get("publicId").asString());
        assertFalse(detail.has("customer"));
        assertFalse(detail.has("meta"));
        driverGet(other, "/driver/orders/" + orderId).andExpect(status().isNotFound());
    }

    @Test
    void driverAdvancesOwnOrder() throws Exception {
        TestDriver driver = newDriver();
        String orderId = assigned(driver);
        dispatch(orderId);

        driverPost(driver, "/driver/orders/" + orderId + "/activity",
                Map.of("code", "DRIVER_ENROUTE", "lat", -24.8, "lng", -54.3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRIVER_ENROUTE"))
                .andExpect(jsonPath("$.customer").doesNotExist());

        mvc.perform(get("/drivers/" + driver.id()).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$.lat").value(-24.8))
                .andExpect(jsonPath("$.lng").value(-54.3))
                .andExpect(jsonPath("$.lastSeenAt").exists());
    }

    @Test
    void driverCannotAdvanceOthers() throws Exception {
        TestDriver owner = newDriver();
        TestDriver other = newDriver();
        String orderId = assigned(owner);
        dispatch(orderId);

        driverPost(other, "/driver/orders/" + orderId + "/activity", Map.of("code", "DRIVER_ENROUTE"))
                .andExpect(status().isNotFound());
        driverPost(other, "/driver/orders/" + orderId + "/pod", Map.of("value", "x"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/orders/" + orderId).header("Authorization", bearer(Role.ADMIN)))
                .andExpect(jsonPath("$.status").value("DISPATCHED"));
    }

    @Test
    void driverPodAndComplete() throws Exception {
        TestDriver driver = newDriver();
        String orderId = newOrder(true);
        assign(orderId, driver);
        dispatch(orderId);
        for (String code : new String[] {"DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS"}) {
            driverPost(driver, "/driver/orders/" + orderId + "/activity", Map.of("code", code))
                    .andExpect(status().isOk());
        }

        driverPost(driver, "/driver/orders/" + orderId + "/pod", Map.of("value", "assinatura-ok"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.podValue").value("assinatura-ok"));
        driverPost(driver, "/driver/orders/" + orderId + "/activity", Map.of("code", "COMPLETED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    private String registerCustomer() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        authService.register(new RegisterRequest("cust-" + suffix, PASSWORD, "Cliente " + suffix, null,
                suffix + "@mail.com"));
        AppUser user = userRepository.findByUsername("cust-" + suffix).orElseThrow();
        return "Bearer " + jwtService.generate(user);
    }

    @Test
    void driverListHidesCustomer() throws Exception {
        TestDriver driver = newDriver();
        String customerBearer = registerCustomer();
        Map<String, Object> point = Map.of("name", "Ponto " + UUID.randomUUID(), "lat", -24.87, "lng", -54.33);
        String orderId = body(mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("pickup", point, "dropoff", point)))
                .header("Authorization", customerBearer)).andExpect(status().isCreated()))
                .get("publicId").asString();
        assign(orderId, driver);

        JsonNode item = body(driverGet(driver, "/driver/orders").andExpect(status().isOk()))
                .get("items").get(0);
        assertEquals(orderId, item.get("publicId").asString());
        assertFalse(item.has("customer"));
    }

    @Test
    void listFiltersByStatus() throws Exception {
        TestDriver driver = newDriver();
        String created = assigned(driver);
        String dispatched = assigned(driver);
        dispatch(dispatched);

        driverGet(driver, "/driver/orders?status=DISPATCHED").andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[*].publicId").value(contains(dispatched)));
        driverGet(driver, "/driver/orders?status=CREATED").andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[*].publicId").value(contains(created)));
    }

    @Test
    void jwtOnDriverOrdersIs401() throws Exception {
        mvc.perform(get("/driver/orders").header("Authorization", bearer(Role.ADMIN)))
                .andExpect(status().isUnauthorized());
    }
}
