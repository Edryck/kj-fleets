package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Place;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlaceRepository extends JpaRepository<Place, UUID> {

    @EntityGraph(attributePaths = {"contact"})
    Optional<Place> findByPublicIdAndActiveTrue(String publicId);

    @EntityGraph(attributePaths = {"contact"})
    Page<Place> findByActiveTrueOrderByNameAscPublicIdAsc(Pageable pageable);
}
