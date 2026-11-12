package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DriverRepository extends JpaRepository<Driver, UUID> {

    @EntityGraph(attributePaths = {"user", "vehicle"})
    Optional<Driver> findByPublicIdAndActiveTrue(String publicId);

    @EntityGraph(attributePaths = {"user", "vehicle"})
    Page<Driver> findByActiveTrueOrderByNameAsc(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Driver d where d.publicId = :publicId")
    Optional<Driver> lockByPublicId(String publicId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Driver d where d.id = :id")
    Optional<Driver> lockById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Driver d where d.user.username = :username and d.active = true")
    Optional<Driver> lockByUsername(String username);

    Optional<Driver> findByUserUsernameAndActiveTrue(String username);

    Optional<Driver> findByVehicleAndActiveTrue(Vehicle vehicle);

    List<Driver> findByVehicleInAndActiveTrue(Collection<Vehicle> vehicles);

    List<Driver> findByActiveTrueAndStatusAndLatNotNullAndLngNotNull(DriverStatus status);

    // quem só tem pedido CREATED na fila continua candidato
    @EntityGraph(attributePaths = {"vehicle"})
    @Query("""
            select d from Driver d
            where d.active = true and d.status = br.com.kjfleets.entity.DriverStatus.AVAILABLE
              and d.lat is not null and d.lng is not null and d.lastSeenAt >= :freshSince
              and d.vehicle is not null and d.vehicle.active = true
              and d.vehicle.status <> br.com.kjfleets.entity.VehicleStatus.MAINTENANCE
              and not exists (select 1 from Order o where o.driver = d and o.status in :activeStatuses)
            order by d.publicId
            """)
    List<Driver> findDispatchCandidates(Instant freshSince, Collection<OrderStatus> activeStatuses);
}
