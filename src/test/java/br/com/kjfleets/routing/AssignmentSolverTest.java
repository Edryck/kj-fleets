package br.com.kjfleets.routing;

import java.util.Random;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AssignmentSolverTest {

    private static double[][] randomMatrix(Random random, int rows, int cols) {
        double[][] cost = new double[rows][cols];
        for (double[] row : cost) {
            for (int j = 0; j < cols; j++) {
                row[j] = random.nextDouble() * 100;
            }
        }
        return cost;
    }

    // melhor custo com min(rows, cols) pares: cada trabalhador escolhe uma tarefa livre ou nenhuma
    private static double bruteForce(double[][] cost, int worker, boolean[] used, int left) {
        if (left == 0) {
            return 0;
        }
        if (worker == cost.length || cost.length - worker < left) {
            return Double.POSITIVE_INFINITY;
        }
        double best = bruteForce(cost, worker + 1, used, left);
        for (int t = 0; t < used.length; t++) {
            if (!used[t]) {
                used[t] = true;
                best = Math.min(best, cost[worker][t] + bruteForce(cost, worker + 1, used, left - 1));
                used[t] = false;
            }
        }
        return best;
    }

    private static void assertConsistent(double[][] cost, AssignmentSolver.Assignment result) {
        int rows = cost.length;
        int cols = rows == 0 ? 0 : cost[0].length;
        assertEquals(rows, result.taskOfWorker().length);
        boolean[] taken = new boolean[cols];
        double total = 0;
        int assigned = 0;
        for (int w = 0; w < rows; w++) {
            int t = result.taskOfWorker()[w];
            if (t == -1) {
                continue;
            }
            assertTrue(t >= 0 && t < cols);
            assertTrue(!taken[t]);
            taken[t] = true;
            total += cost[w][t];
            assigned++;
        }
        assertEquals(Math.min(rows, cols), assigned);
        assertEquals(total, result.totalCost(), 1e-9);
    }

    @Test
    void hungarianMatchesBruteForce() {
        Random random = new Random(11);
        for (int i = 0; i < 300; i++) {
            double[][] cost = randomMatrix(random, 1 + random.nextInt(7), 1 + random.nextInt(7));
            AssignmentSolver.Assignment result = AssignmentSolver.solve(cost, AssignmentAlgorithm.HUNGARIAN);
            assertConsistent(cost, result);
            int size = Math.min(cost.length, cost[0].length);
            assertEquals(bruteForce(cost, 0, new boolean[cost[0].length], size), result.totalCost(), 1e-9);
        }
    }

    @Test
    void hungarianNeverWorseThanGreedy() {
        Random random = new Random(12);
        for (int i = 0; i < 300; i++) {
            double[][] cost = randomMatrix(random, 1 + random.nextInt(30), 1 + random.nextInt(30));
            AssignmentSolver.Assignment hungarian = AssignmentSolver.solve(cost, AssignmentAlgorithm.HUNGARIAN);
            AssignmentSolver.Assignment greedy = AssignmentSolver.solve(cost, AssignmentAlgorithm.GREEDY);
            assertConsistent(cost, hungarian);
            assertConsistent(cost, greedy);
            assertTrue(hungarian.totalCost() <= greedy.totalCost() + 1e-9);
        }
    }

    @Test
    void moreWorkersThanTasks() {
        double[][] cost = randomMatrix(new Random(1), 5, 2);
        for (AssignmentAlgorithm algorithm : AssignmentAlgorithm.values()) {
            AssignmentSolver.Assignment result = AssignmentSolver.solve(cost, algorithm);
            assertConsistent(cost, result);
            assertEquals(2, java.util.Arrays.stream(result.taskOfWorker()).filter(t -> t >= 0).count());
        }
    }

    @Test
    void moreTasksThanWorkers() {
        double[][] cost = randomMatrix(new Random(2), 2, 5);
        for (AssignmentAlgorithm algorithm : AssignmentAlgorithm.values()) {
            AssignmentSolver.Assignment result = AssignmentSolver.solve(cost, algorithm);
            assertConsistent(cost, result);
            assertTrue(result.taskOfWorker()[0] >= 0 && result.taskOfWorker()[1] >= 0);
            assertTrue(result.taskOfWorker()[0] != result.taskOfWorker()[1]);
        }
    }

    @Test
    void emptyInputs() {
        for (AssignmentAlgorithm algorithm : AssignmentAlgorithm.values()) {
            AssignmentSolver.Assignment none = AssignmentSolver.solve(new double[0][0], algorithm);
            assertEquals(0, none.taskOfWorker().length);
            assertEquals(0, none.totalCost());

            AssignmentSolver.Assignment noTasks = AssignmentSolver.solve(new double[3][0], algorithm);
            assertEquals(3, noTasks.taskOfWorker().length);
            for (int t : noTasks.taskOfWorker()) {
                assertEquals(-1, t);
            }
            assertEquals(0, noTasks.totalCost());
        }
    }

    @Test
    void greedyKnownCase() {
        double[][] cost = {{1, 2}, {2, 100}};
        assertEquals(101, AssignmentSolver.solve(cost, AssignmentAlgorithm.GREEDY).totalCost(), 1e-9);
        assertEquals(4, AssignmentSolver.solve(cost, AssignmentAlgorithm.HUNGARIAN).totalCost(), 1e-9);
    }
}
