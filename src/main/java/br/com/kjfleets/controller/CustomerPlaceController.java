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
public class CustomerPlaceController {

    private final PlaceService service;

    public CustomerPlaceController(PlaceService service) {
        this.service = service;
    }

    @PostMapping("/customer/places")
    @ResponseStatus(HttpStatus.CREATED)
    PlaceResponse create(@Valid @RequestBody PlaceRequest request, Authentication auth) {
        return service.create(request, service.ownerOf(auth));
    }

    @GetMapping("/customer/places")
    PageResponse<PlaceResponse> list(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) Integer limit,
                                     @RequestParam(required = false) Integer offset, Authentication auth) {
        return service.list(q, false, limit, offset, auth, service.ownerOf(auth));
    }

    @GetMapping("/customer/places/{publicId}")
    PlaceResponse get(@PathVariable String publicId, Authentication auth) {
        return service.get(publicId, service.ownerOf(auth));
    }

    @PutMapping("/customer/places/{publicId}")
    PlaceResponse update(@PathVariable String publicId, @Valid @RequestBody PlaceRequest request,
                         Authentication auth) {
        return service.update(publicId, request, service.ownerOf(auth));
    }

    @DeleteMapping("/customer/places/{publicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String publicId, Authentication auth) {
        service.delete(publicId, service.ownerOf(auth));
    }
}
