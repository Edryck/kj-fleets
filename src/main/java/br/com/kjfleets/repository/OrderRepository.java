package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    Optional<Order> findByPublicId(String publicId);

    Optional<Order> findByTrackingNumber(String trackingNumber);
}
