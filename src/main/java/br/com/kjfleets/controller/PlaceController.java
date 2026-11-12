package br.com.kjfleets.controller;

import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.dto.PlaceDtos.PlaceRequest;
import br.com.kjfleets.dto.PlaceDtos.PlaceResponse;
import br.com.kjfleets.service.PlaceService;
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
public class PlaceController {

    private final PlaceService service;

    public PlaceController(PlaceService service) {
        this.service = service;
    }

    @PostMapping("/places")
    @ResponseStatus(HttpStatus.CREATED)
    PlaceResponse create(@Valid @RequestBody PlaceRequest request) {
        return service.create(request);
    }

    @GetMapping("/places")
    PageResponse<PlaceResponse> list(@RequestParam(required = false) String q,
                                     @RequestParam(defaultValue = "false") boolean includeInactive,
                                     @RequestParam(required = false) Integer limit,
                                     @RequestParam(required = false) Integer offset, Authentication auth) {
        return service.list(q, includeInactive, limit, offset, auth);
    }

    @GetMapping("/places/{publicId}")
    PlaceResponse get(@PathVariable String publicId) {
        return service.get(publicId);
    }

    @PutMapping("/places/{publicId}")
    PlaceResponse update(@PathVariable String publicId, @Valid @RequestBody PlaceRequest request) {
        return service.update(publicId, request);
    }

    @PostMapping("/places/{publicId}/reactivate")
    PlaceResponse reactivate(@PathVariable String publicId) {
        return service.reactivate(publicId);
    }

    @DeleteMapping("/places/{publicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String publicId) {
        service.delete(publicId);
    }
}
