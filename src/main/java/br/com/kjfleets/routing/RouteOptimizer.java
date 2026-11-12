package br.com.kjfleets.routing;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public final class RouteOptimizer {

    public static final int HELD_KARP_MAX = 15;

    private static final int SA_MAX_ITERATIONS = 20000;
    private static final double SA_COOLING = 0.995;
    private static final double SA_MIN_TEMPERATURE = 1e-6;
    private static final double SA_INITIAL_FACTOR = 0.1;
    private static final double EPS = 1e-12;

    public record Plan(List<Integer> order, double totalKm) {
    }

    public static class TooLargeForExactException extends RuntimeException {
        public TooLargeForExactException(int reorderable) {
            super("Held-Karp aceita no maximo " + HELD_KARP_MAX + " pontos reordenaveis, recebeu " + reorderable);
        }
    }

    private RouteOptimizer() {
    }

    public static RouteAlgorithm defaultFor(int reorderable) {
        return reorderable <= HELD_KARP_MAX ? RouteAlgorithm.HELD_KARP : RouteAlgorithm.TWO_OPT;
    }

    public static double pathKm(double[][] km, List<Integer> order) {
        double total = 0;
        for (int i = 1; i < order.size(); i++) {
            total += km[order.get(i - 1)][order.get(i)];
        }
        return total;
    }

    public static Plan solve(double[][] km, int fixedPrefix, RouteAlgorithm algorithm, Long seed) {
        int n = km.length;
        if (n < 2 || fixedPrefix < 1 || fixedPrefix > n - 1) {
            throw new IllegalArgumentException("matriz ou fixedPrefix invalidos");
        }
        List<Integer> inner = switch (algorithm) {
            case NEAREST_NEIGHBOR -> nearestNeighbor(km, fixedPrefix);
            case TWO_OPT -> twoOpt(km, fixedPrefix, nearestNeighbor(km, fixedPrefix));
            case HELD_KARP -> heldKarp(km, fixedPrefix);
            case SIMULATED_ANNEALING -> annealing(km, fixedPrefix, seed);
        };
        List<Integer> order = fullPath(fixedPrefix, inner, n);
        return new Plan(order, pathKm(km, order));
    }

    private static List<Integer> fullPath(int fixedPrefix, List<Integer> inner, int n) {
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < fixedPrefix; i++) {
            order.add(i);
        }
        order.addAll(inner);
        order.add(n - 1);
        return order;
    }

    private static List<Integer> nearestNeighbor(double[][] km, int fixedPrefix) {
        int n = km.length;
        List<Integer> left = new ArrayList<>();
        for (int i = fixedPrefix; i < n - 1; i++) {
            left.add(i);
        }
        List<Integer> inner = new ArrayList<>();
        int current = fixedPrefix - 1;
        while (!left.isEmpty()) {
            int best = 0;
            for (int i = 1; i < left.size(); i++) {
                if (km[current][left.get(i)] < km[current][left.get(best)]) {
                    best = i;
                }
            }
            current = left.remove(best);
            inner.add(current);
        }
        return inner;
    }

    private static double innerCost(double[][] km, int fixedPrefix, List<Integer> inner) {
        return pathKm(km, fullPath(fixedPrefix, inner, km.length));
    }

    private static List<Integer> twoOpt(double[][] km, int fixedPrefix, List<Integer> start) {
        List<Integer> inner = new ArrayList<>(start);
        double cost = innerCost(km, fixedPrefix, inner);
        boolean improved = true;
        while (improved) {
            improved = false;
            for (int i = 0; i < inner.size() - 1; i++) {
                for (int j = i + 1; j < inner.size(); j++) {
                    Collections.reverse(inner.subList(i, j + 1));
                    double candidate = innerCost(km, fixedPrefix, inner);
                    if (candidate < cost - EPS) {
                        cost = candidate;
                        improved = true;
                    } else {
                        Collections.reverse(inner.subList(i, j + 1));
                    }
                }
            }
        }
        return inner;
    }

    private static List<Integer> annealing(double[][] km, int fixedPrefix, Long seed) {
        Random random = seed != null ? new Random(seed) : new Random();
        List<Integer> current = nearestNeighbor(km, fixedPrefix);
        double currentCost = innerCost(km, fixedPrefix, current);
        List<Integer> best = new ArrayList<>(current);
        double bestCost = currentCost;
        if (current.size() < 2) {
            return best;
        }
        double temperature = Math.max(currentCost * SA_INITIAL_FACTOR, 1e-9);
        for (int it = 0; it < SA_MAX_ITERATIONS && temperature >= SA_MIN_TEMPERATURE; it++) {
            int i = random.nextInt(current.size() - 1);
            int j = i + 1 + random.nextInt(current.size() - 1 - i);
            Collections.reverse(current.subList(i, j + 1));
            double candidate = innerCost(km, fixedPrefix, current);
            double delta = candidate - currentCost;
            if (delta <= 0 || random.nextDouble() < Math.exp(-delta / temperature)) {
                currentCost = candidate;
                if (candidate < bestCost - EPS) {
                    bestCost = candidate;
                    best = new ArrayList<>(current);
                }
            } else {
                Collections.reverse(current.subList(i, j + 1));
            }
            temperature *= SA_COOLING;
        }
        return best;
    }

    private static List<Integer> heldKarp(double[][] km, int fixedPrefix) {
        int n = km.length;
        int m = n - 1 - fixedPrefix;
        if (m > HELD_KARP_MAX) {
            throw new TooLargeForExactException(m);
        }
        if (m == 0) {
            return new ArrayList<>();
        }
        int start = fixedPrefix - 1;
        int end = n - 1;
        int full = (1 << m) - 1;
        // dp[mask * m + j] = menor custo saindo do start, visitando mask e terminando em j
        double[] dp = new double[(1 << m) * m];
        int[] parent = new int[dp.length];
        Arrays.fill(dp, Double.POSITIVE_INFINITY);
        for (int j = 0; j < m; j++) {
            dp[(1 << j) * m + j] = km[start][fixedPrefix + j];
            parent[(1 << j) * m + j] = -1;
        }
        for (int mask = 1; mask <= full; mask++) {
            for (int j = 0; j < m; j++) {
                double base = dp[mask * m + j];
                if ((mask & (1 << j)) == 0 || base == Double.POSITIVE_INFINITY) {
                    continue;
                }
                for (int k = 0; k < m; k++) {
                    if ((mask & (1 << k)) != 0) {
                        continue;
                    }
                    int next = (mask | (1 << k)) * m + k;
                    double cost = base + km[fixedPrefix + j][fixedPrefix + k];
                    if (cost < dp[next]) {
                        dp[next] = cost;
                        parent[next] = j;
                    }
                }
            }
        }
        int last = 0;
        double bestCost = Double.POSITIVE_INFINITY;
        for (int j = 0; j < m; j++) {
            double cost = dp[full * m + j] + km[fixedPrefix + j][end];
            if (cost < bestCost) {
                bestCost = cost;
                last = j;
            }
        }
        List<Integer> inner = new ArrayList<>();
        int mask = full;
        while (last != -1) {
            inner.add(fixedPrefix + last);
            int prev = parent[mask * m + last];
            mask &= ~(1 << last);
            last = prev;
        }
        Collections.reverse(inner);
        return inner;
    }
}
