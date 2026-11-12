package br.com.kjfleets.controller;

import br.com.kjfleets.dto.AuthDtos.ChangePasswordRequest;
import br.com.kjfleets.dto.AuthDtos.CreateUserRequest;
import br.com.kjfleets.dto.AuthDtos.LoginRequest;
import br.com.kjfleets.dto.AuthDtos.LoginResponse;
import br.com.kjfleets.dto.AuthDtos.MeResponse;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.dto.AuthDtos.RegisterResponse;
import br.com.kjfleets.dto.AuthDtos.UserResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        return service.register(request);
    }

    @PostMapping("/auth/login")
    LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request);
    }

    @GetMapping("/me")
    MeResponse me(Authentication authentication) {
        return service.me(authentication.getName());
    }

    @PutMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void changePassword(Authentication authentication, @Valid @RequestBody ChangePasswordRequest request) {
        service.changePassword(authentication.getName(), request);
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    UserResponse createUser(@Valid @RequestBody CreateUserRequest request) {
        return service.createUser(request);
    }

    @GetMapping("/users")
    PageResponse<UserResponse> listUsers(@RequestParam(required = false) Integer limit,
                                         @RequestParam(required = false) Integer offset) {
        return service.listUsers(limit, offset);
    }
}
