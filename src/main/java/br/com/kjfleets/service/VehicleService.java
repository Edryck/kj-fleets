package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.dto.VehicleDtos.VehicleRequest;
import br.com.kjfleets.dto.VehicleDtos.VehicleResponse;
import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.repository.VehicleRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VehicleService {

    private final VehicleRepository vehicles;

    public VehicleService(VehicleRepository vehicles) {
        this.vehicles = vehicles;
    }

    @Transactional
    public VehicleResponse create(VehicleRequest request) {
        String plate = normalizePlate(request.plate());
        ensurePlateFree(plate);
        Vehicle vehicle = new Vehicle();
        vehicle.setPlate(plate);
        vehicle.setType(request.type());
        return VehicleResponse.from(vehicles.save(vehicle));
    }

    @Transactional(readOnly = true)
    public PageResponse<VehicleResponse> list(Integer limit, Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        return PageResponse.of(vehicles.findByActiveTrueOrderByPlateAsc(pageable), VehicleResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public VehicleResponse get(String publicId) {
        return VehicleResponse.from(findActive(publicId));
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
        return VehicleResponse.from(vehicle);
    }

    @Transactional
    public void delete(String publicId) {
        Vehicle vehicle = findActive(publicId);
        if (vehicle.getStatus() == VehicleStatus.IN_USE) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Veículo em uso não pode ser removido");
        }
        vehicle.setActive(false);
    }

    public Vehicle findActive(String publicId) {
        return vehicles.findByPublicIdAndActiveTrue(publicId)
                .orElseThrow(() -> BusinessException.notFound("Veículo"));
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
