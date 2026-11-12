package br.com.kjfleets.config;

import br.com.kjfleets.config.RoutingProperties.Mode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.FieldError;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RoutingPropertiesTest {

    private static final Map<String, String> VALID = Map.of(
            "kjfleets.routing.mode", "haversine",
            "kjfleets.routing.detour-factor", "1.3",
            "kjfleets.routing.avg-speed-kmh", "40",
            "kjfleets.routing.arrival-radius-m", "200",
            "kjfleets.routing.position-max-age-s", "300");

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(RoutingConfig.class);

    @Test
    void invalidDetourFailsStartup() {
        runner.withPropertyValues(with("kjfleets.routing.detour-factor", "5"))
                .run(ctx -> {
                    assertNotNull(ctx.getStartupFailure());
                    BindValidationException ex = (BindValidationException) findCause(
                            ctx.getStartupFailure(), BindValidationException.class);
                    assertNotNull(ex);
                    assertEquals(java.util.List.of("detourFactor"), failingFields(ex));
                });
    }

    @ParameterizedTest
    @CsvSource({
            "kjfleets.routing.detour-factor, 0.9, detourFactor",
            "kjfleets.routing.detour-factor, 3.1, detourFactor",
            "kjfleets.routing.avg-speed-kmh, 4, avgSpeedKmh",
            "kjfleets.routing.avg-speed-kmh, 151, avgSpeedKmh",
            "kjfleets.routing.arrival-radius-m, 19, arrivalRadiusM",
            "kjfleets.routing.arrival-radius-m, 5001, arrivalRadiusM",
            "kjfleets.routing.position-max-age-s, 29, positionMaxAgeS",
            "kjfleets.routing.position-max-age-s, 3601, positionMaxAgeS"
    })
    void outOfRangeValueFailsStartup(String key, String value, String field) {
        runner.withPropertyValues(with(key, value))
                .run(ctx -> {
                    BindValidationException ex = (BindValidationException) findCause(
                            ctx.getStartupFailure(), BindValidationException.class);
                    assertNotNull(ex);
                    assertTrue(failingFields(ex).contains(field), "campos com erro: " + failingFields(ex));
                });
    }

    @Test
    void modeIsCaseInsensitive() {
        runner.withPropertyValues(with("kjfleets.routing.mode", "road"))
                .run(ctx -> assertEquals(Mode.ROAD, ctx.getBean(RoutingProperties.class).mode()));
        runner.withPropertyValues(with("kjfleets.routing.mode", "HAVERSINE"))
                .run(ctx -> assertEquals(Mode.HAVERSINE, ctx.getBean(RoutingProperties.class).mode()));
    }

    private static String[] with(String key, String value) {
        Map<String, String> values = new HashMap<>(VALID);
        values.put(key, value);
        return values.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .toArray(String[]::new);
    }

    private static java.util.List<String> failingFields(BindValidationException ex) {
        java.util.List<String> fields = new java.util.ArrayList<>();
        for (var error : ex.getValidationErrors().getAllErrors()) {
            fields.add(((FieldError) error).getField());
        }
        return fields;
    }

    private static Throwable findCause(Throwable t, Class<? extends Throwable> type) {
        for (Throwable cur = t; cur != null; cur = cur.getCause()) {
            if (type.isInstance(cur)) {
                return cur;
            }
        }
        return null;
    }

    @Configuration
    @EnableConfigurationProperties(RoutingProperties.class)
    static class RoutingConfig {
    }
}
