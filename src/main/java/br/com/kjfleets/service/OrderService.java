package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.OrderDtos.AssignRequest;
import br.com.kjfleets.dto.OrderDtos.CreateOrderRequest;
import br.com.kjfleets.dto.OrderDtos.ItemDto;
import br.com.kjfleets.dto.OrderDtos.OrderDetailResponse;
import br.com.kjfleets.dto.OrderDtos.OrderFilter;
import br.com.kjfleets.dto.OrderDtos.OrderSummaryResponse;
import br.com.kjfleets.dto.OrderDtos.PointRequest;
import br.com.kjfleets.dto.OrderDtos.TrackingResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Payload;
import br.com.kjfleets.entity.PayloadItem;
import br.com.kjfleets.entity.Place;
import br.com.kjfleets.entity.TrackingStatus;
import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.PlaceRepository;
import br.com.kjfleets.repository.TrackingStatusRepository;
import br.com.kjfleets.repository.VehicleRepository;
import jakarta.persistence.criteria.Predicate;
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

    private static final List<OrderStatus> ACTIVE = Arrays.stream(OrderStatus.values())
            .filter(OrderStatus::isActive).toList();

    public OrderService(OrderRepository orders, TrackingStatusRepository trackings, PlaceRepository places,
                        CustomerRepository customers, DriverRepository drivers, VehicleRepository vehicles) {
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
        order.setDriver(driver);
        order.setVehicle(vehicle);
        track(order, "assigned", driver.getName() + " (" + vehicle.getPlate() + ")", null, null);
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
        order.getDriver().setStatus(DriverStatus.BUSY);
        order.getVehicle().setStatus(VehicleStatus.IN_USE);
        track(order, "dispatched", null, null, null);
    }

    private void requireCreated(Order order) {
        if (order.getStatus() != OrderStatus.CREATED) {
            throw new BusinessException("ORDER_INVALID_TRANSITION", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Pedido em " + order.getStatus() + " não aceita esta ação");
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummaryResponse> list(OrderFilter filter, Integer limit, Integer offset,
                                                   Authentication auth) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        OrderFilter scoped = isCustomer(auth) ? ownOnly(filter, auth) : filter;
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

    // cliente de outro dono recebe 404, não 403, para não confirmar que o pedido existe
    Order findVisible(String publicId, Authentication auth) {
        Order order = findOrder(publicId);
        if (isCustomer(auth)) {
            Customer own = resolveCustomer(null, auth);
            if (order.getCustomer() == null || !own.getPublicId().equals(order.getCustomer().getPublicId())) {
                throw BusinessException.notFound("Pedido");
            }
        }
        return order;
    }

    Order findOrder(String publicId) {
        return orders.findByPublicId(publicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
    }

    private OrderFilter ownOnly(OrderFilter filter, Authentication auth) {
        String customerId = resolveCustomer(null, auth).getPublicId();
        return new OrderFilter(filter.status(), null, customerId, filter.active(), filter.from(), filter.to());
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
            // count não aceita ORDER BY sem GROUP BY no Postgres
            if (query.getResultType() != Long.class) {
                query.orderBy(cb.desc(root.get("createdAt")), cb.desc(root.get("publicId")));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private boolean isCustomer(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER"));
    }

    void track(Order order, String code, String details, Double lat, Double lng) {
        trackings.save(TrackingStatus.of(order, code, details, lat, lng));
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
