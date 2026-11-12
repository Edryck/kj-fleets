package br.com.kjfleets.service;

import br.com.kjfleets.config.WebSocketProperties;
import br.com.kjfleets.dto.RealtimeDtos.DriverMoved;
import br.com.kjfleets.dto.RealtimeDtos.DriverRemoved;
import br.com.kjfleets.dto.RealtimeDtos.DriverStatusChanged;
import br.com.kjfleets.dto.RealtimeDtos.LocationEvent;
import br.com.kjfleets.dto.RealtimeDtos.OrderDetailEvent;
import br.com.kjfleets.dto.RealtimeDtos.OrderEvent;
import br.com.kjfleets.dto.RealtimeDtos.OrderTracked;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.Route;
import br.com.kjfleets.entity.RouteStop;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.RouteRepository;
import br.com.kjfleets.routing.Haversine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RealtimePublisher {

    private static final Logger log = LoggerFactory.getLogger(RealtimePublisher.class);
    // mesmos códigos que o GET /track esconde; stop_completed fica de fora da lista de propósito (vai pro cliente)
    private static final List<String> HIDDEN_FROM_CUSTOMER = List.of("assigned", "unassigned", "route_failed");

    private record Sent(double lat, double lng, Instant at) {
    }

    private final SimpMessagingTemplate template;
    private final OrderRepository orders;
    private final DriverRepository drivers;
    private final RouteRepository routes;
    private final RouteService routeService;
    private final WebSocketProperties props;
    private final Clock clock;
    private final Map<String, Sent> lastSent = new ConcurrentHashMap<>();

    public RealtimePublisher(SimpMessagingTemplate template, OrderRepository orders, DriverRepository drivers,
                             RouteRepository routes, RouteService routeService, WebSocketProperties props,
                             Clock clock) {
        this.template = template;
        this.orders = orders;
        this.drivers = drivers;
        this.routes = routes;
        this.routeService = routeService;
        this.props = props;
        this.clock = clock;
    }

    // exceção em listener AFTER_COMMIT voltaria pro chamador e viraria 500 num commit que já deu certo
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public void onOrderTracked(OrderTracked event) {
        try {
            Order order = orders.findById(event.orderId()).orElse(null);
            if (order == null) {
                return;
            }
            Instant now = clock.instant();
            Driver driver = order.getDriver();
            template.convertAndSend("/topic/orders", new OrderEvent(order.getPublicId(), event.code(),
                    order.getStatus().name(), driver == null ? null : driver.getPublicId(), now));
            if (HIDDEN_FROM_CUSTOMER.contains(event.code())) {
                return;
            }
            Route route = routes.findByOrder(order).orElse(null);
            List<RouteStop> stops = route == null ? List.of()
                    : route.getStops().stream().filter(s -> s.getType() != StopType.START).toList();
            template.convertAndSend("/topic/orders/" + order.getPublicId(), new OrderDetailEvent(
                    order.getPublicId(), event.code(), order.getStatus().name(),
                    routeService.liveEta(order, route),
                    (int) stops.stream().filter(s -> s.getVisitedAt() != null).count(), stops.size(), now));
        } catch (RuntimeException e) {
            log.warn("Falha ao publicar evento do pedido {}", event.orderId(), e);
        }
    }

    // sem transação nem consulta: o evento já traz tudo, ping é o caminho mais quente
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDriverMoved(DriverMoved event) {
        try {
            Instant now = clock.instant();
            if (shouldBroadcast(event.driverId(), event.lat(), event.lng(), now)) {
                template.convertAndSend("/topic/fleet/locations", new LocationEvent(event.driverId(),
                        event.name(), event.status(), event.lat(), event.lng(), now));
            }
        } catch (RuntimeException e) {
            log.warn("Falha ao publicar posição do motorista {}", event.driverId(), e);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDriverRemoved(DriverRemoved event) {
        lastSent.remove(event.driverId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public void onDriverStatusChanged(DriverStatusChanged event) {
        try {
            Driver driver = drivers.findById(event.driverId()).orElse(null);
            if (driver == null || !driver.isActive()) {
                return;
            }
            Instant now = clock.instant();
            if (driver.getLat() == null || driver.getLng() == null) {
                lastSent.remove(driver.getPublicId());
            } else {
                lastSent.put(driver.getPublicId(), new Sent(driver.getLat(), driver.getLng(), now));
            }
            template.convertAndSend("/topic/fleet/locations", locationOf(driver, now));
        } catch (RuntimeException e) {
            log.warn("Falha ao publicar status do motorista {}", event.driverId(), e);
        }
    }

    // compute pra decisão e gravação serem atômicas: dois pings simultâneos não passam juntos
    boolean shouldBroadcast(String driverId, double lat, double lng, Instant now) {
        boolean[] send = {false};
        lastSent.compute(driverId, (id, last) -> {
            boolean due = last == null
                    || !now.isBefore(last.at().plusSeconds(props.locationMinIntervalS()))
                    && Haversine.km(last.lat(), last.lng(), lat, lng) * 1000 > props.locationMinDistanceM();
            send[0] = due;
            return due ? new Sent(lat, lng, now) : last;
        });
        return send[0];
    }

    private LocationEvent locationOf(Driver driver, Instant at) {
        return new LocationEvent(driver.getPublicId(), driver.getName(), driver.getStatus().name(), driver.getLat(),
                driver.getLng(), at);
    }
}
