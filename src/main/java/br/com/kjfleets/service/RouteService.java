package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.RouteDtos.RouteRequest;
import br.com.kjfleets.dto.RouteDtos.RouteResponse;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.Payload;
import br.com.kjfleets.entity.Place;
import br.com.kjfleets.entity.Route;
import br.com.kjfleets.entity.RouteStop;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.repository.OrderRepository;
import br.com.kjfleets.repository.RouteRepository;
import br.com.kjfleets.routing.RouteAlgorithm;
import br.com.kjfleets.routing.RouteOptimizer;
import br.com.kjfleets.routing.RouteOptimizer.Plan;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class RouteService {

    private final RouteRepository routes;
    private final OrderRepository orders;
    private final DistanceService distance;

    public RouteService(RouteRepository routes, OrderRepository orders, DistanceService distance) {
        this.routes = routes;
        this.orders = orders;
        this.distance = distance;
    }

    // ponto da matriz: stop de origem (se já concluída) + dados para gravar a nova linha
    private record Point(StopType type, Place place, double lat, double lng, RouteStop visited) {

        static Point of(StopType type, Place place) {
            return new Point(type, place, place.getLat(), place.getLng(), null);
        }
    }

    // o chamador já segura a transação e a trava do pedido
    public Route compute(Order order, RouteAlgorithm algorithm, Long seed) {
        Payload payload = order.getPayload();
        Route previous = routes.findByOrder(order).orElse(null);
        List<RouteStop> visited = previous == null ? List.of() : previous.getStops().stream()
                .filter(s -> s.getVisitedAt() != null)
                .sorted(Comparator.comparing(RouteStop::getVisitedAt).thenComparingInt(RouteStop::getSeq))
                .toList();

        List<Place> pendingWaypoints = new ArrayList<>(payload.getWaypoints());
        boolean pickupPending = true;
        for (RouteStop stop : visited) {
            if (stop.getType() == StopType.PICKUP) {
                pickupPending = false;
            } else if (stop.getType() == StopType.WAYPOINT) {
                // um por concluída: o mesmo lugar pode aparecer mais de uma vez no payload
                for (int i = 0; i < pendingWaypoints.size(); i++) {
                    if (pendingWaypoints.get(i).getId().equals(stop.getPlace().getId())) {
                        pendingWaypoints.remove(i);
                        break;
                    }
                }
            }
        }

        // concluídas primeiro (perna original preservada); sem posição do motorista não entra START novo
        List<Point> points = new ArrayList<>();
        for (RouteStop stop : visited) {
            points.add(new Point(stop.getType(), stop.getPlace(), stop.getLat(), stop.getLng(), stop));
        }
        Driver driver = order.getDriver();
        if (driver != null && driver.getLat() != null && driver.getLng() != null) {
            points.add(new Point(StopType.START, null, driver.getLat(), driver.getLng(), null));
        }
        if (pickupPending) {
            points.add(Point.of(StopType.PICKUP, payload.getPickup()));
        }
        int fixedPrefix = points.size();
        pendingWaypoints.forEach(p -> points.add(Point.of(StopType.WAYPOINT, p)));
        points.add(Point.of(StopType.DROPOFF, payload.getDropoff()));

        double[][] km = distance.matrix(points.stream().map(p -> new double[]{p.lat(), p.lng()}).toList());
        int visitedCount = visited.size();
        double visitedKm = 0;
        for (int i = 0; i < visitedCount; i++) {
            visitedKm += visited.get(i).getLegKm();
        }
        double baselineKm = visitedKm;
        for (int i = Math.max(visitedCount, 1); i < points.size(); i++) {
            baselineKm += km[i - 1][i];
        }

        RouteAlgorithm chosen = algorithm != null ? algorithm : RouteOptimizer.defaultFor(pendingWaypoints.size());
        Plan plan;
        try {
            plan = RouteOptimizer.solve(km, fixedPrefix, chosen, seed);
        } catch (RouteOptimizer.TooLargeForExactException e) {
            throw new BusinessException("ROUTE_TOO_LARGE_FOR_EXACT", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Held-Karp aceita no máximo " + RouteOptimizer.HELD_KARP_MAX + " waypoints pendentes");
        }

        // apaga e dá flush antes: order_id é único e o insert novo viria antes do delete
        if (previous != null) {
            routes.delete(previous);
            routes.flush();
        }

        Route route = new Route();
        route.setOrder(order);
        route.setAlgorithm(chosen);
        route.setMode(distance.props().mode().name());
        double totalKm = visitedKm;
        for (int seq = Math.max(visitedCount, 1); seq < plan.order().size(); seq++) {
            totalKm += km[plan.order().get(seq - 1)][plan.order().get(seq)];
        }
        route.setTotalKm(totalKm);
        route.setBaselineKm(baselineKm);
        route.setSavingsPct(baselineKm == 0 ? 0 : round2((baselineKm - totalKm) / baselineKm * 100));
        route.setEtaMinutes(distance.etaMinutes(totalKm));
        route.setComputedAt(Instant.now());
        for (int seq = 0; seq < plan.order().size(); seq++) {
            Point point = points.get(plan.order().get(seq));
            RouteStop stop = new RouteStop();
            stop.setRoute(route);
            stop.setSeq(seq);
            stop.setType(point.type());
            stop.setPlace(point.place());
            stop.setLat(point.lat());
            stop.setLng(point.lng());
            if (point.visited() != null) {
                stop.setLegKm(point.visited().getLegKm());
                stop.setVisitedAt(point.visited().getVisitedAt());
                stop.setDistanceM(point.visited().getDistanceM());
                stop.setCompletedBy(point.visited().getCompletedBy());
            } else {
                stop.setLegKm(seq == 0 ? 0 : km[plan.order().get(seq - 1)][plan.order().get(seq)]);
            }
            route.getStops().add(stop);
        }
        return routes.save(route);
    }

    @Transactional
    public RouteResponse computeManual(String orderPublicId, RouteRequest request) {
        Order order = orders.lockByPublicId(orderPublicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
        if (order.getStatus().isTerminal()) {
            throw new BusinessException("ORDER_INVALID_TRANSITION", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Pedido em " + order.getStatus() + " não aceita esta ação");
        }
        Route route = compute(order, request.algorithm(), request.seed());
        return RouteResponse.from(route, route.getEtaMinutes());
    }

    @Transactional(readOnly = true)
    public RouteResponse get(String orderPublicId) {
        Order order = orders.findByPublicId(orderPublicId).orElseThrow(() -> BusinessException.notFound("Pedido"));
        Route route = routes.findByOrder(order).orElseThrow(() -> new BusinessException("ROUTE_NOT_FOUND",
                HttpStatus.NOT_FOUND, "Pedido sem rota calculada"));
        return RouteResponse.from(route, route.getEtaMinutes());
    }

    private static double round2(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
