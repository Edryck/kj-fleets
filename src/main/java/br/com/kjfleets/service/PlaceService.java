package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.dto.PlaceDtos.ContactDto;
import br.com.kjfleets.dto.PlaceDtos.PlaceRequest;
import br.com.kjfleets.dto.PlaceDtos.PlaceResponse;
import br.com.kjfleets.entity.Contact;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.entity.OrderStatus;
import br.com.kjfleets.entity.Place;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.repository.PlaceRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class PlaceService {

    private final PlaceRepository places;
    private final CustomerRepository customers;

    public PlaceService(PlaceRepository places, CustomerRepository customers) {
        this.places = places;
        this.customers = customers;
    }

    // owner null = lugares compartilhados da equipe; senão só os do cliente
    public Customer ownerOf(Authentication auth) {
        return customers.findByUserUsername(auth.getName()).orElseThrow(() -> BusinessException.notFound("Cliente"));
    }

    @Transactional
    public PlaceResponse create(PlaceRequest request, Customer owner) {
        Place place = new Place();
        place.setCustomer(owner);
        apply(place, request);
        return PlaceResponse.from(places.save(place));
    }

    @Transactional(readOnly = true)
    public PageResponse<PlaceResponse> list(String q, boolean includeInactive, Integer limit, Integer offset,
                                            Authentication auth, Customer owner) {
        if (owner == null) {
            Search.requireWriterForInactive(includeInactive, auth, "ADMIN", "DISPATCHER");
        }
        Pageable pageable = PageResponse.pageable(limit, offset);
        String pattern = Search.pattern(q);
        Specification<Place> matching = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(owner == null ? cb.isNull(root.get("customer")) : cb.equal(root.get("customer"), owner));
            if (!includeInactive) {
                predicates.add(cb.isTrue(root.get("active")));
            }
            if (pattern != null) {
                predicates.add(cb.or(cb.like(cb.lower(root.get("name")), pattern, '\\'),
                        cb.like(cb.lower(root.get("address")), pattern, '\\')));
            }
            // count não aceita ORDER BY sem GROUP BY no Postgres
            if (query.getResultType() != Long.class) {
                query.orderBy(cb.asc(root.get("name")), cb.asc(root.get("publicId")));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return PageResponse.of(places.findAll(matching, pageable), PlaceResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional(readOnly = true)
    public PlaceResponse get(String publicId, Customer owner) {
        return PlaceResponse.from(findActive(publicId, owner));
    }

    @Transactional
    public PlaceResponse update(String publicId, PlaceRequest request, Customer owner) {
        Place place = findActive(publicId, owner);
        if (owner != null && places.usedByOpenOrder(place, List.of(OrderStatus.COMPLETED, OrderStatus.FAILED,
                OrderStatus.CANCELLED))) {
            throw BusinessException.conflict("RESOURCE_IN_USE", "Lugar usado em pedido em andamento não pode ser editado");
        }
        apply(place, request);
        return PlaceResponse.from(place);
    }

    @Transactional
    public PlaceResponse reactivate(String publicId) {
        Place place = places.findByPublicId(publicId).filter(found -> found.getCustomer() == null)
                .orElseThrow(() -> BusinessException.notFound("Lugar"));
        place.setActive(true);
        return PlaceResponse.from(place);
    }

    @Transactional
    public void delete(String publicId, Customer owner) {
        findActive(publicId, owner).setActive(false);
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

    private Place findActive(String publicId, Customer owner) {
        return places.findByPublicIdAndActiveTrue(publicId)
                .filter(found -> owner == null ? found.getCustomer() == null
                        : found.getCustomer() != null && found.getCustomer().getId().equals(owner.getId()))
                .orElseThrow(() -> BusinessException.notFound("Lugar"));
    }
}
