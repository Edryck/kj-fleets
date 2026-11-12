package br.com.kjfleets.dto;

import br.com.kjfleets.dto.PlaceDtos.PlaceResponse;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Payload;
import br.com.kjfleets.entity.TrackingStatus;
import br.com.kjfleets.entity.Vehicle;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class OrderDtos {

    private OrderDtos() {
    }

    public record PointRequest(String placeId, String name, String address,
                               @DecimalMin("-90") @DecimalMax("90") Double lat,
                               @DecimalMin("-180") @DecimalMax("180") Double lng) {
    }

    public record ItemDto(@NotBlank String name, @Min(1) int quantity) {
    }

    // pickup e dropoff sem @NotNull de propósito: ausência é 422. podRequired é Boolean porque o Jackson 3 recusa primitivo ausente
    public record CreateOrderRequest(String customerId, @Valid PointRequest pickup, @Valid PointRequest dropoff,
                                     @Valid @Size(max = 50) List<@NotNull PointRequest> waypoints,
                                     @Valid @Size(max = 100) List<@NotNull ItemDto> items, Boolean podRequired,
                                     @Size(max = 500) String notes, Map<String, Object> meta) {
    }

    public record AssignRequest(@NotBlank String driverId, String vehicleId) {
    }

    public record OrderFilter(List<OrderStatus> status, String driverId, String customerId, Boolean active,
                              Instant from, Instant to) {
    }

    public record CustomerRef(String publicId, String name) {

        static CustomerRef from(Customer customer) {
            return customer == null ? null : new CustomerRef(customer.getPublicId(), customer.getName());
        }
    }

    public record DriverRef(String publicId, String name) {

        static DriverRef from(Driver driver) {
            return driver == null ? null : new DriverRef(driver.getPublicId(), driver.getName());
        }
    }

    public record VehicleRef(String publicId, String plate) {

        static VehicleRef from(Vehicle vehicle) {
            return vehicle == null ? null : new VehicleRef(vehicle.getPublicId(), vehicle.getPlate());
        }
    }

    public record OrderSummaryResponse(String publicId, String trackingNumber, OrderStatus status, Instant createdAt,
                                       Instant dispatchedAt, Instant finishedAt, String pickupName,
                                       String dropoffName, int waypointCount, DriverRef driver, VehicleRef vehicle,
                                       CustomerRef customer) {

        public static OrderSummaryResponse from(Order order) {
            Payload payload = order.getPayload();
            return new OrderSummaryResponse(order.getPublicId(), order.getTrackingNumber(), order.getStatus(),
                    order.getCreatedAt(), order.getDispatchedAt(), order.getFinishedAt(),
                    payload.getPickup().getName(), payload.getDropoff().getName(), payload.getWaypoints().size(),
                    DriverRef.from(order.getDriver()), VehicleRef.from(order.getVehicle()),
                    CustomerRef.from(order.getCustomer()));
        }
    }

    public record TrackingResponse(String code, OrderStatus status, String details, Double lat, Double lng,
                                   Instant at) {

        public static TrackingResponse from(TrackingStatus tracking) {
            return new TrackingResponse(tracking.getCode(), tracking.getStatus(), tracking.getDetails(),
                    tracking.getLat(), tracking.getLng(), tracking.getCreatedAt());
        }
    }

    public record OrderDetailResponse(String publicId, String trackingNumber, OrderStatus status,
                                      CustomerRef customer, DriverRef driver, VehicleRef vehicle,
                                      PlaceResponse pickup, PlaceResponse dropoff, List<PlaceResponse> waypoints,
                                      List<ItemDto> items, Boolean podRequired, String podValue, Instant podAt,
                                      String reason, String notes, Map<String, Object> meta, Instant createdAt,
                                      Instant dispatchedAt, Instant finishedAt) {

        public static OrderDetailResponse from(Order order) {
            Payload payload = order.getPayload();
            return new OrderDetailResponse(order.getPublicId(), order.getTrackingNumber(), order.getStatus(),
                    CustomerRef.from(order.getCustomer()), DriverRef.from(order.getDriver()),
                    VehicleRef.from(order.getVehicle()),
                    PlaceResponse.from(payload.getPickup()), PlaceResponse.from(payload.getDropoff()),
                    payload.getWaypoints().stream().map(PlaceResponse::from).toList(),
                    payload.getItems().stream().map(i -> new ItemDto(i.getName(), i.getQuantity())).toList(),
                    order.isPodRequired(), order.getPodValue(), order.getPodAt(), order.getReason(),
                    order.getNotes(), order.getMeta(), order.getCreatedAt(), order.getDispatchedAt(),
                    order.getFinishedAt());
        }
    }
}
