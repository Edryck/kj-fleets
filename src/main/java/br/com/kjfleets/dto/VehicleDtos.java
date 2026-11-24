package br.com.kjfleets.dto;

import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public final class VehicleDtos {

    private VehicleDtos() {
    }

    public record VehicleRequest(@NotBlank @Size(max = 20) String plate, @NotBlank @Size(max = 40) String type, VehicleStatus status,
                                 @Size(max = 40) String brand, @Size(max = 60) String model,
                                 @Min(1980) Integer year, @Size(max = 20) String color,
                                 @Min(1) @Max(60000) Integer capacityKg,
                                 @DecimalMin("0.1") @DecimalMax("150") BigDecimal volumeM3,
                                 @Min(0) @Max(5000000) Integer odometerKm) {
    }

    public record VehicleResponse(String publicId, String plate, String type, VehicleStatus status, String driverId,
                                  String driverName, boolean active, String brand, String model, Integer year,
                                  String color, Integer capacityKg, BigDecimal volumeM3, Integer odometerKm) {

        public static VehicleResponse from(Vehicle vehicle, String driverId, String driverName) {
            return new VehicleResponse(vehicle.getPublicId(), vehicle.getPlate(), vehicle.getType(),
                    vehicle.getStatus(), driverId, driverName, vehicle.isActive(), vehicle.getBrand(),
                    vehicle.getModel(), vehicle.getModelYear(), vehicle.getColor(), vehicle.getCapacityKg(),
                    vehicle.getVolumeM3(), vehicle.getOdometerKm());
        }
    }
}
