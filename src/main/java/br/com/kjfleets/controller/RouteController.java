package br.com.kjfleets.controller;

import br.com.kjfleets.dto.RouteDtos.RouteRequest;
import br.com.kjfleets.dto.RouteDtos.RouteResponse;
import br.com.kjfleets.service.RouteService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RouteController {

    private final RouteService service;

    public RouteController(RouteService service) {
        this.service = service;
    }

    @PostMapping("/orders/{publicId}/route")
    RouteResponse compute(@PathVariable String publicId, @RequestBody(required = false) RouteRequest request) {
        return service.computeManual(publicId, request == null ? new RouteRequest(null, null) : request);
    }

    @GetMapping("/orders/{publicId}/route")
    RouteResponse get(@PathVariable String publicId) {
        return service.get(publicId);
    }
}
