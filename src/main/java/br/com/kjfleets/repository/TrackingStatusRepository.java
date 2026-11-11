package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.TrackingStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TrackingStatusRepository extends JpaRepository<TrackingStatus, UUID> {

    List<TrackingStatus> findByOrderOrderByCreatedAtAscIdAsc(Order order);
}
