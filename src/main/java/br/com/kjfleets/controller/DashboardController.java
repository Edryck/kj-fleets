package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DashboardDtos.DispatchQueue;
import br.com.kjfleets.dto.DashboardDtos.DriversPerformance;
import br.com.kjfleets.dto.DashboardDtos.FleetStatus;
import br.com.kjfleets.dto.DashboardDtos.Funnel;
import br.com.kjfleets.dto.DashboardDtos.OrdersSummary;
import br.com.kjfleets.dto.DashboardDtos.RoutingSavings;
import br.com.kjfleets.dto.DashboardDtos.YearlyTrends;
import br.com.kjfleets.service.DashboardService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/dashboard/orders/summary")
    OrdersSummary ordersSummary(@RequestParam(required = false) String period,
                                @RequestParam(defaultValue = "false") boolean compare, Authentication auth) {
        return service.ordersSummary(period, compare, auth);
    }

    @GetMapping("/dashboard/orders/funnel")
    Funnel funnel() {
        return service.funnel();
    }

    @GetMapping("/dashboard/dispatch/queue")
    DispatchQueue dispatchQueue() {
        return service.dispatchQueue();
    }

    @GetMapping("/dashboard/fleet/status")
    FleetStatus fleetStatus(@RequestParam(required = false) String fleetId, Authentication auth) {
        return service.fleetStatus(fleetId, auth);
    }

    @GetMapping("/dashboard/drivers/performance")
    DriversPerformance driversPerformance(@RequestParam(required = false) String period,
                                          @RequestParam(required = false) String fleetId) {
        return service.driversPerformance(period, fleetId);
    }

    @GetMapping("/dashboard/routing/savings")
    RoutingSavings routingSavings(@RequestParam(required = false) String period) {
        return service.routingSavings(period);
    }

    @GetMapping("/dashboard/trends/yearly")
    YearlyTrends yearlyTrends(Authentication auth) {
        return service.yearlyTrends(auth);
    }
}
