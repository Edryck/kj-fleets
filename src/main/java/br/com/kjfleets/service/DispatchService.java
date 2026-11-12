package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.DispatchDtos.PlanRequest;
import br.com.kjfleets.dto.DispatchDtos.PlanResponse;
import br.com.kjfleets.dto.DispatchDtos.PlannedAssignment;
import br.com.kjfleets.dto.OrderDtos.AssignRequest;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Place;
import br.com.kjfleets.repository.DriverRepository;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.VehicleRepository;
import br.com.kjfleets.routing.AssignmentAlgorithm;
import br.com.kjfleets.routing.AssignmentSolver;
import br.com.kjfleets.routing.AssignmentSolver.Assignment;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DispatchService {

    private static final List<OrderStatus> ACTIVE = Arrays.stream(OrderStatus.values())
            .filter(OrderStatus::isActive).toList();

    private final OrderRepository orders;
    private final DriverRepository drivers;
    private final DistanceService distance;
    private final VehicleRepository vehicles;
    private final OrderService orderService;
    private final EntityManager em;

    public DispatchService(OrderRepository orders, DriverRepository drivers, DistanceService distance,
                           VehicleRepository vehicles, OrderService orderService, EntityManager em) {
        this.orders = orders;
        this.drivers = drivers;
        this.distance = distance;
        this.vehicles = vehicles;
        this.orderService = orderService;
        this.em = em;
    }

    @Transactional
    public PlanResponse plan(PlanRequest request) {
        List<Order> candidateOrders = candidateOrders(request.orderIds());
        Instant freshSince = Instant.now().minusSeconds(distance.props().positionMaxAgeS());
        List<Driver> candidateDrivers = drivers.findDispatchCandidates(freshSince, ACTIVE);

        double[][] cost = new double[candidateDrivers.size()][candidateOrders.size()];
        for (int d = 0; d < cost.length; d++) {
            Driver driver = candidateDrivers.get(d);
            for (int o = 0; o < candidateOrders.size(); o++) {
                Place pickup = candidateOrders.get(o).getPayload().getPickup();
                cost[d][o] = distance.km(driver.getLat(), driver.getLng(), pickup.getLat(), pickup.getLng());
            }
        }

        Map<AssignmentAlgorithm, Double> comparison = new EnumMap<>(AssignmentAlgorithm.class);
        Assignment chosen = null;
        for (AssignmentAlgorithm algorithm : AssignmentAlgorithm.values()) {
            Assignment solved = AssignmentSolver.solve(cost, algorithm);
            comparison.put(algorithm, round2(solved.totalCost()));
            if (algorithm == request.algorithm()) {
                chosen = solved;
            }
        }

        List<PlannedAssignment> assignments = new ArrayList<>();
        HashSet<Integer> assignedOrders = new HashSet<>();
        for (int d = 0; d < cost.length; d++) {
            int o = chosen.taskOfWorker()[d];
            if (o >= 0) {
                Driver driver = candidateDrivers.get(d);
                assignedOrders.add(o);
                assignments.add(new PlannedAssignment(candidateOrders.get(o).getPublicId(), driver.getPublicId(),
                        driver.getVehicle().getPublicId(), round2(cost[d][o])));
            }
        }
        assignments.sort(Comparator.comparing(PlannedAssignment::orderId));
        List<String> unassigned = new ArrayList<>();
        for (int o = 0; o < candidateOrders.size(); o++) {
            if (!assignedOrders.contains(o)) {
                unassigned.add(candidateOrders.get(o).getPublicId());
            }
        }

        if (request.apply()) {
            // trava tudo antes (pedidos, motoristas, veículos, cada grupo em ordem fixa) para dois planos
            // não se cruzarem; o clear faz o assign reler as linhas já com as travas
            em.clear();
            for (PlannedAssignment pair : assignments) {
                orders.lockByPublicId(pair.orderId()).orElseThrow(() -> BusinessException.notFound("Pedido"));
            }
            List<UUID> vehicleIds = new ArrayList<>();
            assignments.stream().map(PlannedAssignment::driverId).sorted().forEach(id -> {
                Driver driver = drivers.lockByPublicId(id)
                        .orElseThrow(() -> BusinessException.notFound("Motorista"));
                if (driver.getVehicle() != null) {
                    vehicleIds.add(driver.getVehicle().getId());
                }
            });
            vehicleIds.stream().sorted().forEach(vehicles::lockById);
            for (PlannedAssignment pair : assignments) {
                orderService.assign(pair.orderId(), new AssignRequest(pair.driverId(), null), true);
            }
        }
        return new PlanResponse(request.algorithm(), request.apply(), assignments, unassigned,
                round2(chosen.totalCost()), comparison);
    }

    private List<Order> candidateOrders(List<String> orderIds) {
        if (orderIds == null) {
            return orders.findByStatusAndDriverIsNullOrderByPublicIdAsc(OrderStatus.CREATED);
        }
        List<String> ids = orderIds.stream().distinct().toList();
        List<Order> found = orders.findByPublicIdIn(ids);
        if (found.size() != ids.size()) {
            throw BusinessException.notFound("Pedido");
        }
        for (Order order : found) {
            if (order.getStatus() != OrderStatus.CREATED || order.getDriver() != null) {
                throw new BusinessException("ORDER_INVALID_TRANSITION", HttpStatus.UNPROCESSABLE_ENTITY,
                        "Pedido " + order.getPublicId() + " não está aguardando motorista");
            }
        }
        return found.stream().sorted(Comparator.comparing(Order::getPublicId)).toList();
    }

    private static double round2(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
