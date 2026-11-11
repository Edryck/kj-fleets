package br.com.kjfleets.controller;

import br.com.kjfleets.dto.FleetDtos.FleetDetailResponse;
import br.com.kjfleets.dto.FleetDtos.FleetRequest;
import br.com.kjfleets.dto.FleetDtos.FleetResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.service.FleetService;
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
public class FleetController {

    private final FleetService service;

    public FleetController(FleetService service) {
        this.service = service;
    }

    @PostMapping("/fleets")
    @ResponseStatus(HttpStatus.CREATED)
    FleetDetailResponse create(@Valid @RequestBody FleetRequest request) {
        return service.create(request);
    }

    @GetMapping("/fleets")
    PageResponse<FleetResponse> list(@RequestParam(required = false) Integer limit,
                                     @RequestParam(required = false) Integer offset) {
        return service.list(limit, offset);
    }

    @GetMapping("/fleets/{publicId}")
    FleetDetailResponse get(@PathVariable String publicId) {
        return service.get(publicId);
    }

    @PutMapping("/fleets/{publicId}")
    FleetDetailResponse update(@PathVariable String publicId, @Valid @RequestBody FleetRequest request) {
        return service.update(publicId, request);
    }

    @DeleteMapping("/fleets/{publicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String publicId) {
        service.delete(publicId);
    }
}
