package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DriverDtos.DriverResponse;
import br.com.kjfleets.dto.DriverDtos.LocationRequest;
import br.com.kjfleets.service.DriverService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DriverSelfController {

    private final DriverService service;

    public DriverSelfController(DriverService service) {
        this.service = service;
    }

    @GetMapping("/driver/me")
    DriverResponse me(Authentication authentication) {
        return service.me(authentication.getName());
    }

    @PostMapping("/driver/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void location(Authentication authentication, @Valid @RequestBody LocationRequest request) {
        service.updateLocation(authentication.getName(), request);
    }
}
