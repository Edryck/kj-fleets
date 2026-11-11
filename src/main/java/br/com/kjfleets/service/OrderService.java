package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.OrderDtos.CreateOrderRequest;
import br.com.kjfleets.dto.OrderDtos.ItemDto;
import br.com.kjfleets.dto.OrderDtos.OrderDetailResponse;
import br.com.kjfleets.dto.OrderDtos.PointRequest;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.Payload;
import br.com.kjfleets.entity.PayloadItem;
import br.com.kjfleets.entity.Place;
import br.com.kjfleets.entity.TrackingStatus;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.PlaceRepository;
import br.com.kjfleets.repository.TrackingStatusRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orders;
    private final TrackingStatusRepository trackings;
    private final PlaceRepository places;
    private final CustomerRepository customers;

    public OrderService(OrderRepository orders, TrackingStatusRepository trackings, PlaceRepository places,
                        CustomerRepository customers) {
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
                item.setPayload(payload);
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

    Order findOrder(String publicId) {
        return orders.findByPublicId(publicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
    }

    void track(Order order, String code, String details, Double lat, Double lng) {
        trackings.save(TrackingStatus.of(order, code, details, lat, lng));
    }

    private Customer resolveCustomer(String customerId, Authentication auth) {
        boolean isCustomer = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER"));
        if (isCustomer) {
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
