package br.com.kjfleets.controller;

import br.com.kjfleets.dto.OrderDtos.ActivityRequest;
import br.com.kjfleets.dto.OrderDtos.AvailableOrderResponse;
import br.com.kjfleets.dto.OrderDtos.DriverOrderResponse;
import br.com.kjfleets.dto.OrderDtos.DriverOrderSummaryResponse;
import br.com.kjfleets.dto.OrderDtos.PodRequest;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.dto.RouteDtos.RouteResponse;
import br.com.kjfleets.dto.RouteDtos.StopCompleteRequest;
import br.com.kjfleets.service.OrderService;
import br.com.kjfleets.service.RouteService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DriverOrderController {

    private final OrderService service;
    private final RouteService routeService;

    public DriverOrderController(OrderService service, RouteService routeService) {
        this.service = service;
        this.routeService = routeService;
    }

    @GetMapping(value = "/driver/orders", params = "available=true")
    PageResponse<AvailableOrderResponse> available(@RequestParam(required = false) Integer limit,
                                                   @RequestParam(required = false) Integer offset) {
        return service.availableOrders(limit, offset);
    }

    @GetMapping("/driver/orders")
    PageResponse<DriverOrderSummaryResponse> list(@RequestParam(required = false) OrderStatus status,
                                            @RequestParam(required = false) Integer limit,
                                            @RequestParam(required = false) Integer offset,
                                            Authentication authentication) {
        return service.driverOrders(authentication.getName(), status, limit, offset);
    }

    @GetMapping("/driver/orders/{publicId}")
    DriverOrderResponse get(@PathVariable String publicId, Authentication authentication) {
        return service.driverOrder(publicId, authentication.getName());
    }

    @GetMapping("/driver/orders/{publicId}/route")
    RouteResponse route(@PathVariable String publicId, Authentication authentication) {
        return routeService.driverRoute(publicId, authentication.getName());
    }

    @PostMapping("/driver/orders/{publicId}/stops/{seq}/complete")
    RouteResponse completeStop(@PathVariable String publicId, @PathVariable int seq,
                               @Valid @RequestBody(required = false) StopCompleteRequest request,
                               Authentication authentication) {
        return routeService.completeStop(publicId, seq,
                request == null ? new StopCompleteRequest(null, null) : request, authentication.getName(), true);
    }

    @PostMapping("/driver/orders/{publicId}/activity")
    DriverOrderResponse activity(@PathVariable String publicId, @Valid @RequestBody ActivityRequest request,
                                 Authentication authentication) {
        service.advance(publicId, request, authentication.getName(), true);
        return service.driverOrder(publicId, authentication.getName());
    }

    @PostMapping("/driver/orders/{publicId}/pod")
    DriverOrderResponse pod(@PathVariable String publicId, @Valid @RequestBody PodRequest request,
                            Authentication authentication) {
        service.registerPod(publicId, request, authentication.getName(), true);
        return service.driverOrder(publicId, authentication.getName());
    }

    @PostMapping("/driver/orders/{publicId}/accept")
    DriverOrderResponse accept(@PathVariable String publicId, Authentication authentication) {
        return service.accept(publicId, authentication.getName());
    }
}
