package br.com.kjfleets.dto;

import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(@NotBlank String username, @Size(min = 8) @NotBlank String password,
                                  @NotBlank String name, String phone, @Email String email) {
    }

    public record RegisterResponse(String publicId, String username) {

        public static RegisterResponse from(Customer customer) {
            return new RegisterResponse(customer.getPublicId(), customer.getUser().getUsername());
        }
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }

    public record LoginResponse(String token, Role role, Instant expiresAt) {
    }

    public record CreateUserRequest(@NotBlank String username, @Size(min = 8) @NotBlank String password,
                                    @NotNull Role role) {
    }

    public record UserResponse(String username, Role role, boolean active) {

        public static UserResponse from(AppUser user) {
            return new UserResponse(user.getUsername(), user.getRole(), user.isActive());
        }
    }
}
