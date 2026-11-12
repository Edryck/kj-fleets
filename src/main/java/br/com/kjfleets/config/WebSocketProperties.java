package br.com.kjfleets.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties("kjfleets.ws")
@Validated
public record WebSocketProperties(
        @Min(1) @Max(300) int locationMinIntervalS,
        @Min(0) @Max(1000) int locationMinDistanceM) {
}
