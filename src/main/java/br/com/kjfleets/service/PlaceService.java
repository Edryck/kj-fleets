package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.dto.PlaceDtos.ContactDto;
import br.com.kjfleets.dto.PlaceDtos.PlaceRequest;
import br.com.kjfleets.dto.PlaceDtos.PlaceResponse;
import br.com.kjfleets.entity.Contact;
import br.com.kjfleets.entity.Place;
import br.com.kjfleets.repository.PlaceRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlaceService {

    private final PlaceRepository places;

    public PlaceService(PlaceRepository places) {
        this.places = places;
    }

    @Transactional
    public PlaceResponse create(PlaceRequest request) {
        Place place = new Place();
        apply(place, request);
        return PlaceResponse.from(places.save(place));
    }

    @Transactional(readOnly = true)
    public PageResponse<PlaceResponse> list(Integer limit, Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        return PageResponse.of(places.findByActiveTrueOrderByNameAscPublicIdAsc(pageable), PlaceResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public PlaceResponse get(String publicId) {
        return PlaceResponse.from(findActive(publicId));
    }

    @Transactional
    public PlaceResponse update(String publicId, PlaceRequest request) {
        Place place = findActive(publicId);
        apply(place, request);
        return PlaceResponse.from(place);
    }

    @Transactional
    public void delete(String publicId) {
        findActive(publicId).setActive(false);
    }

    private void apply(Place place, PlaceRequest request) {
        place.setName(request.name());
        place.setAddress(request.address());
        place.setLat(request.lat());
        place.setLng(request.lng());
        place.setContact(toContact(request.contact()));
    }

    private Contact toContact(ContactDto dto) {
        if (dto == null) {
            return null;
        }
        Contact contact = new Contact();
        contact.setName(dto.name());
        contact.setPhone(dto.phone());
        contact.setEmail(dto.email());
        return contact;
    }

    private Place findActive(String publicId) {
        return places.findByPublicIdAndActiveTrue(publicId)
                .orElseThrow(() -> BusinessException.notFound("Lugar"));
    }
}
