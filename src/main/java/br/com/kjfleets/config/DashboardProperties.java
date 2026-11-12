package br.com.kjfleets.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.ZoneId;

@ConfigurationProperties("kjfleets.dashboard")
@Validated
public record DashboardProperties(
        @NotNull ZoneId timezone,
        @Min(1) @Max(1440) int staleUnassignedMin,
        @Min(1) @Max(1440) int staleAssignedMin,
        @Min(1) @Max(1440) int staleDispatchedMin,
        @Min(1) @Max(1440) int staleEnrouteMin,
        @Min(1) @Max(1440) int staleArrivedMin,
        @Min(1) @Max(1440) int staleInProgressMin,
        @Min(1) @Max(365) int maintenanceAlertDays) {
}
