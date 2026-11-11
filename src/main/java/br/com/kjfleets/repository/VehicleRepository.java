package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {

    Optional<Vehicle> findByPublicIdAndActiveTrue(String publicId);

    Page<Vehicle> findByActiveTrueOrderByPlateAsc(Pageable pageable);

    boolean existsByPlate(String plate);
}
