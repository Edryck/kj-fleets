package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.DriverDtos.CreateDriverRequest;
import br.com.kjfleets.dto.DriverDtos.DriverResponse;
import br.com.kjfleets.dto.DriverDtos.LocationRequest;
import br.com.kjfleets.dto.DriverDtos.NearestDriverResponse;
import br.com.kjfleets.dto.DriverDtos.UpdateDriverRequest;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.VehicleRepository;
import br.com.kjfleets.routing.Haversine;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
public class DriverService {

    private final DriverRepository drivers;
    private final VehicleRepository vehicles;
    private final AuthService auth;
    private final OrderService orderService;

    public DriverService(DriverRepository drivers, VehicleRepository vehicles, AuthService auth,
                         OrderService orderService) {
        this.drivers = drivers;
        this.vehicles = vehicles;
        this.auth = auth;
        this.orderService = orderService;
    }

    @Transactional
    public DriverResponse create(CreateDriverRequest request) {
        Driver driver = new Driver();
        driver.setUser(auth.newUser(request.username(), request.password(), Role.DRIVER));
        driver.setName(request.name());
        driver.setPhone(request.phone());
        driver.setLicenseNumber(request.licenseNumber());
        driver.setVehicle(resolveVehicle(request.vehicleId(), null));
        return DriverResponse.from(drivers.save(driver));
    }

    @Transactional(readOnly = true)
    public PageResponse<DriverResponse> list(Integer limit, Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        return PageResponse.of(drivers.findByActiveTrueOrderByNameAsc(pageable), DriverResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public DriverResponse get(String publicId) {
        return DriverResponse.from(findActive(publicId));
    }

    @Transactional
    public DriverResponse update(String publicId, UpdateDriverRequest request) {
        Driver driver = findActive(publicId);
        if (request.status() == DriverStatus.BUSY) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "status: BUSY é definido pelas rotas, não manualmente");
        }
        DriverStatus status = request.status() == null ? driver.getStatus() : request.status();
        if (driver.getStatus() == DriverStatus.BUSY && status != DriverStatus.BUSY) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Motorista ocupado não pode mudar de status");
        }
        driver.setVehicle(resolveVehicle(request.vehicleId(), driver));
        driver.setName(request.name());
        driver.setPhone(request.phone());
        driver.setLicenseNumber(request.licenseNumber());
        driver.setStatus(status);
        return DriverResponse.from(driver);
    }

    @Transactional
    public void delete(String publicId) {
        Driver driver = findActive(publicId);
        if (driver.getStatus() == DriverStatus.BUSY) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Motorista ocupado não pode ser removido");
        }
        orderService.releaseDriver(driver);
        // Fleet é o dono do join table, então a saída da frota tem que ser pelo lado dela
        driver.getFleets().forEach(fleet -> fleet.getDrivers().remove(driver));
        driver.setActive(false);
        driver.getUser().setActive(false);
        driver.setVehicle(null);
    }

    @Transactional(readOnly = true)
    public DriverResponse me(String username) {
        return DriverResponse.from(findByUsername(username));
    }

    @Transactional
    public void updateLocation(String username, LocationRequest request) {
        Driver driver = findByUsername(username);
        driver.setLat(request.lat());
        driver.setLng(request.lng());
        driver.setLastSeenAt(Instant.now());
    }

    @Transactional(readOnly = true)
    public List<NearestDriverResponse> nearest(double lat, double lng, Integer limit) {
        int size = limit == null ? 5 : limit;
        if (size < 1) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "limit: deve ser >= 1");
        }
        return drivers.findByActiveTrueAndStatusAndLatNotNullAndLngNotNull(DriverStatus.AVAILABLE).stream()
                .map(d -> new NearestDriverResponse(DriverResponse.from(d),
                        Haversine.km(lat, lng, d.getLat(), d.getLng())))
                .sorted(Comparator.comparingDouble(NearestDriverResponse::distanceKm))
                .limit(Math.min(size, 20))
                .toList();
    }

    public Driver findActive(String publicId) {
        return drivers.findByPublicIdAndActiveTrue(publicId)
                .orElseThrow(() -> BusinessException.notFound("Motorista"));
    }

    private Driver findByUsername(String username) {
        return drivers.findByUserUsernameAndActiveTrue(username)
                .orElseThrow(() -> BusinessException.notFound("Motorista"));
    }

    // current é o motorista sendo editado: manter o mesmo veículo não conta como conflito
    private Vehicle resolveVehicle(String vehicleId, Driver current) {
        if (vehicleId == null) {
            return null;
        }
        Vehicle vehicle = vehicles.findByPublicId(vehicleId)
                .orElseThrow(() -> BusinessException.notFound("Veículo"));
        boolean sameAsCurrent = current != null && current.getVehicle() != null
                && current.getVehicle().getId().equals(vehicle.getId());
        if (sameAsCurrent) {
            return vehicle;
        }
        boolean linkedToOther = drivers.findByVehicleAndActiveTrue(vehicle).isPresent();
        if (!vehicle.isActive() || vehicle.getStatus() == VehicleStatus.MAINTENANCE || linkedToOther) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Veículo indisponível para vínculo");
        }
        return vehicle;
    }
}
