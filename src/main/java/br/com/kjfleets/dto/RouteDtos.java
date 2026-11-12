package br.com.kjfleets.dto;

import br.com.kjfleets.entity.Route;
import br.com.kjfleets.entity.RouteStop;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.routing.RouteAlgorithm;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class RouteDtos {

    private RouteDtos() {
    }

    public record RouteRequest(RouteAlgorithm algorithm, Long seed) {
    }

    public record StopCompleteRequest(@DecimalMin("-90") @DecimalMax("90") Double lat,
                                      @DecimalMin("-180") @DecimalMax("180") Double lng) {
    }

    public record StopResponse(int seq, StopType type, String placeId, String name, double lat, double lng,
                               double legKm, Instant visitedAt, Double distanceM) {

        public static StopResponse from(RouteStop stop) {
            boolean hasPlace = stop.getPlace() != null;
            return new StopResponse(stop.getSeq(), stop.getType(), hasPlace ? stop.getPlace().getPublicId() : null,
                    hasPlace ? stop.getPlace().getName() : null, stop.getLat(), stop.getLng(), stop.getLegKm(),
                    stop.getVisitedAt(), stop.getDistanceM());
        }
    }

    public record RouteResponse(String orderId, RouteAlgorithm algorithm, String mode, double totalKm,
                                double baselineKm, double savingsPct, Integer etaMinutes, Instant computedAt,
                                List<StopResponse> stops, NextStop nextStop) {

        public static RouteResponse from(Route route, Integer etaMinutes) {
            return new RouteResponse(route.getOrder().getPublicId(), route.getAlgorithm(), route.getMode(),
                    route.getTotalKm(), route.getBaselineKm(), route.getSavingsPct(), etaMinutes,
                    route.getComputedAt(), route.getStops().stream().map(StopResponse::from).toList(), null);
        }

        public RouteResponse withNextStop(NextStop next) {
            return new RouteResponse(orderId, algorithm, mode, totalKm, baselineKm, savingsPct, etaMinutes,
                    computedAt, stops, next);
        }
    }

    // distanceM e withinRadius ficam nulos quando o motorista não tem posição recente
    public record NextStop(int seq, StopType type, String name, String address, Double distanceM, int radiusM,
                           Boolean withinRadius, Long positionAgeS, boolean positionValid) {
    }

    public record PointDto(@NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
                           @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng) {
    }

    public record OptimizeRequest(@Valid PointDto start, @Valid @NotNull PointDto pickup,
                                  @Valid @Size(max = 50) List<@NotNull @Valid PointDto> waypoints,
                                  @Valid @NotNull PointDto dropoff, RouteAlgorithm algorithm, Long seed,
                                  Boolean compare) {
    }

    public record OptimizedStop(int seq, StopType type, double lat, double lng, double legKm,
                                Integer waypointIndex) {
    }

    public record AlgorithmResult(double totalKm, long ms) {
    }

    public record OptimizeResponse(RouteAlgorithm algorithm, List<OptimizedStop> stops, double totalKm,
                                   double baselineKm, double savingsPct, int etaMinutes,
                                   Map<RouteAlgorithm, AlgorithmResult> comparison) {
    }
}
