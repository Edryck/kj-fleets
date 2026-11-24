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

    public record RegisterRequest(@NotBlank @Size(max = 50) String username, @Size(min = 8, max = 72) @NotBlank String password,
                                  @NotBlank @Size(max = 120) String name, @Size(max = 30) String phone,
                                  @Email @Size(max = 254) String email) {
    }

    public record RegisterResponse(String publicId, String username) {

        public static RegisterResponse from(Customer customer) {
            return new RegisterResponse(customer.getPublicId(), customer.getUser().getUsername());
        }
    }

    public record LoginRequest(@NotBlank @Size(max = 255) String username, @NotBlank @Size(max = 255) String password) {
    }

    public record LoginResponse(String token, Role role, Instant expiresAt) {
    }

    public record CreateUserRequest(@NotBlank @Size(max = 50) String username, @Size(min = 8, max = 72) @NotBlank String password,
                                    @NotNull Role role) {
    }

    public record UpdateUserRequest(@NotNull Role role) {
    }

    public record MeResponse(String publicId, String username, String role, String name, String email,
                             String phone) {
    }

    public record ChangePasswordRequest(@NotBlank @Size(max = 255) String currentPassword, @NotBlank @Size(min = 8, max = 72) String newPassword) {
    }

    public record UserResponse(String publicId, String username, Role role, boolean active) {

        public static UserResponse from(AppUser user) {
            return new UserResponse(user.getPublicId(), user.getUsername(), user.getRole(), user.isActive());
        }
    }
}
