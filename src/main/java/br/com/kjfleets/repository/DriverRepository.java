package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DriverRepository extends JpaRepository<Driver, UUID> {

    @EntityGraph(attributePaths = {"user", "vehicle"})
    Optional<Driver> findByPublicIdAndActiveTrue(String publicId);

    @EntityGraph(attributePaths = {"user", "vehicle"})
    Page<Driver> findByActiveTrueOrderByNameAsc(Pageable pageable);

    Optional<Driver> findByUserUsernameAndActiveTrue(String username);

    Optional<Driver> findByVehicleAndActiveTrue(Vehicle vehicle);

    List<Driver> findByVehicleInAndActiveTrue(Collection<Vehicle> vehicles);

    List<Driver> findByActiveTrueAndStatusAndLatNotNullAndLngNotNull(DriverStatus status);
}
