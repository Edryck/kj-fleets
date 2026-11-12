package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.OrderDtos.ActivityRequest;
import br.com.kjfleets.dto.OrderDtos.AssignRequest;
import br.com.kjfleets.dto.OrderDtos.AvailableOrderResponse;
import br.com.kjfleets.dto.OrderDtos.CancelRequest;
import br.com.kjfleets.dto.OrderDtos.CreateOrderRequest;
import br.com.kjfleets.dto.OrderDtos.DriverOrderResponse;
import br.com.kjfleets.dto.OrderDtos.DriverOrderSummaryResponse;
import br.com.kjfleets.dto.OrderDtos.ItemDto;
import br.com.kjfleets.dto.OrderDtos.OrderDetailResponse;
import br.com.kjfleets.dto.OrderDtos.OrderFilter;
import br.com.kjfleets.dto.OrderDtos.OrderSummaryResponse;
import br.com.kjfleets.dto.OrderDtos.PodRequest;
import br.com.kjfleets.dto.OrderDtos.PointRequest;
import br.com.kjfleets.dto.OrderDtos.PublicEvent;
import br.com.kjfleets.dto.OrderDtos.PublicTrackingResponse;
import br.com.kjfleets.dto.OrderDtos.TrackingResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.dto.RealtimeDtos.DriverMoved;
import br.com.kjfleets.dto.RealtimeDtos.OrderTracked;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Payload;
import br.com.kjfleets.entity.PayloadItem;
import br.com.kjfleets.entity.Place;
import br.com.kjfleets.entity.StatusSubject;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.entity.TrackingStatus;
import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.PlaceRepository;
import br.com.kjfleets.repository.TrackingStatusRepository;
import br.com.kjfleets.repository.VehicleRepository;
import br.com.kjfleets.security.CurrentActor;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.time.Instant;

@Service
public class OrderService {

    private final OrderRepository orders;
    private final TrackingStatusRepository trackings;
    private final PlaceRepository places;
    private final CustomerRepository customers;
    private final DriverRepository drivers;
    private final VehicleRepository vehicles;
    private final RouteService routeService;
    private final StatusHistoryService history;
    private final ApplicationEventPublisher events;

    private static final List<String> HIDDEN_CODES = List.of("assigned", "unassigned", "stop_completed",
            "route_failed");

    private static final List<OrderStatus> ACTIVE = Arrays.stream(OrderStatus.values())
            .filter(OrderStatus::isActive).toList();

    public OrderService(OrderRepository orders, TrackingStatusRepository trackings, PlaceRepository places,
                        CustomerRepository customers, DriverRepository drivers, VehicleRepository vehicles,
                        RouteService routeService, StatusHistoryService history,
                        ApplicationEventPublisher events) {
        this.history = history;
        this.events = events;
        this.routeService = routeService;
        this.drivers = drivers;
        this.vehicles = vehicles;
        this.orders = orders;
        this.trackings = trackings;
        this.places = places;
        this.customers = customers;
    }

