package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DashboardDtos.AdminPanel;
import br.com.kjfleets.dto.DashboardDtos.Alerts;
import br.com.kjfleets.dto.DashboardDtos.DispatchPanel;
import br.com.kjfleets.dto.DashboardDtos.FleetPanel;
import br.com.kjfleets.dto.DashboardDtos.DispatchQueue;
import br.com.kjfleets.dto.DashboardDtos.DriversPerformance;
import br.com.kjfleets.dto.DashboardDtos.FleetStatus;
import br.com.kjfleets.dto.DashboardDtos.Funnel;
import br.com.kjfleets.dto.DashboardDtos.OrdersSummary;
import br.com.kjfleets.dto.DashboardDtos.RoutingSavings;
import br.com.kjfleets.dto.DashboardDtos.YearlyTrends;
import br.com.kjfleets.service.AlertService;
import br.com.kjfleets.service.DashboardService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;


@RestController
public class DashboardController {

    private final DashboardService service;
    private final AlertService alerts;
    private final Duration ttl;
    private final Clock clock;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    private record Cached(Object value, Instant until) {
    }

    public DashboardController(DashboardService service, AlertService alerts,
                               @Value("${kjfleets.dashboard.cache-s:10}") long cacheSeconds, Clock clock) {
        this.service = service;
        this.alerts = alerts;
        this.ttl = Duration.ofSeconds(cacheSeconds);
        this.clock = clock;
    }

    // painéis viram consultas pesadas com muitos pedidos e a tela repete o poll; segura o resultado por
    // usuário e parâmetros. Chave por usuário porque cliente e equipe veem recortes diferentes
    @SuppressWarnings("unchecked")
    private <T> T cached(Authentication auth, String key, Supplier<T> load) {
        if (ttl.isZero()) {
            return load.get();
        }
        String fullKey = auth.getName() + "|" + key;
        Instant now = clock.instant();
        Cached hit = cache.get(fullKey);
        if (hit != null && now.isBefore(hit.until())) {
            return (T) hit.value();
        }
        if (cache.size() > 5_000) {
            cache.clear();
        }
        T value = load.get();
        cache.put(fullKey, new Cached(value, now.plus(ttl)));
        return value;
    }

    @GetMapping("/dashboard/orders/summary")
    OrdersSummary ordersSummary(@RequestParam(required = false) String period,
                                @RequestParam(defaultValue = "false") boolean compare, Authentication auth) {
        return cached(auth, "summary|" + period + "|" + compare, () -> service.ordersSummary(period, compare, auth));
    }

    @GetMapping("/dashboard/orders/funnel")
    Funnel funnel(Authentication auth) {
        return cached(auth, "funnel", service::funnel);
    }

    @GetMapping("/dashboard/dispatch/queue")
    DispatchQueue dispatchQueue(Authentication auth) {
        return cached(auth, "queue", service::dispatchQueue);
    }

    @GetMapping("/dashboard/fleet/status")
    FleetStatus fleetStatus(@RequestParam(required = false) String fleetId, Authentication auth) {
        return cached(auth, "fleet|" + fleetId, () -> service.fleetStatus(fleetId, auth));
    }

    @GetMapping("/dashboard/drivers/performance")
    DriversPerformance driversPerformance(@RequestParam(required = false) String period,
                                          @RequestParam(required = false) String fleetId, Authentication auth) {
        return cached(auth, "drivers|" + period + "|" + fleetId, () -> service.driversPerformance(period, fleetId));
    }

    @GetMapping("/dashboard/routing/savings")
    RoutingSavings routingSavings(@RequestParam(required = false) String period, Authentication auth) {
        return cached(auth, "savings|" + period, () -> service.routingSavings(period));
    }

    @GetMapping("/dashboard/trends/yearly")
    YearlyTrends yearlyTrends(Authentication auth) {
        return cached(auth, "trends", () -> service.yearlyTrends(auth));
    }

    @GetMapping("/dashboard/alerts")
    Alerts alerts(Authentication auth) {
        return cached(auth, "alerts", () -> alerts.alerts(auth));
    }

    @GetMapping("/dashboard/admin")
    AdminPanel adminPanel(@RequestParam(required = false) String period, Authentication auth) {
        return cached(auth, "admin|" + period, () -> service.adminPanel(period, auth));
    }

    @GetMapping("/dashboard/dispatch")
    DispatchPanel dispatchPanel(@RequestParam(required = false) String period, Authentication auth) {
        return cached(auth, "dispatch|" + period, () -> service.dispatchPanel(period, auth));
    }

    @GetMapping("/dashboard/fleet")
    FleetPanel fleetPanel(@RequestParam(required = false) String period, Authentication auth) {
        return cached(auth, "fleetPanel|" + period, () -> service.fleetPanel(period, auth));
    }
}
