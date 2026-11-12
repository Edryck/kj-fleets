package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DashboardDtos.AdminPanel;
import br.com.kjfleets.dto.DashboardDtos.Alerts;
import br.com.kjfleets.dto.DashboardDtos.DispatchPanel;
import br.com.kjfleets.dto.DashboardDtos.FleetPanel;
import br.com.kjfleets.dto.DashboardDtos.DispatchQueue;
import br.com.kjfleets.dto.DashboardDtos.DriversPerformance;
import br.com.kjfleets.dto.DashboardDtos.FleetStatus;
import br.com.kjfleets.dto.DashboardDtos.Funnel;
import br.com.kjfleets.dto.DashboardDtos.OrdersSummary;
import br.com.kjfleets.dto.DashboardDtos.RoutingSavings;
import br.com.kjfleets.dto.DashboardDtos.YearlyTrends;
import br.com.kjfleets.service.AlertService;
import br.com.kjfleets.service.DashboardService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardController {

    private final DashboardService service;
    private final AlertService alerts;

    public DashboardController(DashboardService service, AlertService alerts) {
        this.service = service;
        this.alerts = alerts;
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

    @GetMapping("/dashboard/alerts")
    Alerts alerts(Authentication auth) {
        return alerts.alerts(auth);
    }

    @GetMapping("/dashboard/admin")
    AdminPanel adminPanel(@RequestParam(required = false) String period, Authentication auth) {
        return service.adminPanel(period, auth);
    }

    @GetMapping("/dashboard/dispatch")
    DispatchPanel dispatchPanel(@RequestParam(required = false) String period, Authentication auth) {
        return service.dispatchPanel(period, auth);
    }

    @GetMapping("/dashboard/fleet")
    FleetPanel fleetPanel(@RequestParam(required = false) String period, Authentication auth) {
        return service.fleetPanel(period, auth);
    }
}
