package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.dto.DashboardDtos.Funnel;
import br.com.kjfleets.dto.DashboardDtos.Meta;
import br.com.kjfleets.dto.DashboardDtos.OrdersSummary;
import br.com.kjfleets.dto.DashboardDtos.Rate;
import br.com.kjfleets.dto.DashboardDtos.StaleOrder;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.DashboardQueries;
import br.com.kjfleets.repository.DashboardQueries.Counts;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class DashboardService {

    private final DashboardQueries queries;
    private final DashboardProperties props;
    private final CustomerRepository customers;
    private final Clock clock = Clock.systemUTC();

    public DashboardService(DashboardQueries queries, DashboardProperties props, CustomerRepository customers) {
        this.queries = queries;
        this.props = props;
        this.customers = customers;
    }

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
    }

    @Transactional(readOnly = true)
    public OrdersSummary ordersSummary(String periodName, boolean compare, Authentication auth) {
        DashboardPeriod period = DashboardPeriod.resolve(periodName, props.timezone(), clock);
        boolean admin = hasRole(auth, "ADMIN");
        UUID customerId = null;
        if (hasRole(auth, "CUSTOMER")) {
            customerId = customers.findByUserUsername(auth.getName()).map(Customer::getId)
                    .orElseThrow(() -> BusinessException.notFound("Cliente"));
        }
        OrdersSummary previous = compare && admin
                ? summarize(period.previous(), customerId, true, null) : null;
        return summarize(period, customerId, admin, previous);
    }

    private OrdersSummary summarize(DashboardPeriod period, UUID customerId, boolean withPod, OrdersSummary previous) {
        Counts c = queries.ordersCounts(period, customerId);
        long finished = c.completed() + c.failed() + c.cancelled();
        return new OrdersSummary(period.meta(clock.instant()), c.created(), c.completed(), c.failed(), c.cancelled(),
                c.cancelledByCustomer(), c.cancelledByStaff(),
                c.cancelled() - c.cancelledByCustomer() - c.cancelledByStaff(),
                Rate.of(c.completed(), finished), Rate.of(c.failed(), finished), Rate.of(c.cancelled(), finished),
                queries.topFailureReasons(period, customerId), c.avgWaitMinutes(), c.avgCycleMinutes(),
                withPod ? Rate.of(c.podHits(), c.podN()) : null, previous);
    }

    @Transactional(readOnly = true)
    public Funnel funnel() {
        Instant now = clock.instant();
        Map<String, Long> stale = new LinkedHashMap<>();
        DashboardQueries.STAGES.forEach(stage -> stale.put(stage, 0L));
        for (StaleOrder order : queries.staleOrders(props, now, null)) {
            stale.merge(order.stage(), 1L, Long::sum);
        }
        return new Funnel(Meta.now(now, props.timezone()),
                queries.countByStage(), stale);
    }
}
