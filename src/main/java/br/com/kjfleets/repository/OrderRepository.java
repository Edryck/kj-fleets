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
import java.util.List;
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

    // trava as linhas (por id, ordem fixa) e o Postgres reavalia o status depois de esperar o lock
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.driver = :driver and o.status = :status order by o.id")
    List<Order> findByDriverAndStatus(Driver driver, OrderStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.vehicle = :vehicle and o.status = :status order by o.id")
    List<Order> findByVehicleAndStatus(Vehicle vehicle, OrderStatus status);

    @Override
    @EntityGraph(attributePaths = {"payload.pickup", "payload.dropoff", "driver", "vehicle", "customer"})
    Page<Order> findAll(@Nullable Specification<Order> spec, Pageable pageable);

    // ativos primeiro, depois CREATED, terminais por último; dentro de cada grupo, o mais antigo antes
    @EntityGraph(attributePaths = {"payload.pickup", "payload.dropoff", "driver", "vehicle", "customer"})
    @Query(value = """
            select o from Order o
            where o.driver.user.username = :username
              and (:status is null or o.status = :status)
            order by case when o.status = br.com.kjfleets.entity.OrderStatus.CREATED then 1
                          when o.status in (br.com.kjfleets.entity.OrderStatus.DISPATCHED,
                                            br.com.kjfleets.entity.OrderStatus.DRIVER_ENROUTE,
                                            br.com.kjfleets.entity.OrderStatus.ARRIVED,
                                            br.com.kjfleets.entity.OrderStatus.IN_PROGRESS) then 0
                          else 2 end,
                     o.createdAt asc, o.publicId asc
            """, countQuery = """
            select count(o) from Order o
            where o.driver.user.username = :username
              and (:status is null or o.status = :status)
            """)
    Page<Order> findDriverOrders(String username, OrderStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"payload.pickup", "payload.dropoff"})
    @Query(value = """
            select o from Order o
            where o.status = br.com.kjfleets.entity.OrderStatus.CREATED and o.driver is null
            order by o.createdAt asc, o.publicId asc
            """, countQuery = """
            select count(o) from Order o
            where o.status = br.com.kjfleets.entity.OrderStatus.CREATED and o.driver is null
            """)
    Page<Order> findAvailable(Pageable pageable);

    @EntityGraph(attributePaths = {"payload.pickup"})
    List<Order> findByStatusAndDriverIsNullOrderByPublicIdAsc(OrderStatus status);

    @EntityGraph(attributePaths = {"payload.pickup"})
    List<Order> findByPublicIdIn(Collection<String> publicIds);
}
