package br.com.kjfleets.controller;

import br.com.kjfleets.dto.CustomerDtos.CustomerResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.service.CustomerService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CustomerController {

    private final CustomerService service;

    public CustomerController(CustomerService service) {
        this.service = service;
    }

    @GetMapping("/customers")
    PageResponse<CustomerResponse> list(@RequestParam(required = false) String q,
                                        @RequestParam(required = false) Integer limit,
                                        @RequestParam(required = false) Integer offset) {
        return service.list(q, limit, offset);
    }
}
