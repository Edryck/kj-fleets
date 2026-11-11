package br.com.kjfleets.dto;

import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import jakarta.validation.constraints.NotBlank;

public final class VehicleDtos {

    private VehicleDtos() {
    }

    public record VehicleRequest(@NotBlank String plate, @NotBlank String type, VehicleStatus status) {
    }

    public record VehicleResponse(String publicId, String plate, String type, VehicleStatus status, String driverId) {

        public static VehicleResponse from(Vehicle vehicle, String driverId) {
            return new VehicleResponse(vehicle.getPublicId(), vehicle.getPlate(), vehicle.getType(),
                    vehicle.getStatus(), driverId);
        }
    }
}
