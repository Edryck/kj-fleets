package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.dto.VehicleDtos.VehicleRequest;
import br.com.kjfleets.dto.VehicleDtos.VehicleResponse;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.StatusSubject;
import br.com.kjfleets.entity.Vehicle;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.VehicleRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class VehicleService {

    private final VehicleRepository vehicles;

    private final DriverRepository drivers;

    private final OrderService orderService;

    private final StatusHistoryService history;

    public VehicleService(VehicleRepository vehicles, DriverRepository drivers, OrderService orderService,
                          StatusHistoryService history) {
        this.history = history;
        this.vehicles = vehicles;
        this.drivers = drivers;
        this.orderService = orderService;
    }

    @Transactional
    public VehicleResponse create(VehicleRequest request) {
        ensureYearInRange(request.year());
        String plate = normalizePlate(request.plate());
        ensurePlateFree(plate);
        Vehicle vehicle = new Vehicle();
        vehicle.setPlate(plate);
        vehicle.setType(request.type());
        applyIdentity(vehicle, request);
        vehicles.save(vehicle);
        history.record(StatusSubject.VEHICLE, vehicle.getId(), null, vehicle.getStatus().name(), "baseline");
        return VehicleResponse.from(vehicle, null, null);
    }

    @Transactional(readOnly = true)
    public PageResponse<VehicleResponse> list(String q, VehicleStatus status, boolean includeInactive,
                                              Integer limit, Integer offset, Authentication auth) {
        Search.requireWriterForInactive(includeInactive, auth, "ADMIN", "FLEET_MANAGER");
        Pageable pageable = PageResponse.pageable(limit, offset);
        String pattern = Search.pattern(q);
        Specification<Vehicle> matching = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (!includeInactive) {
                predicates.add(cb.isTrue(root.get("active")));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (pattern != null) {
                predicates.add(cb.or(cb.like(cb.lower(root.get("plate")), pattern, '\\'),
                        cb.like(cb.lower(root.get("type")), pattern, '\\'),
                        cb.like(cb.lower(root.get("brand")), pattern, '\\'),
                        cb.like(cb.lower(root.get("model")), pattern, '\\'),
                        cb.like(cb.lower(cb.concat(cb.concat(cb.coalesce(root.get("brand"), ""), " "),
                                cb.coalesce(root.get("model"), ""))), pattern, '\\')));
            }
            // count não aceita ORDER BY sem GROUP BY no Postgres
            if (query.getResultType() != Long.class) {
                query.orderBy(cb.asc(root.get("plate")), cb.asc(root.get("publicId")));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Page<Vehicle> page = vehicles.findAll(matching, pageable);
        Map<UUID, Driver> byVehicle = drivers.findByVehicleInAndActiveTrue(page.getContent()).stream()
                .collect(Collectors.toMap(d -> d.getVehicle().getId(), Function.identity()));
        return PageResponse.of(page, v -> toResponse(v, byVehicle.get(v.getId())),
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public VehicleResponse get(String publicId) {
        return toResponse(findActive(publicId));
    }

    @Transactional
    public VehicleResponse update(String publicId, VehicleRequest request) {
        Vehicle vehicle = findActive(publicId);
        ensureYearInRange(request.year());
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
        applyIdentity(vehicle, request);
        VehicleStatus previous = vehicle.getStatus();
        vehicle.setStatus(status);
        history.record(StatusSubject.VEHICLE, vehicle.getId(), previous.name(), status.name(), "manual");
        return toResponse(vehicle);
    }

    // a placa é única na tabela inteira (inclusive de inativos); o check é só rede de segurança
    @Transactional
    public VehicleResponse reactivate(String publicId) {
        Vehicle vehicle = vehicles.lockByPublicId(publicId).orElseThrow(() -> BusinessException.notFound("Veículo"));
        if (!vehicle.isActive()) {
            if (vehicles.existsByPlateAndActiveTrueAndIdNot(vehicle.getPlate(), vehicle.getId())) {
                throw BusinessException.conflict("PLATE_TAKEN", "Placa já está em uso");
            }
            vehicle.setActive(true);
            String status = vehicle.getStatus().name();
            history.record(StatusSubject.VEHICLE, vehicle.getId(), status, status, "reactivate", true);
        }
        return toResponse(vehicle);
    }

    @Transactional
    public void delete(String publicId) {
        Vehicle vehicle = findActive(publicId);
        if (vehicle.getStatus() == VehicleStatus.IN_USE) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Veículo em uso não pode ser removido");
        }
        orderService.releaseVehicle(vehicle);
        drivers.findByVehicleAndActiveTrue(vehicle).ifPresent(driver -> driver.setVehicle(null));
        vehicle.setActive(false);
        String status = vehicle.getStatus().name();
        history.record(StatusSubject.VEHICLE, vehicle.getId(), status, status, "delete", true);
    }

    public Vehicle findActive(String publicId) {
        return vehicles.findByPublicIdAndActiveTrue(publicId)
                .orElseThrow(() -> BusinessException.notFound("Veículo"));
    }

    private VehicleResponse toResponse(Vehicle vehicle) {
        return toResponse(vehicle, drivers.findByVehicleAndActiveTrue(vehicle).orElse(null));
    }

    private VehicleResponse toResponse(Vehicle vehicle, Driver driver) {
        return VehicleResponse.from(vehicle, driver == null ? null : driver.getPublicId(),
                driver == null ? null : driver.getName());
    }

    private void ensurePlateFree(String plate) {
        if (vehicles.existsByPlate(plate)) {
            throw BusinessException.conflict("PLATE_TAKEN", "Placa já está em uso");
        }
    }

    private static void applyIdentity(Vehicle vehicle, VehicleRequest request) {
        vehicle.setBrand(trimToNull(request.brand()));
        vehicle.setModel(trimToNull(request.model()));
        vehicle.setModelYear(request.year());
        vehicle.setColor(trimToNull(request.color()));
        vehicle.setCapacityKg(request.capacityKg());
        vehicle.setVolumeM3(request.volumeM3());
        vehicle.setOdometerKm(request.odometerKm());
    }

    private static void ensureYearInRange(Integer year) {
        if (year != null && year > Year.now().getValue() + 1) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "year: não pode passar do ano que vem");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizePlate(String plate) {
        return plate.trim().toUpperCase();
    }
}
