package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.security.StompAuthInterceptor;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSocketAuthTest extends IntegrationTest {

    static class MutableClock extends Clock {
        volatile Duration offset = Duration.ZERO;

        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        public Clock withZone(ZoneId zone) {
            return this;
        }

        public Instant instant() {
            return Instant.now().plus(offset);
        }
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock();
        }
    }

    @Autowired
    MutableClock clock;

    @LocalServerPort
    int port;

    @Autowired
    StompAuthInterceptor interceptor;

    @Value("${kjfleets.jwt-secret}")
    String secret;

    private final ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
    private final List<WebSocketStompClient> clients = new CopyOnWriteArrayList<>();

    // eventos que o servidor mandou: CONNECTED, ERROR:<msg>, CLOSED
    static class Probe extends StompSessionHandlerAdapter {
        final BlockingQueue<String> events = new LinkedBlockingQueue<>();
        volatile StompSession session;

        @Override
        public void afterConnected(StompSession session, StompHeaders headers) {
            this.session = session;
            events.add("CONNECTED");
        }

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return String.class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            events.add("ERROR:" + headers.getFirst("message"));
        }

        @Override
        public void handleTransportError(StompSession session, Throwable exception) {
            events.add("CLOSED");
        }

        String next(long ms) throws InterruptedException {
            return events.poll(ms, TimeUnit.MILLISECONDS);
        }
    }

    private Probe connect(String authorization) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setTaskScheduler(scheduler);
        client.setMessageConverter(new StringMessageConverter(StandardCharsets.UTF_8));
        clients.add(client);
        StompHeaders headers = new StompHeaders();
        if (authorization != null) {
            headers.add("Authorization", authorization);
        }
        Probe probe = new Probe();
        client.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), headers, probe);
        return probe;
    }

    private Probe connectOk(String token) throws Exception {
        Probe probe = connect("Bearer " + token);
        assertEquals("CONNECTED", probe.next(5000));
        return probe;
    }

    private void subscribe(Probe probe, String destination) {
        probe.session.subscribe(destination, new StompFrameHandler() {
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }

            public void handleFrame(StompHeaders headers, Object payload) {
            }
        });
    }

    private void assertRefused(Probe probe) throws Exception {
        String event = probe.next(5000);
        assertNotNull(event);
        assertTrue(event.startsWith("ERROR"), event);
    }

    private String customerToken() {
        String username = "cust-" + UUID.randomUUID().toString().substring(0, 8);
        authService.register(new RegisterRequest(username, "password-123", "Cliente", null, null));
        return jwtService.generate(userRepository.findByUsername(username).orElseThrow());
    }

    private String orderOf(String customerToken) throws Exception {
        return new OrderFixtures(mvc, json, this::bearer).createOrder("Bearer " + customerToken);
    }

    @BeforeEach
    void ensureStaff() {
        scheduler.initialize();
        tokenFor(Role.DISPATCHER);
    }

    @AfterEach
    void stop() {
        clients.forEach(WebSocketStompClient::stop);
        scheduler.shutdown();
        clock.offset = Duration.ZERO;
    }

    @Test
    void connectWithoutTokenRefused() throws Exception {
        assertRefused(connect(null));
        assertRefused(connect("Bearer lixo"));
    }

    @Test
    void driverTokenRefused() throws Exception {
        var driver = authService.newUser("drv-" + UUID.randomUUID().toString().substring(0, 8), "password-123",
                Role.DRIVER);
        assertRefused(connect("Bearer " + jwtService.generate(driver)));
    }

    @Test
    void staffSubscribesFleetAndOrders() throws Exception {
        Probe probe = connectOk(tokenFor(Role.DISPATCHER));
        subscribe(probe, "/topic/fleet/locations");
        subscribe(probe, "/topic/orders");
        assertNull(probe.next(1000));
    }

    @Test
    void customerOwnOrderOnly() throws Exception {
        String token = customerToken();
        String orderId = orderOf(token);
        Probe probe = connectOk(token);
        subscribe(probe, "/topic/orders/" + orderId);
        assertNull(probe.next(1000));
    }

    @Test
    void customerCannotSubscribeOthers() throws Exception {
        String other = orderOf(customerToken());
        String token = customerToken();
        for (String destination : List.of("/topic/orders/" + other, "/topic/fleet/locations", "/topic/orders")) {
            Probe probe = connectOk(token);
            subscribe(probe, destination);
            assertRefused(probe);
        }
    }

    @Test
    void unknownDestinationRefused() throws Exception {
        Probe probe = connectOk(tokenFor(Role.ADMIN));
        subscribe(probe, "/topic/anything");
        assertRefused(probe);
    }

    @Test
    void clientSendRefused() throws Exception {
        Probe probe = connectOk(tokenFor(Role.ADMIN));
        probe.session.send("/topic/orders", "oi");
        assertRefused(probe);
    }

    @Test
    void expiredSessionIsClosed() throws Exception {
        String username = "dispatcher-user";
        String token = Jwts.builder().subject(username).claim("role", "DISPATCHER")
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
        Probe probe = connectOk(token);
        clock.offset = Duration.ofSeconds(61);
        interceptor.closeExpired();
        String event = probe.next(5000);
        assertEquals("CLOSED", event);
    }

    // frames recebidos e "CLOSED" quando o servidor fecha a conexão
    private WebSocketSession openRaw(BlockingQueue<String> events) throws Exception {
        return new StandardWebSocketClient().execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                events.add(message.getPayload());
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                events.add("CLOSED");
            }
        }, "ws://localhost:" + port + "/ws").get(5, TimeUnit.SECONDS);
    }

    private String rawFrame(String frame) throws Exception {
        BlockingQueue<String> received = new LinkedBlockingQueue<>();
        var socket = openRaw(received);
        try {
            socket.sendMessage(new TextMessage(frame + "\0"));
            String reply = received.poll(5, TimeUnit.SECONDS);
            assertNotNull(reply);
            return reply;
        } finally {
            socket.close();
        }
    }

    @Test
    void inactiveUserRefusedAtConnect() throws Exception {
        String token = customerToken();
        var user = userRepository.findByUsername(jwtService.username(token).orElseThrow()).orElseThrow();
        user.setActive(false);
        userRepository.save(user);
        assertRefused(connect("Bearer " + token));
    }

    @Test
    void deactivatedAfterConnectRefusedAtSubscribe() throws Exception {
        String token = customerToken();
        String orderId = orderOf(token);
        Probe probe = connectOk(token);
        var user = userRepository.findByUsername(jwtService.username(token).orElseThrow()).orElseThrow();
        user.setActive(false);
        userRepository.save(user);
        subscribe(probe, "/topic/orders/" + orderId);
        assertRefused(probe);
    }

    @Test
    void subscribeBeforeConnectRefused() throws Exception {
        assertTrue(rawFrame("SUBSCRIBE\nid:1\ndestination:/topic/orders\n\n").startsWith("ERROR"));
    }

    @Test
    void stompFrameWithoutTokenRefused() throws Exception {
        assertTrue(rawFrame("STOMP\naccept-version:1.2\nhost:x\n\n").startsWith("ERROR"));
    }

    @Test
    void unauthenticatedSocketClosedAfterTenSeconds() throws Exception {
        BlockingQueue<String> events = new LinkedBlockingQueue<>();
        openRaw(events);
        // o handshake do cliente volta antes do servidor registrar o socket; sem isso o openedAt pegaria o offset
        Thread.sleep(500);
        clock.offset = Duration.ofSeconds(5);
        interceptor.closeExpired();
        assertNull(events.poll(1, TimeUnit.SECONDS));
        clock.offset = Duration.ofSeconds(11);
        interceptor.closeExpired();
        assertEquals("CLOSED", events.poll(5, TimeUnit.SECONDS));
    }

    @Test
    void secondConnectRefused() throws Exception {
        BlockingQueue<String> events = new LinkedBlockingQueue<>();
        var socket = openRaw(events);
        try {
            String connect = "CONNECT\naccept-version:1.2\nhost:x\nAuthorization:Bearer " + tokenFor(Role.DISPATCHER)
                    + "\n\n\0";
            socket.sendMessage(new TextMessage(connect));
            assertTrue(events.poll(5, TimeUnit.SECONDS).startsWith("CONNECTED"));
            socket.sendMessage(new TextMessage(connect));
            String reply = events.poll(5, TimeUnit.SECONDS);
            assertNotNull(reply);
            assertTrue(reply.startsWith("ERROR"), reply);
        } finally {
            socket.close();
        }
    }

    @Test
    void malformedOrderTopicsRefused() throws Exception {
        String token = customerToken();
        String orderId = orderOf(token);
        for (String destination : List.of("/topic/orders/x/../fleet", "/topic/orders/", "/topic/orders/*",
                "/topic/orders/a/b", "/topic/orders/" + orderId + "/x")) {
            Probe probe = connectOk(token);
            subscribe(probe, destination);
            assertRefused(probe);
        }
    }
}
