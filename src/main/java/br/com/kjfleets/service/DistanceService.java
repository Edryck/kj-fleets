package br.com.kjfleets.service;

import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.config.RoutingProperties.Mode;
import br.com.kjfleets.entity.DistanceSource;
import br.com.kjfleets.routing.Haversine;
import br.com.kjfleets.service.RoadRouter.RoadPath;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class DistanceService {

    public record Distance(double km, DistanceSource source) {
    }

    // fallback[i][j] = par medido em linha reta × desvio (modo haversine ou sem caminho nas ruas)
    public record DistanceMatrix(double[][] km, boolean[][] fallback) {
    }

    private final RoutingProperties props;
    private final Optional<RoadRouter> road;

    public DistanceService(RoutingProperties props, Optional<RoadRouter> road) {
        this.props = props;
        this.road = props.mode() == Mode.ROAD ? road : Optional.empty();
    }

    public Distance distance(double lat1, double lng1, double lat2, double lng2) {
        Optional<RoadPath> path = roadPath(lat1, lng1, lat2, lng2);
        if (path.isPresent()) {
            return new Distance(path.get().meters() / 1000, DistanceSource.ROAD);
        }
        return new Distance(straightKm(lat1, lng1, lat2, lng2), DistanceSource.HAVERSINE);
    }

    public double km(double lat1, double lng1, double lat2, double lng2) {
        return distance(lat1, lng1, lat2, lng2).km();
    }

    public Optional<RoadPath> roadPath(double lat1, double lng1, double lat2, double lng2) {
        return road.flatMap(r -> r.route(lat1, lng1, lat2, lng2));
    }

    // simétrica de propósito (i<j espelhado): os otimizadores assumem isso e corta as chamadas pela metade
    public DistanceMatrix matrix(List<double[]> points) {
        int n = points.size();
        double[][] km = new double[n][n];
        boolean[][] fallback = new boolean[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                double[] a = points.get(i);
                double[] b = points.get(j);
                Distance d = distance(a[0], a[1], b[0], b[1]);
                km[i][j] = km[j][i] = d.km();
                fallback[i][j] = fallback[j][i] = d.source() == DistanceSource.HAVERSINE;
            }
        }
        return new DistanceMatrix(km, fallback);
    }

    public double straightKm(double lat1, double lng1, double lat2, double lng2) {
        return Haversine.km(lat1, lng1, lat2, lng2) * props.detourFactor();
    }

    public int etaMinutes(double km) {
        return (int) Math.round(km / props.avgSpeedKmh() * 60);
    }

    public double straightMeters(double lat1, double lng1, double lat2, double lng2) {
        return Haversine.km(lat1, lng1, lat2, lng2) * 1000;
    }

    public RoutingProperties props() {
        return props;
    }
}
