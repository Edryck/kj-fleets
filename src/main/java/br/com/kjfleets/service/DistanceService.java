package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.config.RoutingProperties.Mode;
import br.com.kjfleets.routing.Haversine;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DistanceService {

    private final RoutingProperties props;

    public DistanceService(RoutingProperties props) {
        this.props = props;
    }

    public double km(double lat1, double lng1, double lat2, double lng2) {
        if (props.mode() == Mode.ROAD) {
            throw new BusinessException("GRAPH_NOT_LOADED", HttpStatus.UNPROCESSABLE_ENTITY,
                    "Modo road exige o grafo de vias, que ainda não está carregado");
        }
        return Haversine.km(lat1, lng1, lat2, lng2) * props.detourFactor();
    }

    public double[][] matrix(List<double[]> points) {
        int n = points.size();
        double[][] m = new double[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                double[] a = points.get(i);
                double[] b = points.get(j);
                m[i][j] = m[j][i] = km(a[0], a[1], b[0], b[1]);
            }
        }
        return m;
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
