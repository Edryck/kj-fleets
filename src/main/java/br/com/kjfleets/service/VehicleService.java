package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.dto.VehicleDtos.VehicleRequest;
import br.com.kjfleets.dto.VehicleDtos.VehicleResponse;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.VehicleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class VehicleService {

    private final VehicleRepository vehicles;

    private final DriverRepository drivers;

    public VehicleService(VehicleRepository vehicles, DriverRepository drivers) {
        this.vehicles = vehicles;
        this.drivers = drivers;
    }

    @Transactional
    public VehicleResponse create(VehicleRequest request) {
        String plate = normalizePlate(request.plate());
        ensurePlateFree(plate);
        Vehicle vehicle = new Vehicle();
        vehicle.setPlate(plate);
        vehicle.setType(request.type());
        return VehicleResponse.from(vehicles.save(vehicle), null);
    }

    @Transactional(readOnly = true)
    public PageResponse<VehicleResponse> list(Integer limit, Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        Page<Vehicle> page = vehicles.findByActiveTrueOrderByPlateAsc(pageable);
        Map<UUID, String> driverIds = drivers.findByVehicleInAndActiveTrue(page.getContent()).stream()
                .collect(Collectors.toMap(d -> d.getVehicle().getId(), Driver::getPublicId));
        return PageResponse.of(page, v -> VehicleResponse.from(v, driverIds.get(v.getId())),
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public VehicleResponse get(String publicId) {
        return toResponse(findActive(publicId));
    }

    @Transactional
    public VehicleResponse update(String publicId, VehicleRequest request) {
        Vehicle vehicle = findActive(publicId);
        if (request.status() == VehicleStatus.IN_USE) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "status: IN_USE é definido pelas rotas, não manualmente");
        }
        VehicleStatus status = request.status() == null ? vehicle.getStatus() : request.status();
        if (vehicle.getStatus() == VehicleStatus.IN_USE && status != VehicleStatus.IN_USE) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Veículo em uso não pode mudar de status");
        }
        String plate = normalizePlate(request.plate());
        if (!plate.equals(vehicle.getPlate())) {
            ensurePlateFree(plate);
            vehicle.setPlate(plate);
        }
        vehicle.setType(request.type());
        vehicle.setStatus(status);
        return toResponse(vehicle);
    }

    @Transactional
    public void delete(String publicId) {
        Vehicle vehicle = findActive(publicId);
        if (vehicle.getStatus() == VehicleStatus.IN_USE) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Veículo em uso não pode ser removido");
        }
        drivers.findByVehicleAndActiveTrue(vehicle).ifPresent(driver -> driver.setVehicle(null));
        vehicle.setActive(false);
    }

    public Vehicle findActive(String publicId) {
        return vehicles.findByPublicIdAndActiveTrue(publicId)
                .orElseThrow(() -> BusinessException.notFound("Veículo"));
    }

    private VehicleResponse toResponse(Vehicle vehicle) {
        String driverId = drivers.findByVehicleAndActiveTrue(vehicle).map(Driver::getPublicId).orElse(null);
        return VehicleResponse.from(vehicle, driverId);
    }

    private void ensurePlateFree(String plate) {
        if (vehicles.existsByPlate(plate)) {
            throw BusinessException.conflict("PLATE_TAKEN", "Placa já está em uso");
        }
    }

    private static String normalizePlate(String plate) {
        return plate.trim().toUpperCase();
    }
}
