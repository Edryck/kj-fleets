package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.dto.RealtimeDtos.OrderTracked;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.OrderRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import tools.jackson.databind.JsonNode;

import java.lang.reflect.Type;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSocketPublishTest extends IntegrationTest {

    private static final String PASSWORD = "password-123";

    // relógio congelado: o throttle não depende do tempo real de execução do teste
    static class FrozenClock extends Clock {
        volatile Instant now = Instant.now();

        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        public Clock withZone(ZoneId zone) {
            return this;
        }

        public Instant instant() {
            return now;
        }
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean
        @Primary
        FrozenClock frozenClock() {
            return new FrozenClock();
        }
    }

    @Autowired
    FrozenClock clock;

    @LocalServerPort
    int port;

    @Autowired
    OrderRepository orders;

    @Autowired
    SimpUserRegistry userRegistry;

    @Autowired
    ApplicationEventPublisher publisher;

    @Autowired
    PlatformTransactionManager txManager;

    private final ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
    private final List<WebSocketStompClient> clients = new java.util.concurrent.CopyOnWriteArrayList<>();
    private OrderFixtures fixtures;

    private record Driver(String id, String username) {
    }

    // cada assinatura tem sua fila; mensagens de outros testes (banco e broker compartilhados) são filtradas por id
    private record Topic(BlockingQueue<JsonNode> messages) {

        JsonNode next(String idField, String id, long ms) throws Exception {
            long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(ms);
            while (true) {
                long left = deadline - System.nanoTime();
                JsonNode message = left <= 0 ? null : messages.poll(left, TimeUnit.NANOSECONDS);
                if (message == null || id.equals(message.path(idField).asString())) {
                    return message;
                }
            }
        }
    }

    @BeforeEach
    void setUp() {
        clock.now = Instant.now();
        scheduler.initialize();
        fixtures = new OrderFixtures(mvc, json, this::bearer);
    }

    @AfterEach
    void stop() {
        clients.forEach(WebSocketStompClient::stop);
        scheduler.shutdown();
    }

    private Topic subscribe(String token, String destination) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setTaskScheduler(scheduler);
        client.setMessageConverter(new JacksonJsonMessageConverter());
        clients.add(client);
        StompHeaders connect = new StompHeaders();
        connect.add("Authorization", "Bearer " + token);
        StompSession session = client.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(),
                connect, new StompSessionHandlerAdapter() {
                }).get(5, TimeUnit.SECONDS);
        BlockingQueue<JsonNode> messages = new LinkedBlockingQueue<>();
        long before = subscriptions(destination);
        session.subscribe(destination, new StompFrameHandler() {
            public Type getPayloadType(StompHeaders headers) {
                return JsonNode.class;
            }

            public void handleFrame(StompHeaders headers, Object payload) {
                messages.add((JsonNode) payload);
            }
        });
        // o broker simples não manda RECEIPT; espera a assinatura aparecer no registro antes de seguir
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (subscriptions(destination) <= before && System.nanoTime() < deadline) {
            Thread.sleep(20);
        }
        assertTrue(subscriptions(destination) > before);
        return new Topic(messages);
    }

    private long subscriptions(String destination) {
        return userRegistry.getUsers().stream().flatMap(u -> u.getSessions().stream())
                .flatMap(session -> session.getSubscriptions().stream())
                .filter(sub -> sub.getDestination().equals(destination)).count();
    }

    private String customerToken() {
        String username = "cust-" + UUID.randomUUID().toString().substring(0, 8);
        authService.register(new RegisterRequest(username, PASSWORD, "Cliente", null, null));
        return jwtService.generate(userRepository.findByUsername(username).orElseThrow());
    }

    private Driver newDriver() throws Exception {
        String id = fixtures.createDriver(fixtures.createVehicle(), DriverStatus.AVAILABLE);
        String username = json.readTree(mvc.perform(get("/drivers/" + id)
                .header("Authorization", bearer(Role.ADMIN))).andReturn().getResponse().getContentAsString())
                .get("username").asString();
        return new Driver(id, username);
    }

    private void ping(Driver driver, double lat, double lng) throws Exception {
        mvc.perform(post("/driver/location").with(httpBasic(driver.username(), PASSWORD))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("lat", lat, "lng", lng)))).andExpect(status().isNoContent());
    }

    private void dispatcherPost(String path, Object body) throws Exception {
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());
    }

    private String customerOrder(String customerToken, boolean withWaypoint) throws Exception {
        Map<String, Object> pickup = Map.of("name", "A " + UUID.randomUUID(), "lat", -24.86, "lng", -54.33);
        Map<String, Object> waypoint = Map.of("name", "W " + UUID.randomUUID(), "lat", -24.86, "lng", -54.31);
        Map<String, Object> dropoff = Map.of("name", "B " + UUID.randomUUID(), "lat", -24.86, "lng", -54.29);
        Map<String, Object> body = new HashMap<>(Map.of("pickup", pickup, "dropoff", dropoff));
        if (withWaypoint) {
            body.put("waypoints", List.of(waypoint));
        }
        String response = mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("publicId").asString();
    }

    @Test
    void staffReceivesLocation() throws Exception {
        Driver driver = newDriver();
        Topic locations = subscribe(tokenFor(Role.DISPATCHER), "/topic/fleet/locations");
        ping(driver, -24.87, -54.33);
        JsonNode event = locations.next("driverId", driver.id(), 5000);
        assertNotNull(event);
        assertEquals("AVAILABLE", event.get("status").asString());
        assertEquals(-24.87, event.get("lat").asDouble());
        assertEquals(-54.33, event.get("lng").asDouble());
        assertTrue(event.has("name") && event.has("at"));
        assertFalse(event.has("phone"));
    }

    @Test
    void locationThrottle() throws Exception {
        Driver driver = newDriver();
        Topic locations = subscribe(tokenFor(Role.DISPATCHER), "/topic/fleet/locations");
        ping(driver, -24.87, -54.33);
        assertNotNull(locations.next("driverId", driver.id(), 5000));
        ping(driver, -24.88, -54.33);
        assertNull(locations.next("driverId", driver.id(), 1000));

        Map<String, Object> body = new HashMap<>();
        body.put("name", "Motorista");
        body.put("status", "OFFLINE");
        mvc.perform(put("/drivers/" + driver.id()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).header("Authorization", bearer(Role.FLEET_MANAGER)))
                .andExpect(status().isOk());
        JsonNode event = locations.next("driverId", driver.id(), 5000);
        assertNotNull(event);
        assertEquals("OFFLINE", event.get("status").asString());
        // posição conhecida (a do último ping gravado) acompanha a mudança de status
        assertEquals(-24.88, event.get("lat").asDouble());
        // o status zerou o throttle: passou o intervalo, mas parado continua suprimido; andando, sai
        clock.now = clock.now.plusSeconds(6);
        ping(driver, -24.88, -54.33);
        assertNull(locations.next("driverId", driver.id(), 1000));
        ping(driver, -24.89, -54.33);
        assertNotNull(locations.next("driverId", driver.id(), 5000));
    }

    @Test
    void orderEventsReachStaffAndOwner() throws Exception {
        String token = customerToken();
        Driver driver = newDriver();
        String orderId = customerOrder(token, false);
        Topic staff = subscribe(tokenFor(Role.DISPATCHER), "/topic/orders");
        Topic owner = subscribe(token, "/topic/orders/" + orderId);

        dispatcherPost("/orders/" + orderId + "/assign", Map.of("driverId", driver.id()));
        dispatcherPost("/orders/" + orderId + "/dispatch", Map.of());

        JsonNode assigned = staff.next("orderId", orderId, 5000);
        assertEquals("assigned", assigned.get("code").asString());
        assertEquals(driver.id(), assigned.get("driverId").asString());
        JsonNode dispatched = staff.next("orderId", orderId, 5000);
        assertEquals("dispatched", dispatched.get("code").asString());
        assertEquals("DISPATCHED", dispatched.get("status").asString());

        JsonNode detail = owner.next("orderId", orderId, 5000);
        assertEquals("dispatched", detail.get("code").asString());
        assertEquals("DISPATCHED", detail.get("status").asString());
        assertEquals(0, detail.get("stopsDone").asInt());
        assertEquals(2, detail.get("stopsTotal").asInt());
        assertTrue(detail.has("etaMinutes"));
    }

    @Test
    void customerPayloadHasNoPosition() throws Exception {
        String token = customerToken();
        Driver driver = newDriver();
        String orderId = customerOrder(token, true);
        Topic owner = subscribe(token, "/topic/orders/" + orderId);
        ping(driver, -24.86, -54.33);

        dispatcherPost("/orders/" + orderId + "/assign", Map.of("driverId", driver.id()));
        dispatcherPost("/orders/" + orderId + "/dispatch", Map.of());
        JsonNode route = json.readTree(mvc.perform(get("/orders/" + orderId + "/route")
                .header("Authorization", bearer(Role.ADMIN))).andReturn().getResponse().getContentAsString());
        int seq = -1;
        for (JsonNode stop : route.get("stops")) {
            if (stop.get("type").asString().equals("WAYPOINT")) {
                seq = stop.get("seq").asInt();
            }
        }
        mvc.perform(post("/orders/" + orderId + "/stops/" + seq + "/complete")
                .header("Authorization", bearer(Role.DISPATCHER))).andExpect(status().isOk());

        // "assigned" nunca chega ao cliente: a primeira mensagem é a do despacho
        JsonNode dispatched = owner.next("orderId", orderId, 5000);
        assertEquals("dispatched", dispatched.get("code").asString());
        JsonNode stopDone = owner.next("orderId", orderId, 5000);
        assertEquals("stop_completed", stopDone.get("code").asString());
        assertEquals(1, stopDone.get("stopsDone").asInt());
        assertEquals(3, stopDone.get("stopsTotal").asInt());
        assertTrue(stopDone.has("etaMinutes"));
        for (JsonNode message : List.of(dispatched, stopDone)) {
            for (String forbidden : List.of("lat", "lng", "details", "reason", "driverId", "phone")) {
                assertFalse(message.has(forbidden), forbidden);
            }
        }
        assertNull(owner.next("orderId", orderId, 500));
    }

    @Test
    void rolledBackChangeIsNotPublished() throws Exception {
        String token = customerToken();
        String orderId = customerOrder(token, false);
        java.util.UUID id = orders.findByPublicId(orderId).orElseThrow().getId();
        Topic staff = subscribe(tokenFor(Role.DISPATCHER), "/topic/orders");
        TransactionTemplate tx = new TransactionTemplate(txManager);

        tx.executeWithoutResult(status -> {
            publisher.publishEvent(new OrderTracked(id, "rolled_back"));
            status.setRollbackOnly();
        });
        assertNull(staff.next("orderId", orderId, 1000));

        // controle: o mesmo evento num commit chega, então o silêncio acima é do rollback
        tx.executeWithoutResult(status -> publisher.publishEvent(new OrderTracked(id, "committed")));
        JsonNode event = staff.next("orderId", orderId, 5000);
        assertNotNull(event);
        assertEquals("committed", event.get("code").asString());
    }
}
