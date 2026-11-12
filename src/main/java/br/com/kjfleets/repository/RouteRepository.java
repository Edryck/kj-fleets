package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.Route;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RouteRepository extends JpaRepository<Route, UUID> {

    Optional<Route> findByOrder(Order order);
}
