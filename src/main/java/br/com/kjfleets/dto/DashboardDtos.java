package br.com.kjfleets.dto;

import java.time.Instant;

public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record Meta(Instant generatedAt, String timezone, String period, Instant from, Instant to) {
    }
}
