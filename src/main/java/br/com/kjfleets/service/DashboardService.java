package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.config.DashboardProperties;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.dto.DashboardDtos.AdminPanel;
import br.com.kjfleets.dto.DashboardDtos.CustomerActive;
import br.com.kjfleets.dto.DashboardDtos.CustomerAttention;
import br.com.kjfleets.dto.DashboardDtos.CustomerDelivered;
import br.com.kjfleets.dto.DashboardDtos.CustomerPanel;
import br.com.kjfleets.dto.DashboardDtos.DispatchPanel;
import br.com.kjfleets.dto.DashboardDtos.DispatchQueue;
import br.com.kjfleets.dto.DashboardDtos.DriverActive;
import br.com.kjfleets.dto.DashboardDtos.DriverPanel;
import br.com.kjfleets.dto.DashboardDtos.FleetCounts;
import br.com.kjfleets.dto.DashboardDtos.FleetPanel;
import br.com.kjfleets.dto.DashboardDtos.Gps;
import br.com.kjfleets.dto.DashboardDtos.Sizing;
import br.com.kjfleets.dto.DashboardDtos.DriversPerformance;
import br.com.kjfleets.dto.DashboardDtos.MonthPoint;
import br.com.kjfleets.dto.DashboardDtos.RoutingSavings;
import br.com.kjfleets.dto.DashboardDtos.YearlyTrends;
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
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Fleet;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Route;
import br.com.kjfleets.entity.RouteStop;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.DriverRepository;
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
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.ArrayList;
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

    private static final List<OrderStatus> CUSTOMER_ACTIVE = Arrays.stream(OrderStatus.values())
            .filter(status -> status == OrderStatus.CREATED || status.isActive()).toList();

    private final DashboardQueries queries;
    private final DashboardProperties props;
    private final RoutingProperties routing;
    private final CustomerRepository customers;
    private final FleetRepository fleets;
    private final OrderRepository orders;
    private final RouteRepository routes;
    private final RouteService routeService;
    private final AlertService alertService;
    private final DriverRepository drivers;
    private final Clock clock = Clock.systemUTC();

    public DashboardService(DashboardQueries queries, DashboardProperties props, RoutingProperties routing,
                            CustomerRepository customers, FleetRepository fleets, OrderRepository orders,
                            RouteRepository routes, RouteService routeService, AlertService alertService,
                            DriverRepository drivers) {
        this.queries = queries;
        this.props = props;
        this.routing = routing;
        this.customers = customers;
        this.fleets = fleets;
        this.orders = orders;
        this.routes = routes;
        this.routeService = routeService;
        this.alertService = alertService;
        this.drivers = drivers;
    }

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
    }

    private UUID customerId(Authentication auth) {
        if (!hasRole(auth, "CUSTOMER")) {
            return null;
        }
        return customers.findByUserUsername(auth.getName()).map(Customer::getId)
                .orElseThrow(() -> BusinessException.notFound("Cliente"));
    }

    @Transactional(readOnly = true)
    public OrdersSummary ordersSummary(String periodName, boolean compare, Authentication auth) {
        DashboardPeriod period = DashboardPeriod.resolve(periodName, props.timezone(), clock);
        boolean admin = hasRole(auth, "ADMIN");
        UUID customerId = customerId(auth);
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
            int[] stops = stopCounts(route);
            // status ativo sem motorista é dado inconsistente (o alerta já cobre); o painel não pode cair por isso
            Driver driver = order.getDriver();
            return new InProgressItem(order.getPublicId(), order.getStatus().name(),
                    driver == null ? null : driver.getPublicId(), driver == null ? null : driver.getName(), routeService.liveEta(order, route), stops[0], stops[1]);
        }).toList();
        long inProgressTotal = IN_PROGRESS.stream().mapToLong(s -> byStage.get(s.name())).sum();

        return new DispatchQueue(Meta.now(now, props.timezone()),
                new Paged<>(queries.queueItems("UNASSIGNED", now, LIST_LIMIT), byStage.get("UNASSIGNED")),
                new Paged<>(queries.queueItems("ASSIGNED", now, LIST_LIMIT), byStage.get("ASSIGNED")),
                new Paged<>(inProgress, inProgressTotal),
                new Paged<>(queries.staleTop(props, now, LIST_LIMIT), queries.staleCount(props, now)));
    }

    // {concluídas, total}, sem a parada START
    private static int[] stopCounts(Route route) {
        List<RouteStop> stops = route == null ? List.of() : route.getStops().stream()
                .filter(stop -> stop.getType() != StopType.START).toList();
        return new int[]{(int) stops.stream().filter(stop -> stop.getVisitedAt() != null).count(), stops.size()};
    }

    private UUID fleetUuid(String fleetId) {
        if (fleetId == null) {
            return null;
        }
        if (!FLEET_ID.matcher(fleetId).matches()) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "fleetId inválido");
        }
        return fleets.findByPublicIdAndActiveTrue(fleetId).map(Fleet::getId)
                .orElseThrow(() -> BusinessException.notFound("Frota"));
    }

    @Transactional(readOnly = true)
    public FleetStatus fleetStatus(String fleetId, Authentication auth) {
        Instant now = clock.instant();
        UUID fleet = fleetUuid(fleetId);
        Instant freshSince = now.minusSeconds(routing.positionMaxAgeS());

        List<DriverRow> available = queries.driverRows(fleet, freshSince, true);
        // DISPATCHER só enxerga os disponíveis; a lista completa fica para quem gerencia a frota
        List<DriverRow> drivers = hasRole(auth, "DISPATCHER") ? null : queries.driverRows(fleet, freshSince, false);
        return new FleetStatus(Meta.now(now, props.timezone()), queries.driversByStatus(fleet),
                queries.vehiclesByStatus(fleet), queries.countByStage().get("UNASSIGNED"), available.size(),
                drivers, available);
    }

    @Transactional(readOnly = true)
    public DriversPerformance driversPerformance(String periodName, String fleetId) {
        DashboardPeriod period = DashboardPeriod.resolve(periodName, props.timezone(), clock);
        return queries.driversPerformance(period, fleetUuid(fleetId));
    }

    @Transactional(readOnly = true)
    public RoutingSavings routingSavings(String periodName) {
        return queries.routingSavings(DashboardPeriod.resolve(periodName, props.timezone(), clock));
    }

    @Transactional(readOnly = true)
    public YearlyTrends yearlyTrends(Authentication auth) {
        Instant now = clock.instant();
        UUID customerId = customerId(auth);
        List<MonthPoint> months = queries.yearly(now, props.timezone(), customerId);
        if (customerId != null) {
            // cliente não vê km, economia nem ciclo, e nunca dados de motorista
            months = months.stream().map(m -> new MonthPoint(m.month(), m.created(), m.completed(), m.failed(),
                    m.cancelled(), m.successRate(), null, null, null)).toList();
        }
        return new YearlyTrends(Meta.now(now, props.timezone()), months,
                customerId != null ? null : queries.completedByDriverMonth(now, props.timezone()));
    }

    private FleetCounts fleetCounts(List<DriverRow> available) {
        return new FleetCounts(queries.driversByStatus(null), queries.vehiclesByStatus(null),
                queries.countByStage().get("UNASSIGNED"), available.size());
    }

    private List<DriverRow> availableRows() {
        return queries.driverRows(null, clock.instant().minusSeconds(routing.positionMaxAgeS()), true);
    }

    private Meta panelMeta(String periodName) {
        return DashboardPeriod.resolve(periodName, props.timezone(), clock).meta(clock.instant());
    }

    @Transactional(readOnly = true)
    public AdminPanel adminPanel(String period, Authentication auth) {
        return new AdminPanel(panelMeta(period), ordersSummary(period, true, auth), funnel(),
                fleetCounts(availableRows()), routingSavings(period), alertService.alerts(auth).counts());
    }

    @Transactional(readOnly = true)
    public DispatchPanel dispatchPanel(String period, Authentication auth) {
        List<DriverRow> available = availableRows();
        return new DispatchPanel(panelMeta(period), dispatchQueue(), available, fleetCounts(available),
                ordersSummary(period, false, auth), alertService.alertsFor("DISPATCHER").items());
    }

    @Transactional(readOnly = true)
    public FleetPanel fleetPanel(String period, Authentication auth) {
        DashboardPeriod resolved = DashboardPeriod.resolve(period, props.timezone(), clock);
        FleetStatus fleet = fleetStatus(null, auth);
        return new FleetPanel(resolved.meta(clock.instant()), fleet, alertService.alertsFor("FLEET_MANAGER").items(),
                driversPerformance(period, null),
                new Sizing(fleet.waitingOrders(), fleet.availableDrivers(), queries.perDay(resolved)));
    }

    @Transactional(readOnly = true)
    public CustomerPanel customerPanel(String periodName, Authentication auth) {
        Instant now = clock.instant();
        DashboardPeriod period = DashboardPeriod.resolve(periodName, props.timezone(), clock);
        UUID customerId = customerId(auth);

        List<Order> active = orders.findByCustomerIdAndStatusInOrderByCreatedAtAsc(customerId, CUSTOMER_ACTIVE);
        Map<UUID, Route> routeByOrder = routes.findByOrderIn(active).stream()
                .collect(Collectors.toMap(route -> route.getOrder().getId(), route -> route));
        List<CustomerActive> activeItems = active.stream().map(order -> {
            Route route = routeByOrder.get(order.getId());
            int[] stops = stopCounts(route);
            boolean tracked = order.getStatus() == OrderStatus.DRIVER_ENROUTE
                    || order.getStatus() == OrderStatus.ARRIVED || order.getStatus() == OrderStatus.IN_PROGRESS;
            return new CustomerActive(order.getPublicId(), order.getTrackingNumber(), order.getStatus().name(),
                    tracked ? routeService.liveEta(order, route) : null, stops[0], stops[1],
                    order.getStatus() == OrderStatus.CREATED,
                    order.getDriver() == null ? null : order.getDriver().getName());
        }).toList();

        List<CustomerAttention> attention = new ArrayList<>();
        orders.findByCustomerIdAndStatusAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(customerId,
                OrderStatus.FAILED, period.from()).forEach(order -> attention.add(new CustomerAttention(
                order.getPublicId(), order.getTrackingNumber(), "FAILED", order.getReason(), null)));
        queries.staleOrders(props, now, customerId).forEach(stale -> attention.add(new CustomerAttention(
                stale.orderId(), stale.trackingNumber(), "STALE", "Há " + stale.minutesInStage()
                + " min nesta etapa (limite " + stale.limitMin() + ")", stale.minutesInStage())));

        List<CustomerDelivered> delivered = orders.findTop10ByCustomerIdAndStatusOrderByFinishedAtDesc(customerId,
                OrderStatus.COMPLETED).stream().map(order -> new CustomerDelivered(order.getPublicId(),
                order.getTrackingNumber(), order.getFinishedAt(), order.getPodValue() != null)).toList();
        return new CustomerPanel(period.meta(now), activeItems, attention, ordersSummary(periodName, false, auth),
                delivered);
    }

    @Transactional(readOnly = true)
    public DriverPanel driverPanel(Authentication auth) {
        Instant now = clock.instant();
        Driver driver = drivers.findByUserUsernameAndActiveTrue(auth.getName())
                .orElseThrow(() -> BusinessException.notFound("Motorista"));
        DriverActive activeOrder = orders.findByDriverAndStatusIn(driver, IN_PROGRESS).stream().min(Comparator.comparing(Order::getCreatedAt)).map(order -> {
            Route route = routes.findByOrder(order).orElse(null);
            int[] stops = stopCounts(route);
            return new DriverActive(order.getPublicId(), order.getStatus().name(), routeService.nextStop(order, route),
                    stops[0], stops[1], order.isPodRequired() && order.getPodValue() == null);
        }).orElse(null);

        DashboardPeriod today = DashboardPeriod.resolve("today", props.timezone(), clock);
        Long ageS = driver.getLastSeenAt() == null ? null : Duration.between(driver.getLastSeenAt(), now).toSeconds();
        boolean valid = driver.getLat() != null && driver.getLng() != null && ageS != null
                && ageS <= routing.positionMaxAgeS();
        return new DriverPanel(today.meta(now), activeOrder, queries.driverQueue(driver.getId()),
                queries.driverToday(driver.getId(), auth.getName(), today),
                new Gps(driver.getLastSeenAt(), ageS, valid));
    }
}
