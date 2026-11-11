package br.com.kjfleets.controller;

import br.com.kjfleets.dto.DriverDtos.CreateDriverRequest;
import br.com.kjfleets.dto.DriverDtos.DriverResponse;
import br.com.kjfleets.dto.DriverDtos.UpdateDriverRequest;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.service.DriverService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
    PageResponse<DriverResponse> list(@RequestParam(required = false) Integer limit,
                                      @RequestParam(required = false) Integer offset) {
        return service.list(limit, offset);
    }

    @GetMapping("/drivers/{publicId}")
    DriverResponse get(@PathVariable String publicId) {
        return service.get(publicId);
    }

    @PutMapping("/drivers/{publicId}")
    DriverResponse update(@PathVariable String publicId, @Valid @RequestBody UpdateDriverRequest request) {
        return service.update(publicId, request);
    }

    @DeleteMapping("/drivers/{publicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String publicId) {
        service.delete(publicId);
    }
}