    @Transactional
    public OrderDetailResponse create(CreateOrderRequest request, Authentication auth) {
        if (request.pickup() == null || request.dropoff() == null) {
            throw new BusinessException("ORDER_PAYLOAD_INCOMPLETE", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Pedido precisa de pickup e dropoff");
        }
        Order order = new Order();
        order.setCustomer(resolveCustomer(request.customerId(), auth));
        order.setPodRequired(Boolean.TRUE.equals(request.podRequired()));
        order.setNotes(request.notes());
        order.setMeta(request.meta());

        Payload payload = new Payload();
        payload.setOrder(order);
        payload.setPickup(resolvePoint(request.pickup()));
        payload.setDropoff(resolvePoint(request.dropoff()));
        if (request.waypoints() != null) {
            request.waypoints().forEach(point -> payload.getWaypoints().add(resolvePoint(point)));
        }
        if (request.items() != null) {
            for (ItemDto dto : request.items()) {
                PayloadItem item = new PayloadItem();
                item.setName(dto.name());
                item.setQuantity(dto.quantity());
                payload.getItems().add(item);
            }
        }
        order.setPayload(payload);

        orders.save(order);
        track(order, "created", null, null, null);
        return OrderDetailResponse.from(order);
    }

    @Transactional
    public OrderDetailResponse assign(String publicId, AssignRequest request) {
        return assign(publicId, request, false);
    }

    @Transactional
    public OrderDetailResponse assign(String publicId, AssignRequest request, boolean fromBatch) {
        // ordem fixa de trava: pedido, motorista, veículo (evita deadlock e leitura velha)
        Order order = lockOrder(publicId);
        requireCreated(order);
        Driver driver = drivers.lockByPublicId(request.driverId())
                .orElseThrow(() -> BusinessException.notFound("Motorista"));
        checkDriver(driver);
        Vehicle vehicle = request.vehicleId() == null ? driver.getVehicle()
                : vehicles.findByPublicId(request.vehicleId())
                        .orElseThrow(() -> BusinessException.notFound("Veículo"));
        if (vehicle != null) {
            vehicle = vehicles.lockById(vehicle.getId()).orElseThrow();
        }
        checkVehicle(vehicle);
        // rota calculada antes da atribuição não vale mais (START muda)
        routeService.discard(order);
        order.setDriver(driver);
        order.setVehicle(vehicle);
        // o painel conta o despacho em lote por essa marca no details
        track(order, "assigned", driver.getName() + " (" + vehicle.getPlate() + ")" + (fromBatch ? " lote" : ""),
                null, null);
        return OrderDetailResponse.from(order);
    }

    @Transactional
    public OrderDetailResponse dispatch(String publicId) {
        Order order = lockOrder(publicId);
        requireCreated(order);
        if (order.getDriver() == null) {
            throw new BusinessException("ORDER_DISPATCH_REQUIRES_DRIVER", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Pedido sem motorista");
        }
        if (order.getVehicle() == null) {
            throw new BusinessException("ORDER_DISPATCH_REQUIRES_VEHICLE", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Pedido sem veículo");
        }
        // getId() do proxy não carrega a linha: o lock é que traz o estado fresco
        Driver driver = drivers.lockById(order.getDriver().getId()).orElseThrow();
        Vehicle vehicle = vehicles.lockById(order.getVehicle().getId()).orElseThrow();
        validateCandidate(driver, vehicle);
        startDelivery(order);
        return OrderDetailResponse.from(order);
    }

    @Transactional
    public DriverOrderResponse accept(String publicId, String username) {
        // o lock do pedido serializa os aceites: quem chega depois já vê o motorista gravado e leva 409
        Order order = lockOrder(publicId);
        // o vencedor já despacha, então o perdedor vê DISPATCHED: motorista gravado tem que vir antes do status
        if (order.getDriver() != null) {
            throw BusinessException.conflict("ORDER_ALREADY_TAKEN", "Pedido já foi aceito por outro motorista");
        }
        requireCreated(order);
        Driver driver = drivers.lockByUsername(username).orElseThrow(() -> BusinessException.notFound("Motorista"));
        if (driver.getVehicle() == null) {
            throw new BusinessException("ORDER_DISPATCH_REQUIRES_VEHICLE", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Motorista sem veículo");
        }
        checkDriver(driver);
        Vehicle vehicle = vehicles.lockById(driver.getVehicle().getId()).orElseThrow();
        checkVehicle(vehicle);
        order.setDriver(driver);
        order.setVehicle(vehicle);
        track(order, "assigned", driver.getName() + " (" + vehicle.getPlate() + ")", null, null);
        startDelivery(order);
        return DriverOrderResponse.from(order);
    }

    @Transactional
    public OrderDetailResponse advance(String publicId, ActivityRequest request, String actorUsername,
                                       boolean actorIsDriver) {
        Order order = lockOrder(publicId);
        if (actorIsDriver) {
            requireOwnDriver(order, actorUsername);
        }
        return applyActivity(order, request, actorUsername, actorIsDriver);
    }

    // motorista que não é o dono recebe 404, igual cliente de outro dono
    private void requireOwnDriver(Order order, String username) {
        Driver driver = order.getDriver();
        if (driver == null || !driver.isActive() || !driver.getUser().getUsername().equals(username)) {
            throw BusinessException.notFound("Pedido");
        }
    }

    private OrderDetailResponse applyActivity(Order order, ActivityRequest request, String actorUsername,
                                              boolean actorIsDriver) {
        OrderStatus target = request.code();
        if ((request.lat() == null) != (request.lng() == null)) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "informe lat e lng juntos");
        }
        boolean hasReason = request.reason() != null && !request.reason().isBlank();
        if (target == OrderStatus.FAILED && !hasReason) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "FAILED exige reason");
        }
        // CANCELLED e DISPATCHED têm rota própria, mesmo que a tabela deixasse passar
        if (target == OrderStatus.DISPATCHED || target == OrderStatus.CANCELLED
                || !order.getStatus().canGoTo(target)) {
            throw invalidTransition(order);
        }
        if (target == OrderStatus.COMPLETED && order.isPodRequired() && order.getPodValue() == null) {
            throw new BusinessException("ORDER_POD_REQUIRED", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Pedido exige prova de entrega antes de concluir");
        }
        if (actorIsDriver && target == OrderStatus.COMPLETED) {
            routeService.requireNearDropoff(order, request.lat(), request.lng());
        }
        order.setStatus(target);
        if (target == OrderStatus.ARRIVED) {
            routeService.markVisited(order, StopType.PICKUP, actorUsername);
        } else if (target == OrderStatus.COMPLETED) {
            routeService.markVisited(order, StopType.DROPOFF, actorUsername);
        }
        if (target == OrderStatus.FAILED) {
            order.setReason(request.reason());
        }
        if (actorIsDriver && request.lat() != null) {
            Driver driver = drivers.lockById(order.getDriver().getId()).orElseThrow();
            driver.setLat(request.lat());
            driver.setLng(request.lng());
            driver.setLastSeenAt(Instant.now());
            events.publishEvent(new DriverMoved(driver.getPublicId(), driver.getName(), driver.getStatus().name(),
                    request.lat(), request.lng()));
        }
        String details = hasReason ? request.reason() : null;
        if (!actorIsDriver) {
            details = details == null ? "por " + actorUsername : details + " (por " + actorUsername + ")";
        }
        track(order, target.name().toLowerCase(), details, request.lat(), request.lng());
        if (target.isTerminal()) {
            finish(order);
        }
        return OrderDetailResponse.from(order);
    }

    @Transactional
    public OrderDetailResponse registerPod(String publicId, PodRequest request, String actorUsername,
                                           boolean actorIsDriver) {
        Order order = lockOrder(publicId);
        if (actorIsDriver) {
            requireOwnDriver(order, actorUsername);
        }
        if (order.getStatus() != OrderStatus.IN_PROGRESS) {
            throw invalidTransition(order);
        }
        order.setPodValue(request.value());
        order.setPodAt(Instant.now());
        track(order, "pod_registered", request.value(), null, null);
        return OrderDetailResponse.from(order);
    }

    @Transactional
    public OrderDetailResponse cancel(String publicId, CancelRequest request, Authentication auth) {
        Order order = lockOrder(publicId);
        checkVisible(order, auth);
        boolean allowed = isCustomer(auth) ? order.getStatus() == OrderStatus.CREATED
                : order.getStatus().canGoTo(OrderStatus.CANCELLED);
        if (!allowed) {
            throw invalidTransition(order);
        }
        order.setStatus(OrderStatus.CANCELLED);
        order.setReason(request.reason());
        track(order, "cancelled", request.reason(), null, null);
        finish(order);
        return OrderDetailResponse.from(order);
    }

    // só libera quem foi ocupado por este pedido; ordem de trava igual à do dispatch
    private void finish(Order order) {
        order.setFinishedAt(Instant.now());
        if (order.getDispatchedAt() == null) {
            return;
        }
        Driver driver = drivers.lockById(order.getDriver().getId()).orElseThrow();
        Vehicle vehicle = vehicles.lockById(order.getVehicle().getId()).orElseThrow();
        if (driver.getStatus() == DriverStatus.BUSY) {
            driver.setStatus(DriverStatus.AVAILABLE);
            history.record(StatusSubject.DRIVER, driver.getId(), DriverStatus.BUSY.name(),
                    DriverStatus.AVAILABLE.name(), "finish");
        }
        if (vehicle.getStatus() == VehicleStatus.IN_USE) {
            vehicle.setStatus(VehicleStatus.AVAILABLE);
            history.record(StatusSubject.VEHICLE, vehicle.getId(), VehicleStatus.IN_USE.name(),
                    VehicleStatus.AVAILABLE.name(), "finish");
        }
    }

    private BusinessException invalidTransition(Order order) {
        return new BusinessException("ORDER_INVALID_TRANSITION", HttpStatus.UNPROCESSABLE_ENTITY,
                "Pedido em " + order.getStatus() + " não aceita esta ação");
    }

    // motorista e veículo já chegam travados; a ordem das checagens é a da spec
    void validateCandidate(Driver driver, Vehicle vehicle) {
        checkDriver(driver);
        checkVehicle(vehicle);
    }

    private void checkDriver(Driver driver) {
        if (!driver.isActive() || driver.getStatus() != DriverStatus.AVAILABLE) {
            throw new BusinessException("DRIVER_NOT_AVAILABLE", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Motorista indisponível");
        }
        if (orders.existsByDriverAndStatusIn(driver, ACTIVE)) {
            throw new BusinessException("DRIVER_HAS_ACTIVE_ORDER", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Motorista já tem pedido ativo");
        }
    }

    private void checkVehicle(Vehicle vehicle) {
        if (vehicle == null) {
            throw new BusinessException("ORDER_DISPATCH_REQUIRES_VEHICLE", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Motorista sem veículo e nenhum veículo informado");
        }
        if (!vehicle.isActive() || vehicle.getStatus() == VehicleStatus.MAINTENANCE
                || orders.existsByVehicleAndStatusIn(vehicle, ACTIVE)) {
            throw new BusinessException("VEHICLE_NOT_AVAILABLE", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Veículo indisponível");
        }
    }

    Order lockOrder(String publicId) {
        return orders.lockByPublicId(publicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
    }

    void startDelivery(Order order) {
        order.setStatus(OrderStatus.DISPATCHED);
        order.setDispatchedAt(Instant.now());
        Driver driver = order.getDriver();
        Vehicle vehicle = order.getVehicle();
        String driverBefore = driver.getStatus().name();
        String vehicleBefore = vehicle.getStatus().name();
        driver.setStatus(DriverStatus.BUSY);
        vehicle.setStatus(VehicleStatus.IN_USE);
        history.record(StatusSubject.DRIVER, driver.getId(), driverBefore, DriverStatus.BUSY.name(), "dispatch");
        history.record(StatusSubject.VEHICLE, vehicle.getId(), vehicleBefore, VehicleStatus.IN_USE.name(),
                "dispatch");
        track(order, "dispatched", null, null, null);
        routeService.computeOnDispatch(order).ifPresent(code -> track(order, "route_failed", code, null, null));
    }

    private void requireCreated(Order order) {
        if (order.getStatus() != OrderStatus.CREATED) {
            throw new BusinessException("ORDER_INVALID_TRANSITION", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Pedido em " + order.getStatus() + " não aceita esta ação");
        }
    }

    @Transactional(readOnly = true)
    public PublicTrackingResponse publicTracking(String trackingNumber) {
        Order order = orders.findByTrackingNumber(trackingNumber)
                .orElseThrow(() -> BusinessException.notFound("Pedido"));
        List<PublicEvent> timeline = trackings.findByOrderOrderByCreatedAtAscIdAsc(order).stream()
                .filter(t -> !HIDDEN_CODES.contains(t.getCode()))
                .map(t -> new PublicEvent(t.getCode(), t.getStatus(), t.getCreatedAt())).toList();
        return new PublicTrackingResponse(order.getTrackingNumber(), order.getStatus(), order.getCreatedAt(),
                order.getFinishedAt(), routeService.liveEta(order), timeline);
    }

    // chamado pelo DriverService antes de tocar no motorista: a ordem de trava é pedido, motorista, veículo
    @Transactional
    public void releaseDriver(Driver driver) {
        releaseOrdersOf(driver);
        // com o lock do motorista nenhum assign novo entra; a segunda passada pega o que commitou no meio
        drivers.lockById(driver.getId()).orElseThrow();
        releaseOrdersOf(driver);
        // despacho que ganhou a corrida do lock acima já commitou: a consulta nova enxerga
        if (orders.existsByDriverAndStatusIn(driver, ACTIVE)) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Motorista ocupado não pode ser removido");
        }
    }

    @Transactional
    public void releaseVehicle(Vehicle vehicle) {
        releaseOrdersOf(vehicle);
        // com o lock do veículo nenhum assign novo entra; a segunda passada pega o que commitou no meio
        vehicles.lockById(vehicle.getId()).orElseThrow();
        releaseOrdersOf(vehicle);
        if (orders.existsByVehicleAndStatusIn(vehicle, ACTIVE)) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Veículo em uso não pode ser removido");
        }
    }

    private void releaseOrdersOf(Driver driver) {
        for (Order order : orders.findByDriverAndStatus(driver, OrderStatus.CREATED)) {
            routeService.discard(order);
            order.setDriver(null);
            order.setVehicle(null);
            track(order, "unassigned", "motorista desativado", null, null);
        }
    }

    private void releaseOrdersOf(Vehicle vehicle) {
        for (Order order : orders.findByVehicleAndStatus(vehicle, OrderStatus.CREATED)) {
            routeService.discard(order);
            order.setVehicle(null);
            track(order, "unassigned", "veículo desativado", null, null);
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummaryResponse> list(OrderFilter filter, Integer limit, Integer offset,
                                                   Authentication auth) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        OrderFilter scoped = isCustomer(auth) ? ownOnly(filter, auth) : filter;
        String q = filter.q() == null ? "" : filter.q().trim();
        if (q.length() > 100) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "q deve ter até 100 caracteres");
        }
        boolean byStatus = "status".equals(filter.sort());
        if (filter.sort() != null && !byStatus && !"createdAt".equals(filter.sort())
                || filter.dir() != null && !filter.dir().equals("asc") && !filter.dir().equals("desc")) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "sort deve ser createdAt ou status e dir asc ou desc");
        }
        scoped = new OrderFilter(scoped.status(), scoped.driverId(), scoped.customerId(), scoped.active(),
                scoped.from(), scoped.to(), q, byStatus ? "status" : "createdAt", filter.dir());
        return PageResponse.of(orders.findAll(matching(scoped), pageable), OrderSummaryResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public OrderDetailResponse get(String publicId, Authentication auth) {
        return OrderDetailResponse.from(findVisible(publicId, auth));
    }

    @Transactional(readOnly = true)
    public List<TrackingResponse> tracking(String publicId, Authentication auth) {
        return trackings.findByOrderOrderByCreatedAtAscIdAsc(findVisible(publicId, auth)).stream()
                .map(TrackingResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DriverOrderSummaryResponse> driverOrders(String username, OrderStatus status, Integer limit,
                                                           Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        return PageResponse.of(orders.findDriverOrders(username, status, pageable), DriverOrderSummaryResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public PageResponse<AvailableOrderResponse> availableOrders(Integer limit, Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        return PageResponse.of(orders.findAvailable(pageable), AvailableOrderResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public DriverOrderResponse driverOrder(String publicId, String username) {
        return DriverOrderResponse.from(findDriverOrder(publicId, username));
    }

    Order findDriverOrder(String publicId, String username) {
        Order order = findOrder(publicId);
        requireOwnDriver(order, username);
        return order;
    }

    // cliente de outro dono recebe 404, não 403, para não confirmar que o pedido existe
    Order findVisible(String publicId, Authentication auth) {
        Order order = findOrder(publicId);
        checkVisible(order, auth);
        return order;
    }

    private void checkVisible(Order order, Authentication auth) {
        if (isCustomer(auth)) {
            Customer own = resolveCustomer(null, auth);
            if (order.getCustomer() == null || !own.getPublicId().equals(order.getCustomer().getPublicId())) {
                throw BusinessException.notFound("Pedido");
            }
        }
    }

    Order findOrder(String publicId) {
        return orders.findByPublicId(publicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
    }

    private OrderFilter ownOnly(OrderFilter filter, Authentication auth) {
        String customerId = resolveCustomer(null, auth).getPublicId();
        return new OrderFilter(filter.status(), null, customerId, filter.active(), filter.from(), filter.to(),
                filter.q(), filter.sort(), filter.dir());
    }

    private static Specification<Order> matching(OrderFilter filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (filter.status() != null && !filter.status().isEmpty()) {
                predicates.add(root.get("status").in(filter.status()));
            }
            if (filter.driverId() != null) {
                predicates.add(cb.equal(root.get("driver").get("publicId"), filter.driverId()));
            }
            if (filter.customerId() != null) {
                predicates.add(cb.equal(root.get("customer").get("publicId"), filter.customerId()));
            }
            if (filter.active() != null) {
                List<OrderStatus> statuses = Arrays.stream(OrderStatus.values())
                        .filter(status -> status.isActive() == filter.active()).toList();
                predicates.add(root.get("status").in(statuses));
            }
            if (filter.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), filter.from()));
            }
            if (filter.to() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), filter.to()));
            }
            if (!filter.q().isEmpty()) {
                // joins to-one: não duplicam linhas, então count e paginação seguem corretos
                var payload = root.join("payload", JoinType.LEFT);
                String pattern = "%" + filter.q().toLowerCase().replace("\\", "\\\\").replace("%", "\\%")
                        .replace("_", "\\_") + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("trackingNumber")), pattern, '\\'),
                        cb.like(cb.lower(payload.join("pickup", JoinType.LEFT).get("name")), pattern, '\\'),
                        cb.like(cb.lower(payload.join("dropoff", JoinType.LEFT).get("name")), pattern, '\\')));
            }
            // count não aceita ORDER BY sem GROUP BY no Postgres
            if (query.getResultType() != Long.class) {
                Path<?> primary = root.get(filter.sort());
                query.orderBy(filter.dir() == null || filter.dir().equals("desc") ? cb.desc(primary) : cb.asc(primary),
                        cb.desc(root.get("createdAt")), cb.desc(root.get("publicId")));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private boolean isCustomer(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER"));
    }

    void track(Order order, String code, String details, Double lat, Double lng) {
        CurrentActor actor = CurrentActor.get();
        trackings.save(TrackingStatus.of(order, code, details, lat, lng, actor.username(), actor.role()));
        events.publishEvent(new OrderTracked(order.getId(), code));
    }

    private Customer resolveCustomer(String customerId, Authentication auth) {
        if (isCustomer(auth)) {
            return customers.findByUserUsername(auth.getName())
                    .orElseThrow(() -> BusinessException.notFound("Cliente"));
        }
        if (customerId == null) {
            return null;
        }
        return customers.findByPublicId(customerId).orElseThrow(() -> BusinessException.notFound("Cliente"));
    }

    private Place resolvePoint(PointRequest point) {
        boolean hasPlaceId = point.placeId() != null && !point.placeId().isBlank();
        boolean hasNew = point.name() != null || point.address() != null || point.lat() != null
                || point.lng() != null;
        if (hasPlaceId == hasNew) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "ponto: informe placeId ou um lugar novo (name, lat, lng), nunca os dois");
        }
        if (hasPlaceId) {
            return places.findByPublicIdAndActiveTrue(point.placeId())
                    .orElseThrow(() -> BusinessException.notFound("Lugar"));
        }
        if (point.name() == null || point.name().isBlank() || point.lat() == null || point.lng() == null) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "ponto: lugar novo precisa de name, lat e lng");
        }
        Place place = new Place();
        place.setName(point.name());
        place.setAddress(point.address());
        place.setLat(point.lat());
        place.setLng(point.lng());
        return places.save(place);
    }
}
