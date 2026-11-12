package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Place;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import br.com.kjfleets.entity.OrderStatus;
import java.util.Collection;

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

    @Query("""
            select count(p) > 0 from Payload p
            where p.order.status not in :terminal
              and (p.pickup = :place or p.dropoff = :place or :place member of p.waypoints)""")
    boolean usedByOpenOrder(@Param("place") Place place, @Param("terminal") Collection<OrderStatus> terminal);
}
