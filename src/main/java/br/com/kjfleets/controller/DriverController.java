package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DriverDtos.CreateDriverRequest;
import br.com.kjfleets.dto.DriverDtos.DriverResponse;
import br.com.kjfleets.dto.DriverDtos.NearestDriverResponse;
import br.com.kjfleets.dto.DriverDtos.UpdateDriverRequest;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.service.DriverService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@Validated
public class DriverController {

    private final DriverService service;

    public DriverController(DriverService service) {
        this.service = service;
    }

    @PostMapping("/drivers")
    @ResponseStatus(HttpStatus.CREATED)
    DriverResponse create(@Valid @RequestBody CreateDriverRequest request) {
        return service.create(request);
    }

    @GetMapping("/drivers")
    PageResponse<DriverResponse> list(@RequestParam(required = false) String q,
                                      @RequestParam(required = false) DriverStatus status,
                                      @RequestParam(defaultValue = "false") boolean includeInactive,
                                      @RequestParam(required = false) Integer limit,
                                      @RequestParam(required = false) Integer offset, Authentication auth) {
        return service.list(q, status, includeInactive, limit, offset, auth);
    }

    @GetMapping("/drivers/nearest")
    List<NearestDriverResponse> nearest(@RequestParam @DecimalMin("-90") @DecimalMax("90") double lat,
                                        @RequestParam @DecimalMin("-180") @DecimalMax("180") double lng,
                                        @RequestParam(required = false) Integer limit) {
        return service.nearest(lat, lng, limit);
    }

    @GetMapping("/drivers/{publicId}")
    DriverResponse get(@PathVariable String publicId) {
        return service.get(publicId);
    }

    @PutMapping("/drivers/{publicId}")
    DriverResponse update(@PathVariable String publicId, @Valid @RequestBody UpdateDriverRequest request) {
        return service.update(publicId, request);
    }

    @PostMapping("/drivers/{publicId}/reactivate")
    DriverResponse reactivate(@PathVariable String publicId) {
        return service.reactivate(publicId);
    }

    @DeleteMapping("/drivers/{publicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String publicId) {
        service.delete(publicId);
    }
}
