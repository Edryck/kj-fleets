package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DashboardDtos.Funnel;
import br.com.kjfleets.dto.DashboardDtos.OrdersSummary;
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
}
