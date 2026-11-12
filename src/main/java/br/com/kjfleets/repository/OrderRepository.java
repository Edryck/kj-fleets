package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.lang.Nullable;

import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {

    Optional<Order> findByPublicId(String publicId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.publicId = :publicId")
    Optional<Order> lockByPublicId(String publicId);

    Optional<Order> findByTrackingNumber(String trackingNumber);

    boolean existsByDriverAndStatusIn(Driver driver, Collection<OrderStatus> statuses);

    boolean existsByVehicleAndStatusIn(Vehicle vehicle, Collection<OrderStatus> statuses);

    @Override
    @EntityGraph(attributePaths = {"payload.pickup", "payload.dropoff", "driver", "vehicle", "customer"})
    Page<Order> findAll(@Nullable Specification<Order> spec, Pageable pageable);
}
