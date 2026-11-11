package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Fleet;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FleetRepository extends JpaRepository<Fleet, UUID> {

    @EntityGraph(attributePaths = {"drivers", "drivers.user", "drivers.vehicle"})
    Optional<Fleet> findByPublicIdAndActiveTrue(String publicId);

    Page<Fleet> findByActiveTrueOrderByNameAsc(Pageable pageable);
}
