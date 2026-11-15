package br.com.kjfleets.controller;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.entity.DistanceSource;
import br.com.kjfleets.service.DistanceService;
import br.com.kjfleets.service.RoadRouter;
import br.com.kjfleets.service.RoadRouter.GraphStatus;
import br.com.kjfleets.service.RoadRouter.RoadPath;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@RestController
public class GraphController {

    public record GraphStatusResponse(String mode, boolean loaded, String region, String osmFile, long nodes,
                                      long edges, Instant importedAt, long loadMillis, String reason) {
    }

    public record GraphRouteResponse(double km, List<double[]> path, DistanceSource distanceSource, long ms) {
    }

    private final Optional<RoadRouter> router;
    private final DistanceService distance;
    private final RoutingProperties props;

    public GraphController(Optional<RoadRouter> router, DistanceService distance, RoutingProperties props) {
        this.router = router;
        this.distance = distance;
        this.props = props;
    }

    @GetMapping("/graph/status")
    GraphStatusResponse status() {
        String mode = props.mode().name();
        if (router.isEmpty()) {
            return new GraphStatusResponse(mode, false, null, null, 0, 0, null, 0, "modo haversine");
        }
        GraphStatus s = router.get().status();
        return new GraphStatusResponse(mode, s.loaded(), "Sul do Brasil", s.osmFile(), s.nodes(), s.edges(),
                s.importedAt(), s.loadMillis(), s.reason());
    }

    @GetMapping("/graph/route")
    GraphRouteResponse route(@RequestParam @DecimalMin("-90") @DecimalMax("90") double fromLat,
                             @RequestParam @DecimalMin("-180") @DecimalMax("180") double fromLng,
                             @RequestParam @DecimalMin("-90") @DecimalMax("90") double toLat,
                             @RequestParam @DecimalMin("-180") @DecimalMax("180") double toLng) {
        if (router.isEmpty() || !router.get().status().loaded()) {
            throw new BusinessException("GRAPH_NOT_LOADED", HttpStatus.UNPROCESSABLE_ENTITY,
                    "O grafo de vias não está carregado");
        }
        long started = System.nanoTime();
        Optional<RoadPath> path = distance.roadPath(fromLat, fromLng, toLat, toLng);
        long ms = (System.nanoTime() - started) / 1_000_000;
        if (path.isPresent()) {
            return new GraphRouteResponse(path.get().meters() / 1000, path.get().points(), DistanceSource.ROAD, ms);
        }
        return new GraphRouteResponse(distance.straightKm(fromLat, fromLng, toLat, toLng),
                List.of(new double[]{fromLat, fromLng}, new double[]{toLat, toLng}), DistanceSource.HAVERSINE, ms);
    }
}
