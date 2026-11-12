package br.com.kjfleets.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.FieldError;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DashboardPropertiesTest {

    private static final String[] VALID = {
            "kjfleets.dashboard.timezone=America/Sao_Paulo",
            "kjfleets.dashboard.stale-unassigned-min=30",
            "kjfleets.dashboard.stale-assigned-min=15",
            "kjfleets.dashboard.stale-dispatched-min=15",
            "kjfleets.dashboard.stale-enroute-min=60",
            "kjfleets.dashboard.stale-arrived-min=20",
            "kjfleets.dashboard.stale-in-progress-min=90",
            "kjfleets.dashboard.maintenance-alert-days=7"};

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(DashboardConfig.class);

    @Test
    void defaultsBind() {
        runner.withPropertyValues(VALID).run(ctx -> {
            DashboardProperties props = ctx.getBean(DashboardProperties.class);
            assertEquals(ZoneId.of("America/Sao_Paulo"), props.timezone());
            assertEquals(30, props.staleUnassignedMin());
            assertEquals(15, props.staleAssignedMin());
            assertEquals(15, props.staleDispatchedMin());
            assertEquals(60, props.staleEnrouteMin());
            assertEquals(20, props.staleArrivedMin());
            assertEquals(90, props.staleInProgressMin());
            assertEquals(7, props.maintenanceAlertDays());
        });
    }

    @Test
    void invalidZoneFailsStartup() {
        runner.withPropertyValues(with("kjfleets.dashboard.timezone=Mars/Base"))
                .run(ctx -> assertNotNull(ctx.getStartupFailure()));
    }

    @Test
    void outOfRangeFailsStartup() {
        runner.withPropertyValues(with("kjfleets.dashboard.stale-enroute-min=0")).run(ctx -> {
            BindValidationException ex = (BindValidationException) findCause(ctx.getStartupFailure());
            assertNotNull(ex);
            assertTrue(failingFields(ex).contains("staleEnrouteMin"), "campos com erro: " + failingFields(ex));
        });
        runner.withPropertyValues(with("kjfleets.dashboard.maintenance-alert-days=366")).run(ctx -> {
            BindValidationException ex = (BindValidationException) findCause(ctx.getStartupFailure());
            assertNotNull(ex);
            assertTrue(failingFields(ex).contains("maintenanceAlertDays"));
        });
    }

    private static String[] with(String override) {
        String key = override.substring(0, override.indexOf('='));
        List<String> values = new ArrayList<>();
        for (String value : VALID) {
            if (!value.startsWith(key + "=")) {
                values.add(value);
            }
        }
        values.add(override);
        return values.toArray(String[]::new);
    }

    private static List<String> failingFields(BindValidationException ex) {
        List<String> fields = new ArrayList<>();
        for (var error : ex.getValidationErrors().getAllErrors()) {
            fields.add(((FieldError) error).getField());
        }
        return fields;
    }

    private static Throwable findCause(Throwable t) {
        for (Throwable cur = t; cur != null; cur = cur.getCause()) {
            if (cur instanceof BindValidationException) {
                return cur;
            }
        }
        return null;
    }

    @Configuration
    @EnableConfigurationProperties(DashboardProperties.class)
    static class DashboardConfig {
    }
}
