package br.com.kjfleets.dto;

import br.com.kjfleets.dto.VehicleDtos.VehicleResponse;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class DriverDtos {

    private DriverDtos() {
    }

    public record CreateDriverRequest(@NotBlank String username, @NotBlank @Size(min = 8) String password,
                                      @NotBlank String name, String phone, String licenseNumber, String vehicleId) {
    }

    public record UpdateDriverRequest(@NotBlank String name, String phone, String licenseNumber, String vehicleId,
                                      DriverStatus status) {
    }

    public record DriverResponse(String publicId, String username, String name, String phone, String licenseNumber,
                                 DriverStatus status, Double lat, Double lng, Instant lastSeenAt,
                                 VehicleResponse vehicle) {

        public static DriverResponse from(Driver driver) {
            VehicleResponse vehicle = driver.getVehicle() == null ? null
                    : VehicleResponse.from(driver.getVehicle(), driver.getPublicId());
            return new DriverResponse(driver.getPublicId(), driver.getUser().getUsername(), driver.getName(),
                    driver.getPhone(), driver.getLicenseNumber(), driver.getStatus(), driver.getLat(),
                    driver.getLng(), driver.getLastSeenAt(), vehicle);
        }
    }
}
