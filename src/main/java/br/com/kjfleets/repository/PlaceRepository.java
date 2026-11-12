package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Place;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlaceRepository extends JpaRepository<Place, UUID>, JpaSpecificationExecutor<Place> {

    @Override
    @EntityGraph(attributePaths = {"contact"})
    Page<Place> findAll(Specification<Place> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"contact"})
    Optional<Place> findByPublicId(String publicId);


    @EntityGraph(attributePaths = {"contact"})
    Optional<Place> findByPublicIdAndActiveTrue(String publicId);
}
