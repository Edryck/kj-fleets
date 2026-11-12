package br.com.kjfleets.routing;

import java.util.Arrays;

public final class AssignmentSolver {

    public record Assignment(int[] taskOfWorker, double totalCost) {
    }

    private AssignmentSolver() {
    }

    public static Assignment solve(double[][] cost, AssignmentAlgorithm algorithm) {
        int rows = cost.length;
        int cols = rows == 0 ? 0 : cost[0].length;
        int[] taskOfWorker = new int[rows];
        Arrays.fill(taskOfWorker, -1);
        if (rows > 0 && cols > 0) {
            switch (algorithm) {
                case HUNGARIAN -> hungarian(cost, rows, cols, taskOfWorker);
                case GREEDY -> greedy(cost, rows, cols, taskOfWorker);
            }
        }
        double total = 0;
        for (int w = 0; w < rows; w++) {
            if (taskOfWorker[w] >= 0) {
                total += cost[w][taskOfWorker[w]];
            }
        }
        return new Assignment(taskOfWorker, total);
    }

    private static void hungarian(double[][] cost, int rows, int cols, int[] taskOfWorker) {
        int n = Math.max(rows, cols);
        // indices 1-based; linha/coluna 0 e sentinela. Preenchimento fora da matriz = custo 0
        double[] u = new double[n + 1];
        double[] v = new double[n + 1];
        int[] rowOfCol = new int[n + 1];
        int[] way = new int[n + 1];
        for (int i = 1; i <= n; i++) {
            rowOfCol[0] = i;
            int j0 = 0;
            double[] minv = new double[n + 1];
            Arrays.fill(minv, Double.POSITIVE_INFINITY);
            boolean[] used = new boolean[n + 1];
            do {
                used[j0] = true;
                int i0 = rowOfCol[j0];
                double delta = Double.POSITIVE_INFINITY;
                int j1 = 0;
                for (int j = 1; j <= n; j++) {
                    if (used[j]) {
                        continue;
                    }
                    double c = i0 <= rows && j <= cols ? cost[i0 - 1][j - 1] : 0;
                    double cur = c - u[i0] - v[j];
                    if (cur < minv[j]) {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if (minv[j] < delta) {
                        delta = minv[j];
                        j1 = j;
                    }
                }
                for (int j = 0; j <= n; j++) {
                    if (used[j]) {
                        u[rowOfCol[j]] += delta;
                        v[j] -= delta;
                    } else {
                        minv[j] -= delta;
                    }
                }
                j0 = j1;
            } while (rowOfCol[j0] != 0);
            do {
                int j1 = way[j0];
                rowOfCol[j0] = rowOfCol[j1];
                j0 = j1;
            } while (j0 != 0);
        }
        for (int j = 1; j <= n; j++) {
            int w = rowOfCol[j] - 1;
            if (w < rows && j <= cols) {
                taskOfWorker[w] = j - 1;
            }
        }
    }

    private static void greedy(double[][] cost, int rows, int cols, int[] taskOfWorker) {
        boolean[] taskTaken = new boolean[cols];
        for (int k = 0; k < Math.min(rows, cols); k++) {
            int bestW = -1;
            int bestT = -1;
            for (int w = 0; w < rows; w++) {
                if (taskOfWorker[w] != -1) {
                    continue;
                }
                for (int t = 0; t < cols; t++) {
                    if (!taskTaken[t] && (bestW == -1 || cost[w][t] < cost[bestW][bestT])) {
                        bestW = w;
                        bestT = t;
                    }
                }
            }
            taskOfWorker[bestW] = bestT;
            taskTaken[bestT] = true;
        }
    }
}
