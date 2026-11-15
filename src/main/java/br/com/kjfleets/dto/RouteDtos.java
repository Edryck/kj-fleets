package br.com.kjfleets.dto;

import br.com.kjfleets.entity.DistanceSource;
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
import java.util.stream.Stream;

public final class RouteDtos {

    private RouteDtos() {
    }

    public record RouteRequest(RouteAlgorithm algorithm, Long seed) {
    }

    public record StopCompleteRequest(@DecimalMin("-90") @DecimalMax("90") Double lat,
                                      @DecimalMin("-180") @DecimalMax("180") Double lng) {
    }

    public record StopResponse(int seq, StopType type, String placeId, String name, double lat, double lng,
                               double legKm, Instant visitedAt, Double distanceM, DistanceSource distanceSource,
                               List<double[]> path) {

        // path é calculado na leitura (só pernas ROAD com o grafo carregado); a geometria não é gravada
        public static StopResponse from(RouteStop stop, List<double[]> path) {
            boolean hasPlace = stop.getPlace() != null;
            return new StopResponse(stop.getSeq(), stop.getType(), hasPlace ? stop.getPlace().getPublicId() : null,
                    hasPlace ? stop.getPlace().getName() : null, stop.getLat(), stop.getLng(), stop.getLegKm(),
                    stop.getVisitedAt(), stop.getDistanceM(), stop.getDistanceSource(), path);
        }
    }

    // só conta no modo road: em haversine toda perna é linha reta por definição
    public static int fallbackLegs(String mode, Stream<DistanceSource> sources) {
        return "ROAD".equals(mode) ? (int) sources.filter(s -> s == DistanceSource.HAVERSINE).count() : 0;
    }

    public record RouteResponse(String orderId, RouteAlgorithm algorithm, String mode, double totalKm,
                                double baselineKm, double savingsPct, Integer etaMinutes, Instant computedAt,
                                int fallbackLegs, List<StopResponse> stops, NextStop nextStop) {

        public static RouteResponse from(Route route, Integer etaMinutes, List<StopResponse> stops) {
            return new RouteResponse(route.getOrder().getPublicId(), route.getAlgorithm(), route.getMode(),
                    route.getTotalKm(), route.getBaselineKm(), route.getSavingsPct(), etaMinutes,
                    route.getComputedAt(), RouteDtos.fallbackLegs(route.getMode(), stops.stream().map(StopResponse::distanceSource)),
                    stops, null);
        }

        public RouteResponse withNextStop(NextStop next) {
            return new RouteResponse(orderId, algorithm, mode, totalKm, baselineKm, savingsPct, etaMinutes,
                    computedAt, fallbackLegs, stops, next);
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
                                Integer waypointIndex, DistanceSource distanceSource, List<double[]> path) {
    }

    public record AlgorithmResult(double totalKm, long ms) {
    }

    public record OptimizeResponse(RouteAlgorithm algorithm, List<OptimizedStop> stops, double totalKm,
                                   double baselineKm, double savingsPct, int etaMinutes,
                                   Map<RouteAlgorithm, AlgorithmResult> comparison, int fallbackLegs) {
    }
}
