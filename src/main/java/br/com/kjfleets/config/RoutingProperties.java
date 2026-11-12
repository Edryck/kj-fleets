package br.com.kjfleets.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties("kjfleets.routing")
@Validated
public record RoutingProperties(
        @NotNull Mode mode,
        @DecimalMin("1.0") @DecimalMax("3.0") double detourFactor,
        @Min(5) @Max(150) double avgSpeedKmh,
        @Min(20) @Max(5000) int arrivalRadiusM,
        @Min(30) @Max(3600) int positionMaxAgeS) {

    public enum Mode { HAVERSINE, ROAD }
}
