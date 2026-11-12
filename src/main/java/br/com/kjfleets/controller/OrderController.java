package br.com.kjfleets.controller;

import br.com.kjfleets.dto.OrderDtos.AssignRequest;
import br.com.kjfleets.dto.OrderDtos.CreateOrderRequest;
import br.com.kjfleets.dto.OrderDtos.OrderDetailResponse;
import br.com.kjfleets.dto.OrderDtos.OrderFilter;
import br.com.kjfleets.dto.OrderDtos.OrderSummaryResponse;
import br.com.kjfleets.dto.OrderDtos.TrackingResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
public class OrderController {

    private final OrderService service;

    public OrderController(OrderService service) {
        this.service = service;
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    OrderDetailResponse create(@Valid @RequestBody CreateOrderRequest request, Authentication authentication) {
        return service.create(request, authentication);
    }

    @PostMapping("/orders/{publicId}/assign")
    OrderDetailResponse assign(@PathVariable String publicId, @Valid @RequestBody AssignRequest request) {
        return service.assign(publicId, request);
    }

    @PostMapping("/orders/{publicId}/dispatch")
    OrderDetailResponse dispatch(@PathVariable String publicId) {
        return service.dispatch(publicId);
    }

    @GetMapping("/orders")
    PageResponse<OrderSummaryResponse> list(@RequestParam(required = false) List<OrderStatus> status,
                                            @RequestParam(required = false) String driverId,
                                            @RequestParam(required = false) String customerId,
                                            @RequestParam(required = false) Boolean active,
                                            @RequestParam(required = false) Instant from,
                                            @RequestParam(required = false) Instant to,
                                            @RequestParam(required = false) Integer limit,
                                            @RequestParam(required = false) Integer offset,
                                            Authentication authentication) {
        OrderFilter filter = new OrderFilter(status, driverId, customerId, active, from, to);
        return service.list(filter, limit, offset, authentication);
    }

    @GetMapping("/orders/{publicId}")
    OrderDetailResponse get(@PathVariable String publicId, Authentication authentication) {
        return service.get(publicId, authentication);
    }

    @GetMapping("/orders/{publicId}/tracking")
    List<TrackingResponse> tracking(@PathVariable String publicId, Authentication authentication) {
        return service.tracking(publicId, authentication);
    }
}
