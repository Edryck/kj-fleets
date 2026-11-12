package br.com.kjfleets.controller;

import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.dto.VehicleDtos.VehicleRequest;
import br.com.kjfleets.dto.VehicleDtos.VehicleResponse;
import br.com.kjfleets.entity.VehicleStatus;
import br.com.kjfleets.service.VehicleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VehicleController {

    private final VehicleService service;

    public VehicleController(VehicleService service) {
        this.service = service;
    }

    @PostMapping("/vehicles")
    @ResponseStatus(HttpStatus.CREATED)
    VehicleResponse create(@Valid @RequestBody VehicleRequest request) {
        return service.create(request);
    }

    @GetMapping("/vehicles")
    PageResponse<VehicleResponse> list(@RequestParam(required = false) String q,
                                       @RequestParam(required = false) VehicleStatus status,
                                       @RequestParam(defaultValue = "false") boolean includeInactive,
                                       @RequestParam(required = false) Integer limit,
                                       @RequestParam(required = false) Integer offset, Authentication auth) {
        return service.list(q, status, includeInactive, limit, offset, auth);
    }

    @GetMapping("/vehicles/{publicId}")
    VehicleResponse get(@PathVariable String publicId) {
        return service.get(publicId);
    }

    @PutMapping("/vehicles/{publicId}")
    VehicleResponse update(@PathVariable String publicId, @Valid @RequestBody VehicleRequest request) {
        return service.update(publicId, request);
    }

    @PostMapping("/vehicles/{publicId}/reactivate")
    VehicleResponse reactivate(@PathVariable String publicId) {
        return service.reactivate(publicId);
    }

    @DeleteMapping("/vehicles/{publicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String publicId) {
        service.delete(publicId);
    }
}
