package br.com.kjfleets.routing;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RouteOptimizerTest {

    // 200 instancias de ate 30 pontos com 20000 iteracoes de SA ainda roda em poucos segundos
    private static final int INSTANCES = 200;

    private static double[][] randomMatrix(Random random, int n) {
        double[][] pts = new double[n][2];
        for (double[] p : pts) {
            p[0] = random.nextDouble() * 2 - 1;
            p[1] = random.nextDouble() * 2 - 1;
        }
        return matrixOf(pts);
    }

    private static double[][] matrixOf(double[][] pts) {
        int n = pts.length;
        double[][] km = new double[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                km[i][j] = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
            }
        }
        return km;
    }

    private static void assertValid(RouteOptimizer.Plan plan, int n) {
        List<Integer> order = plan.order();
        assertEquals(n, order.size());
        assertEquals(0, order.get(0));
        assertEquals(n - 1, order.get(n - 1));
        assertEquals(n, order.stream().distinct().count());
        assertFalse(Double.isNaN(plan.totalKm()));
    }

    private static double bruteForce(double[][] km, int fixedPrefix) {
        int n = km.length;
        List<Integer> inner = new ArrayList<>();
        for (int i = fixedPrefix; i < n - 1; i++) {
            inner.add(i);
        }
        return permute(km, fixedPrefix, inner, 0);
    }

    private static double permute(double[][] km, int fixedPrefix, List<Integer> inner, int k) {
        if (k == inner.size()) {
            List<Integer> path = new ArrayList<>();
            for (int i = 0; i < fixedPrefix; i++) {
                path.add(i);
            }
            path.addAll(inner);
            path.add(km.length - 1);
            return RouteOptimizer.pathKm(km, path);
        }
        double best = Double.MAX_VALUE;
        for (int i = k; i < inner.size(); i++) {
            Collections.swap(inner, k, i);
            best = Math.min(best, permute(km, fixedPrefix, inner, k + 1));
            Collections.swap(inner, k, i);
        }
        return best;
    }

    @Test
    void heldKarpMatchesBruteForce() {
        Random random = new Random(7);
        for (int i = 0; i < INSTANCES; i++) {
            int n = 3 + random.nextInt(8);
            double[][] km = randomMatrix(random, n);
            RouteOptimizer.Plan plan = RouteOptimizer.solve(km, 1, RouteAlgorithm.HELD_KARP, null);
            assertValid(plan, n);
            assertEquals(bruteForce(km, 1), plan.totalKm(), 1e-9);
            assertEquals(RouteOptimizer.pathKm(km, plan.order()), plan.totalKm(), 1e-9);
        }
    }

    @Test
    void heldKarpMatchesBruteForceWithPrefix() {
        Random random = new Random(11);
        for (int prefix = 2; prefix <= 3; prefix++) {
            for (int i = 0; i < 50; i++) {
                int n = prefix + 2 + random.nextInt(7);
                double[][] km = randomMatrix(random, n);
                RouteOptimizer.Plan plan = RouteOptimizer.solve(km, prefix, RouteAlgorithm.HELD_KARP, null);
                assertValid(plan, n);
                assertEquals(bruteForce(km, prefix), plan.totalKm(), 1e-9);
            }
        }
    }

    @Test
    void nothingToReorder() {
        double[][] km = randomMatrix(new Random(12), 4);
        for (RouteAlgorithm algorithm : RouteAlgorithm.values()) {
            assertEquals(List.of(0, 1, 2, 3), RouteOptimizer.solve(km, 3, algorithm, 1L).order());
        }
    }

    @Test
    void twoOptNeverWorseThanNearest() {
        Random random = new Random(1);
        for (int i = 0; i < INSTANCES; i++) {
            double[][] km = randomMatrix(random, 3 + random.nextInt(30));
            double nn = RouteOptimizer.solve(km, 1, RouteAlgorithm.NEAREST_NEIGHBOR, null).totalKm();
            double two = RouteOptimizer.solve(km, 1, RouteAlgorithm.TWO_OPT, null).totalKm();
            assertTrue(two <= nn + 1e-9);
        }
    }

    @Test
    void annealingNeverWorseThanNearest() {
        Random random = new Random(1);
        for (int i = 0; i < INSTANCES; i++) {
            double[][] km = randomMatrix(random, 3 + random.nextInt(30));
            double nn = RouteOptimizer.solve(km, 1, RouteAlgorithm.NEAREST_NEIGHBOR, null).totalKm();
            RouteOptimizer.Plan sa = RouteOptimizer.solve(km, 1, RouteAlgorithm.SIMULATED_ANNEALING, 42L);
            assertTrue(sa.totalKm() <= nn + 1e-9);
            assertEquals(RouteOptimizer.pathKm(km, sa.order()), sa.totalKm(), 1e-9);
        }
    }

    @Test
    void annealingIsReproducible() {
        double[][] km = randomMatrix(new Random(3), 20);
        RouteOptimizer.Plan a = RouteOptimizer.solve(km, 1, RouteAlgorithm.SIMULATED_ANNEALING, 99L);
        RouteOptimizer.Plan b = RouteOptimizer.solve(km, 1, RouteAlgorithm.SIMULATED_ANNEALING, 99L);
        assertEquals(a.order(), b.order());
    }

    @Test
    void endpointsAreFixed() {
        Random random = new Random(5);
        for (RouteAlgorithm algorithm : RouteAlgorithm.values()) {
            for (int n = 2; n <= 12; n++) {
                assertValid(RouteOptimizer.solve(randomMatrix(random, n), 1, algorithm, 1L), n);
            }
        }
    }

    @Test
    void fixedPrefixIsKept() {
        Random random = new Random(6);
        for (RouteAlgorithm algorithm : RouteAlgorithm.values()) {
            for (int n = 4; n <= 12; n++) {
                RouteOptimizer.Plan plan = RouteOptimizer.solve(randomMatrix(random, n), 3, algorithm, 1L);
                assertValid(plan, n);
                assertEquals(List.of(0, 1, 2), plan.order().subList(0, 3));
            }
        }
    }

    @Test
    void heldKarpRejectsSixteen() {
        double[][] km = randomMatrix(new Random(8), 18);
        assertThrows(RouteOptimizer.TooLargeForExactException.class,
                () -> RouteOptimizer.solve(km, 1, RouteAlgorithm.HELD_KARP, null));
        // 15 ainda passa
        assertValid(RouteOptimizer.solve(randomMatrix(new Random(9), 17), 1, RouteAlgorithm.HELD_KARP, null), 17);
    }

    @Test
    void defaultAlgorithm() {
        assertEquals(RouteAlgorithm.HELD_KARP, RouteOptimizer.defaultFor(15));
        assertEquals(RouteAlgorithm.TWO_OPT, RouteOptimizer.defaultFor(16));
    }

    @Test
    void degenerateInputs() {
        double[][] zeros = new double[6][6];
        double[][] dup = matrixOf(new double[][] {{0, 0}, {1, 1}, {1, 1}, {0, 0}, {1, 1}, {0, 0}});
        for (RouteAlgorithm algorithm : RouteAlgorithm.values()) {
            RouteOptimizer.Plan z = RouteOptimizer.solve(zeros, 1, algorithm, 1L);
            assertValid(z, 6);
            assertEquals(0.0, z.totalKm(), 0.0);
            assertValid(RouteOptimizer.solve(dup, 1, algorithm, 1L), 6);
        }
    }

    @Test
    void twoPointsOnly() {
        double[][] km = {{0, 2}, {2, 0}};
        for (RouteAlgorithm algorithm : RouteAlgorithm.values()) {
            RouteOptimizer.Plan plan = RouteOptimizer.solve(km, 1, algorithm, 1L);
            assertEquals(List.of(0, 1), plan.order());
            assertEquals(2.0, plan.totalKm(), 1e-9);
        }
        assertThrows(IllegalArgumentException.class,
                () -> RouteOptimizer.solve(new double[][] {{0}}, 1, RouteAlgorithm.TWO_OPT, null));
    }
}
