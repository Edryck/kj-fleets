package br.com.kjfleets.controller;

import br.com.kjfleets.dto.OrderDtos.CreateOrderRequest;
import br.com.kjfleets.dto.OrderDtos.OrderDetailResponse;
import br.com.kjfleets.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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
}
