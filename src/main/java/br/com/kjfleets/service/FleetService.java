package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.FleetDtos.FleetDetailResponse;
import br.com.kjfleets.dto.FleetDtos.FleetRequest;
import br.com.kjfleets.dto.FleetDtos.FleetResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Fleet;
import br.com.kjfleets.repository.FleetRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FleetService {

    private final FleetRepository fleets;
    private final DriverService drivers;

    public FleetService(FleetRepository fleets, DriverService drivers) {
        this.fleets = fleets;
        this.drivers = drivers;
    }

    @Transactional
    public FleetDetailResponse create(FleetRequest request) {
        Fleet fleet = new Fleet();
        fleet.setName(request.name());
        fleet.setDrivers(resolveDrivers(request.driverIds()));
        return FleetDetailResponse.from(fleets.save(fleet));
    }

    @Transactional(readOnly = true)
    public PageResponse<FleetResponse> list(Integer limit, Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        return PageResponse.of(fleets.findByActiveTrueOrderByNameAsc(pageable), FleetResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public FleetDetailResponse get(String publicId) {
        return FleetDetailResponse.from(findActive(publicId));
    }

    @Transactional
    public FleetDetailResponse update(String publicId, FleetRequest request) {
        Fleet fleet = findActive(publicId);
        fleet.setName(request.name());
        fleet.setDrivers(resolveDrivers(request.driverIds()));
        return FleetDetailResponse.from(fleet);
    }

    @Transactional
    public void delete(String publicId) {
        Fleet fleet = findActive(publicId);
        fleet.getDrivers().clear();
        fleet.setActive(false);
    }

    private Fleet findActive(String publicId) {
        return fleets.findByPublicIdAndActiveTrue(publicId)
                .orElseThrow(() -> BusinessException.notFound("Frota"));
    }

    private Set<Driver> resolveDrivers(List<String> driverIds) {
        if (driverIds == null) {
            return new HashSet<>();
        }
        return driverIds.stream()
                .map(drivers::findActive)
                .collect(Collectors.toSet());
    }
}
