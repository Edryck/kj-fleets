package br.com.kjfleets.security;

import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.AppUserRepository;
import br.com.kjfleets.repository.OrderRepository;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class StompAuthInterceptor implements ChannelInterceptor {

    private static final Set<Role> STAFF = Set.of(Role.ADMIN, Role.DISPATCHER, Role.FLEET_MANAGER);
    private static final String ORDER_TOPIC = "/topic/orders/";

    private final JwtService jwt;
    private final AppUserRepository users;
    private final OrderRepository orders;
    private final Clock clock;

    private record Socket(WebSocketSession session, Instant openedAt) {
    }

    // o id da sessão STOMP é o mesmo id do WebSocketSession
    private final Map<String, Socket> sockets = new ConcurrentHashMap<>();
    private final Map<String, Instant> expiries = new ConcurrentHashMap<>();

    public StompAuthInterceptor(JwtService jwt, AppUserRepository users, OrderRepository orders, Clock clock) {
        this.jwt = jwt;
        this.users = users;
        this.orders = orders;
        this.clock = clock;
    }

    // guarda o socket cru pra poder fechar a conexão na expiração; limpa quando ela cai
    public WebSocketHandler trackSockets(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sockets.put(session.getId(), new Socket(session, clock.instant()));
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                sockets.remove(session.getId());
                expiries.remove(session.getId());
                super.afterConnectionClosed(session, status);
            }
        };
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        StompCommand command = accessor == null ? null : accessor.getCommand();
        if (command == null) {
            return message;
        }
        switch (command) {
            case CONNECT, STOMP -> connect(accessor);
            case SUBSCRIBE -> subscribe(accessor);
            case UNSUBSCRIBE, DISCONNECT -> { }
            default -> throw new MessagingException("Operação não permitida");
        }
        return message;
    }

    private void connect(StompHeaderAccessor accessor) {
        if (accessor.getUser() != null) {
            throw new MessagingException("Sessão já autenticada");
        }
        String header = accessor.getFirstNativeHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            throw new MessagingException("Não autenticado");
        }
        String token = header.substring(7);
        AppUser user = jwt.username(token).flatMap(users::findByUsername).filter(AppUser::isActive)
                .filter(u -> u.getRole() != Role.DRIVER)
                .orElseThrow(() -> new MessagingException("Não autenticado"));
        accessor.setUser(UsernamePasswordAuthenticationToken.authenticated(user.getUsername(), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))));
        expiries.put(accessor.getSessionId(), jwt.expiresAt(token));
    }

    private void subscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (accessor.getUser() == null || destination == null) {
            throw new MessagingException("Não autenticado");
        }
        // consulta o banco a cada SUBSCRIBE pra desativação valer na hora
        AppUser user = users.findByUsername(accessor.getUser().getName()).filter(AppUser::isActive)
                .orElseThrow(() -> new MessagingException("Não autenticado"));
        boolean staff = STAFF.contains(user.getRole());
        boolean allowed;
        if (destination.equals("/topic/fleet/locations") || destination.equals("/topic/orders")) {
            allowed = staff;
        } else if (destination.startsWith(ORDER_TOPIC) && destination.indexOf('/', ORDER_TOPIC.length()) < 0
                && destination.length() > ORDER_TOPIC.length()) {
            allowed = staff || user.getRole() == Role.CUSTOMER && orders.existsByPublicIdAndCustomerUserUsername(
                    destination.substring(ORDER_TOPIC.length()), user.getUsername());
        } else {
            allowed = false;
        }
        if (!allowed) {
            throw new MessagingException("Sem permissão para " + destination);
        }
    }

    // sem entrada em expiries = nunca autenticou; dá 10 s pro CONNECT chegar
    @Scheduled(fixedDelay = 30000)
    public void closeExpired() {
        Instant now = clock.instant();
        sockets.forEach((sessionId, socket) -> {
            Instant exp = expiries.get(sessionId);
            boolean stale = exp == null ? !socket.openedAt().plusSeconds(10).isAfter(now) : !exp.isAfter(now);
            if (!stale) {
                return;
            }
            try {
                socket.session().close(CloseStatus.POLICY_VIOLATION.withReason("Sessão expirada"));
            } catch (Exception e) {
                // a próxima varredura tenta de novo; o afterConnectionClosed limpa os mapas
            }
        });
    }
}
