package br.com.kjfleets.controller;

import br.com.kjfleets.dto.OrderDtos.PublicTrackingResponse;
import br.com.kjfleets.service.OrderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TrackController {

    private final OrderService service;

    public TrackController(OrderService service) {
        this.service = service;
    }

    @GetMapping("/track/{trackingNumber}")
    PublicTrackingResponse track(@PathVariable String trackingNumber) {
        return service.publicTracking(trackingNumber);
    }
}
