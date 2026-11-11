package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.lang.Nullable;

import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {

    Optional<Order> findByPublicId(String publicId);

    Optional<Order> findByTrackingNumber(String trackingNumber);

    @Override
    @EntityGraph(attributePaths = {"payload.pickup", "payload.dropoff", "driver", "vehicle", "customer"})
    Page<Order> findAll(@Nullable Specification<Order> spec, Pageable pageable);
}
