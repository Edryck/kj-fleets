package br.com.kjfleets.dto;

import br.com.kjfleets.dto.DriverDtos.DriverResponse;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Fleet;
import jakarta.validation.constraints.NotBlank;

import java.util.Comparator;
import java.util.List;

public final class FleetDtos {

    private FleetDtos() {
    }

    public record FleetRequest(@NotBlank String name, List<String> driverIds) {
    }

    public record FleetResponse(String publicId, String name, int driverCount) {

        public static FleetResponse from(Fleet fleet) {
            return new FleetResponse(fleet.getPublicId(), fleet.getName(), fleet.getDrivers().size());
        }
    }

    public record FleetDetailResponse(String publicId, String name, List<DriverResponse> drivers) {

        public static FleetDetailResponse from(Fleet fleet) {
            List<DriverResponse> drivers = fleet.getDrivers().stream()
                    .sorted(Comparator.comparing(Driver::getName))
                    .map(DriverResponse::from)
                    .toList();
            return new FleetDetailResponse(fleet.getPublicId(), fleet.getName(), drivers);
        }
    }
}
