package br.com.kjfleets.service;

import br.com.kjfleets.entity.DistanceSource;
import br.com.kjfleets.service.DistanceService.Distance;
import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.config.RoutingProperties.Mode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DistanceServiceTest {

    private final DistanceService haversine = new DistanceService(
            new RoutingProperties(Mode.HAVERSINE, 1.3, 40, 200, 300, null, null), Optional.empty());

    @Test
    void haversineTimesDetour() {
        assertEquals(360.75 * 1.3, haversine.km(-23.5505, -46.6333, -22.9068, -43.1729), 0.2);
    }

    @Test
    void roadModeWithoutRouterFallsBackMarked() {
        DistanceService road = new DistanceService(new RoutingProperties(Mode.ROAD, 1.3, 40, 200, 300, null, null),
                Optional.empty());

        Distance d = road.distance(-23.5505, -46.6333, -22.9068, -43.1729);

        assertEquals(DistanceSource.HAVERSINE, d.source());
        assertEquals(360.75 * 1.3, d.km(), 0.2);
    }

    @Test
    void straightMetersIgnoresDetour() {
        assertEquals(111195, haversine.straightMeters(0, 0, 1, 0), 50);
    }

    @Test
    void etaRounds() {
        assertEquals(30, haversine.etaMinutes(20));
        assertEquals(1, haversine.etaMinutes(0.4));
    }

    @Test
    void matrixIsSymmetricZeroDiagonal() {
        double[][] m = haversine.matrix(List.of(
                new double[]{-23.5505, -46.6333},
                new double[]{-22.9068, -43.1729},
                new double[]{-25.4284, -49.2733})).km();

        assertEquals(3, m.length);
        for (int i = 0; i < 3; i++) {
            assertEquals(0.0, m[i][i], 1e-9);
            for (int j = 0; j < 3; j++) {
                assertEquals(m[i][j], m[j][i], 1e-9);
            }
        }
    }
}
