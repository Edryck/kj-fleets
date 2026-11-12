package br.com.kjfleets.dto;

import java.time.Instant;
import java.util.UUID;

public final class RealtimeDtos {

    private RealtimeDtos() {
    }

    public record LocationEvent(String driverId, String name, String status, Double lat, Double lng, Instant at) {
    }

    public record OrderEvent(String orderId, String code, String status, String driverId, Instant at) {
    }

    public record OrderDetailEvent(String orderId, String code, String status, Integer etaMinutes, int stopsDone,
                                   int stopsTotal, Instant at) {
    }

    // eventos internos: os serviços publicam, o RealtimePublisher manda depois do commit
    public record OrderTracked(UUID orderId, String code) {
    }

    // leva o necessário pra montar a mensagem: ping é o caminho quente e não pode ir ao banco
    public record DriverMoved(String driverId, String name, String status, double lat, double lng) {
    }

    public record DriverRemoved(String driverId) {
    }

    public record DriverStatusChanged(UUID driverId) {
    }
}
