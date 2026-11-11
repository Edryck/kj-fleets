package br.com.kjfleets.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth/test-probe")
class ErrorProbeController {

    record Point(@DecimalMin("-90") @DecimalMax("90") double lat) {
    }

    @GetMapping("/business")
    void business() {
        throw BusinessException.conflict("PLATE_TAKEN", "placa já cadastrada");
    }

    @PostMapping("/validate")
    void validate(@Valid @RequestBody Point point) {
    }

    @GetMapping("/boom")
    void boom() {
        throw new IllegalStateException("segredo interno");
    }

    @GetMapping("/denied")
    void denied() {
        throw new AccessDeniedException("negado");
    }

    @GetMapping("/unauthenticated")
    void unauthenticated() {
        throw new BadCredentialsException("credencial ruim");
    }
}
