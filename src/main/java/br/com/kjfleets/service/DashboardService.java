package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.dto.DashboardDtos.DispatchQueue;
import br.com.kjfleets.dto.DashboardDtos.DriverRow;
import br.com.kjfleets.dto.DashboardDtos.FleetStatus;
import br.com.kjfleets.dto.DashboardDtos.Funnel;
import br.com.kjfleets.dto.DashboardDtos.InProgressItem;
import br.com.kjfleets.dto.DashboardDtos.Meta;
import br.com.kjfleets.dto.DashboardDtos.OrdersSummary;
import br.com.kjfleets.dto.DashboardDtos.Paged;
import br.com.kjfleets.dto.DashboardDtos.QueueItem;
import br.com.kjfleets.dto.DashboardDtos.Rate;
import br.com.kjfleets.dto.DashboardDtos.StaleOrder;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.entity.Fleet;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Route;
import br.com.kjfleets.entity.RouteStop;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.DashboardQueries;
import br.com.kjfleets.repository.DashboardQueries.Counts;
import br.com.kjfleets.repository.FleetRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.RouteRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private static final int LIST_LIMIT = 50;
    private static final Pattern FLEET_ID = Pattern.compile("fleet_[a-z0-9]{6}");
    private static final List<OrderStatus> IN_PROGRESS = Arrays.stream(OrderStatus.values())
            .filter(OrderStatus::isActive).toList();

    private final DashboardQueries queries;
    private final DashboardProperties props;
    private final RoutingProperties routing;
    private final CustomerRepository customers;
    private final FleetRepository fleets;
    private final OrderRepository orders;
    private final RouteRepository routes;
    private final RouteService routeService;
    private final Clock clock = Clock.systemUTC();

    public DashboardService(DashboardQueries queries, DashboardProperties props, RoutingProperties routing,
                            CustomerRepository customers, FleetRepository fleets, OrderRepository orders,
                            RouteRepository routes, RouteService routeService) {
        this.queries = queries;
        this.props = props;
        this.routing = routing;
        this.customers = customers;
        this.fleets = fleets;
        this.orders = orders;
        this.routes = routes;
        this.routeService = routeService;
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

    @Transactional(readOnly = true)
    public DispatchQueue dispatchQueue() {
        Instant now = clock.instant();
        Map<String, Long> byStage = queries.countByStage();

        List<Order> active = orders.findTop50ByStatusInOrderByCreatedAtAsc(IN_PROGRESS);
        Map<UUID, Route> routeByOrder = routes.findByOrderIn(active).stream()
                .collect(Collectors.toMap(route -> route.getOrder().getId(), route -> route));
        List<InProgressItem> inProgress = active.stream().map(order -> {
            Route route = routeByOrder.get(order.getId());
            List<RouteStop> stops = route == null ? List.of() : route.getStops().stream()
                    .filter(stop -> stop.getType() != StopType.START).toList();
            int done = (int) stops.stream().filter(stop -> stop.getVisitedAt() != null).count();
            return new InProgressItem(order.getPublicId(), order.getStatus().name(), order.getDriver().getPublicId(),
                    order.getDriver().getName(), routeService.liveEta(order, route), done, stops.size());
        }).toList();
        long inProgressTotal = IN_PROGRESS.stream().mapToLong(s -> byStage.get(s.name())).sum();

        return new DispatchQueue(Meta.now(now, props.timezone()),
                new Paged<>(queries.queueItems("UNASSIGNED", now, LIST_LIMIT), byStage.get("UNASSIGNED")),
                new Paged<>(queries.queueItems("ASSIGNED", now, LIST_LIMIT), byStage.get("ASSIGNED")),
                new Paged<>(inProgress, inProgressTotal),
                new Paged<>(queries.staleTop(props, now, LIST_LIMIT), queries.staleCount(props, now)));
    }

    @Transactional(readOnly = true)
    public FleetStatus fleetStatus(String fleetId, Authentication auth) {
        if (fleetId != null && !FLEET_ID.matcher(fleetId).matches()) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "fleetId inválido");
        }
        Instant now = clock.instant();
        UUID fleet = fleetId == null ? null : fleets.findByPublicIdAndActiveTrue(fleetId).map(Fleet::getId)
                .orElseThrow(() -> BusinessException.notFound("Frota"));
        Instant freshSince = now.minusSeconds(routing.positionMaxAgeS());

        List<DriverRow> available = queries.driverRows(fleet, freshSince, true);
        // DISPATCHER só enxerga os disponíveis; a lista completa fica para quem gerencia a frota
        List<DriverRow> drivers = hasRole(auth, "DISPATCHER") ? null : queries.driverRows(fleet, freshSince, false);
        return new FleetStatus(Meta.now(now, props.timezone()), queries.driversByStatus(fleet),
                queries.vehiclesByStatus(fleet), queries.countByStage().get("UNASSIGNED"), available.size(),
                drivers, available);
    }
}
