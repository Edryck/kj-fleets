package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DispatchDtos.PlanRequest;
import br.com.kjfleets.dto.DispatchDtos.PlanResponse;
import br.com.kjfleets.service.DispatchService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DispatchController {

    private final DispatchService service;

    public DispatchController(DispatchService service) {
        this.service = service;
    }

    @PostMapping("/dispatch/plan")
    PlanResponse plan(@Valid @RequestBody PlanRequest request) {
        return service.plan(request);
    }
}
