package br.com.kjfleets.dto;

import br.com.kjfleets.dto.PlaceDtos.PlaceResponse;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Payload;
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

    public record CustomerRef(String publicId, String name) {
    }

    public record DriverRef(String publicId, String name) {
    }

    public record VehicleRef(String publicId, String plate) {
    }

    public record OrderDetailResponse(String publicId, String trackingNumber, OrderStatus status,
                                      CustomerRef customer, DriverRef driver, VehicleRef vehicle,
                                      PlaceResponse pickup, PlaceResponse dropoff, List<PlaceResponse> waypoints,
                                      List<ItemDto> items, Boolean podRequired, String podValue, Instant podAt,
                                      String reason, String notes, Map<String, Object> meta, Instant createdAt,
                                      Instant dispatchedAt, Instant finishedAt) {

        public static OrderDetailResponse from(Order order) {
            Payload payload = order.getPayload();
            var customer = order.getCustomer();
            var driver = order.getDriver();
            var vehicle = order.getVehicle();
            return new OrderDetailResponse(order.getPublicId(), order.getTrackingNumber(), order.getStatus(),
                    customer == null ? null : new CustomerRef(customer.getPublicId(), customer.getName()),
                    driver == null ? null : new DriverRef(driver.getPublicId(), driver.getName()),
                    vehicle == null ? null : new VehicleRef(vehicle.getPublicId(), vehicle.getPlate()),
                    PlaceResponse.from(payload.getPickup()), PlaceResponse.from(payload.getDropoff()),
                    payload.getWaypoints().stream().map(PlaceResponse::from).toList(),
                    payload.getItems().stream().map(i -> new ItemDto(i.getName(), i.getQuantity())).toList(),
                    order.isPodRequired(), order.getPodValue(), order.getPodAt(), order.getReason(),
                    order.getNotes(), order.getMeta(), order.getCreatedAt(), order.getDispatchedAt(),
                    order.getFinishedAt());
        }
    }
}
