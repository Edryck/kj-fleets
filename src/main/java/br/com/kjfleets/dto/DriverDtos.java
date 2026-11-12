package br.com.kjfleets.dto;

import br.com.kjfleets.dto.VehicleDtos.VehicleResponse;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Fleet;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

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
                                 VehicleResponse vehicle, boolean active, List<FleetRef> fleets) {

        public static DriverResponse from(Driver driver) {
            VehicleResponse vehicle = driver.getVehicle() == null ? null
                    : VehicleResponse.from(driver.getVehicle(), driver.getPublicId(), driver.getName());
            List<FleetRef> fleets = driver.getFleets().stream().filter(Fleet::isActive)
                    .sorted(Comparator.comparing(Fleet::getName).thenComparing(Fleet::getPublicId))
                    .map(f -> new FleetRef(f.getPublicId(), f.getName())).toList();
            return new DriverResponse(driver.getPublicId(), driver.getUser().getUsername(), driver.getName(),
                    driver.getPhone(), driver.getLicenseNumber(), driver.getStatus(), driver.getLat(),
                    driver.getLng(), driver.getLastSeenAt(), vehicle, driver.isActive(), fleets);
        }
    }

    public record FleetRef(String publicId, String name) {
    }

    public record LocationRequest(@NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
                                  @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng) {
    }

    public record NearestDriverResponse(DriverResponse driver, double distanceKm) {
    }
}
