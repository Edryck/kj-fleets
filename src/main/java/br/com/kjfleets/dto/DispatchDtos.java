package br.com.kjfleets.dto;

import br.com.kjfleets.routing.AssignmentAlgorithm;

import java.util.List;
import java.util.Map;

public final class DispatchDtos {

    private DispatchDtos() {
    }

    public record PlanRequest(AssignmentAlgorithm algorithm, List<String> orderIds, Boolean apply) {

        public PlanRequest {
            algorithm = algorithm == null ? AssignmentAlgorithm.HUNGARIAN : algorithm;
            apply = apply != null && apply;
        }
    }

    public record PlannedAssignment(String orderId, String driverId, String vehicleId, double km) {
    }

    public record PlanResponse(AssignmentAlgorithm algorithm, boolean applied, List<PlannedAssignment> assignments,
                               List<String> unassigned, double totalKm,
                               Map<AssignmentAlgorithm, Double> comparison) {
    }
}
