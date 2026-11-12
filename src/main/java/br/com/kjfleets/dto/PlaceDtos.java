package br.com.kjfleets.dto;

import br.com.kjfleets.entity.Contact;
import br.com.kjfleets.entity.Place;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class PlaceDtos {

    private PlaceDtos() {
    }

    public record ContactDto(@NotBlank String name, String phone, @Email String email) {

        public static ContactDto from(Contact contact) {
            return new ContactDto(contact.getName(), contact.getPhone(), contact.getEmail());
        }
    }

    public record PlaceRequest(@NotBlank String name, String address,
                               @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
                               @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
                               @Valid ContactDto contact) {
    }

    public record PlaceResponse(String publicId, String name, String address, double lat, double lng,
                                ContactDto contact, boolean active) {

        public static PlaceResponse from(Place place) {
            ContactDto contact = place.getContact() == null ? null : ContactDto.from(place.getContact());
            return new PlaceResponse(place.getPublicId(), place.getName(), place.getAddress(), place.getLat(),
                    place.getLng(), contact, place.isActive());
        }
    }
}
