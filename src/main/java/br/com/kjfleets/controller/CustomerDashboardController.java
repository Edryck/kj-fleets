package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DashboardDtos.CustomerPanel;
import br.com.kjfleets.service.DashboardService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CustomerDashboardController {

    private final DashboardService service;

    public CustomerDashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/customer/dashboard")
    CustomerPanel panel(@RequestParam(required = false) String period, Authentication auth) {
        return service.customerPanel(period, auth);
    }
}
