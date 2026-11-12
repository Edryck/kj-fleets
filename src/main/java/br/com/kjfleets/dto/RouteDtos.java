package br.com.kjfleets.dto;

import br.com.kjfleets.entity.Route;
import br.com.kjfleets.entity.RouteStop;
import br.com.kjfleets.entity.StopType;
import br.com.kjfleets.routing.RouteAlgorithm;

import java.time.Instant;
import java.util.List;

public final class RouteDtos {

    private RouteDtos() {
    }

    public record RouteRequest(RouteAlgorithm algorithm, Long seed) {
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
                                List<StopResponse> stops) {

        public static RouteResponse from(Route route, Integer etaMinutes) {
            return new RouteResponse(route.getOrder().getPublicId(), route.getAlgorithm(), route.getMode(),
                    route.getTotalKm(), route.getBaselineKm(), route.getSavingsPct(), etaMinutes,
                    route.getComputedAt(), route.getStops().stream().map(StopResponse::from).toList());
        }
    }
}
