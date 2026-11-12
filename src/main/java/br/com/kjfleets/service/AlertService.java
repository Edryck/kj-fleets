package br.com.kjfleets.service;

import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.dto.DashboardDtos.Alert;
import br.com.kjfleets.dto.DashboardDtos.AlertType;
import br.com.kjfleets.dto.DashboardDtos.Alerts;
import br.com.kjfleets.dto.DashboardDtos.Meta;
import br.com.kjfleets.dto.DashboardDtos.Severity;
import br.com.kjfleets.repository.DashboardQueries;
import br.com.kjfleets.repository.DashboardQueries.AlertRow;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.kjfleets.dto.DashboardDtos.AlertType.*;

@Service
public class AlertService {

    private static final int LIMIT = 100;
    // parada "suspeita" = chegou acima de 80% do raio de chegada
    private static final double SUSPICIOUS_RATIO = 0.8;

    private static final Map<String, Set<AlertType>> VISIBLE = Map.of(
            "ADMIN", EnumSet.allOf(AlertType.class),
            "DISPATCHER", EnumSet.of(STALE_ORDER, DRIVER_NO_SIGNAL, VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER,
                    DEMAND_OVER_CAPACITY, ROUTE_MISSING),
            "FLEET_MANAGER", EnumSet.of(DRIVER_NO_SIGNAL, STATUS_INCONSISTENT,
                    VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER, SUSPICIOUS_STOP, LONG_MAINTENANCE));

    private final DashboardQueries queries;
    private final DashboardProperties props;
    private final RoutingProperties routing;
    private final Clock clock;

    public AlertService(DashboardQueries queries, DashboardProperties props, RoutingProperties routing, Clock clock) {
        this.queries = queries;
        this.props = props;
        this.routing = routing;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Alerts alerts(Authentication auth) {
        return alertsFor(VISIBLE.keySet().stream()
                .filter(role -> auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role)))
                .toList());
    }

    // os painéis pedem o recorte de um papel específico, mesmo quando quem chama é ADMIN
    @Transactional(readOnly = true)
    public Alerts alertsFor(String role) {
        return alertsFor(List.of(role));
    }

    private Alerts alertsFor(List<String> roles) {
        Instant now = clock.instant();
        Set<AlertType> types = EnumSet.noneOf(AlertType.class);
        boolean admin = false;
        for (var entry : VISIBLE.entrySet()) {
            if (roles.contains(entry.getKey())) {
                types.addAll(entry.getValue());
                admin |= entry.getKey().equals("ADMIN");
            }
        }
        // ADMIN conta tudo (inclusive pedidos parados) mas só lista o que é dele; os demais só contam o que veem
        Map<AlertType, Long> all = queries.alertCounts(props, routing, now, SUSPICIOUS_RATIO);
        Map<AlertType, Long> counts = new EnumMap<>(AlertType.class);
        for (AlertType type : AlertType.values()) {
            if (admin || types.contains(type)) {
                counts.put(type, all.get(type));
            }
        }
        List<Alert> items = queries.alertRows(props, routing, now, SUSPICIOUS_RATIO, types, LIMIT).stream()
                .map(row -> toAlert(row, now)).toList();
        return new Alerts(Meta.now(now, props.timezone()), items, counts);
    }

    private Alert toAlert(AlertRow r, Instant now) {
        long minutes = Duration.between(r.since(), now).toMinutes();
        String message;
        String action;
        switch (r.type()) {
            case STALE_ORDER -> {
                message = "Pedido há %d min em %s (limite %d)".formatted(r.n1().longValue(), r.s1(), r.n2().longValue());
                action = "Ligar para o motorista ou reatribuir";
            }
            case DRIVER_NO_SIGNAL -> {
                message = "Motorista sem sinal há %d min".formatted(minutes);
                action = r.severity() == 3 ? "Ligar para o motorista: há pedido em andamento"
                        : "Confirmar se o motorista segue em operação";
            }
            case STATUS_INCONSISTENT -> {
                message = "Motorista %s e %s pedido ativo".formatted(r.s1(),
                        r.s1().equals("BUSY") ? "sem" : "com");
                action = "Corrigir o status do motorista";
            }
            case VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER -> {
                message = "Motorista disponível com veículo %s em manutenção".formatted(r.s1());
                action = "Trocar o veículo ou tirar o motorista da escala";
            }
            case DEMAND_OVER_CAPACITY -> {
                message = "%d pedidos sem motorista para %d motoristas livres".formatted(r.n1().longValue(),
                        r.n2().longValue());
                action = "Chamar mais motoristas ou liberar veículos";
            }
            case SUSPICIOUS_STOP -> {
                message = r.n2() == null
                        ? "Parada %d (%s) concluída pela equipe sem distância registrada".formatted(
                                r.n1().intValue(), r.s1())
                        : "Parada %d (%s) concluída a %d m do ponto".formatted(r.n1().intValue(), r.s1(),
                                Math.round(r.n2()));
                action = "Conferir a entrega com o motorista";
            }
            case ROUTE_MISSING -> {
                message = "Pedido ativo sem rota calculada (%s)".formatted(r.s1());
                action = "Reatribuir o pedido para recalcular a rota";
            }
            default -> {
                message = "Veículo %s em manutenção há %d dias".formatted(r.s1(), minutes / (60 * 24));
                action = "Verificar a previsão de retorno do veículo";
            }
        }
        return new Alert(r.type(), Severity.values()[r.severity() - 1], r.subjectType(), r.subjectId(), message,
                action, r.since());
    }
}
