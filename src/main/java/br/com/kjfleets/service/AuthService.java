package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import br.com.kjfleets.dto.AuthDtos.CreateUserRequest;
import br.com.kjfleets.dto.AuthDtos.ChangePasswordRequest;
import br.com.kjfleets.dto.AuthDtos.LoginRequest;
import br.com.kjfleets.dto.AuthDtos.LoginResponse;
import br.com.kjfleets.dto.AuthDtos.MeResponse;
import br.com.kjfleets.dto.AuthDtos.RegisterRequest;
import br.com.kjfleets.dto.AuthDtos.RegisterResponse;
import br.com.kjfleets.dto.AuthDtos.UserResponse;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Customer;
import br.com.kjfleets.entity.PublicIds;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.AppUserRepository;
import br.com.kjfleets.repository.CustomerRepository;
import br.com.kjfleets.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String DUMMY_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5BcMtVqz3tqRlYwF1c8jZ9sJq2Q6a";

    private final AppUserRepository users;
    private final CustomerRepository customers;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final String adminUsername;
    private final String adminPassword;

    public AuthService(AppUserRepository users, CustomerRepository customers, PasswordEncoder encoder,
                       JwtService jwt,
                       @Value("${kjfleets.admin-username}") String adminUsername,
                       @Value("${kjfleets.admin-password}") String adminPassword) {
        this.users = users;
        this.customers = customers;
        this.encoder = encoder;
        this.jwt = jwt;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @EventListener(ApplicationStartedEvent.class)
    @Transactional
    public void createInitialAdmin() {
        if (users.count() > 0) {
            return;
        }
        if (adminUsername.isBlank() || adminPassword.isBlank()) {
            throw new IllegalStateException("Defina ADMIN_USERNAME e ADMIN_PASSWORD");
        }
        newUser(adminUsername, adminPassword, Role.ADMIN);
    }

    // usuários antigos ficaram sem publicId quando a coluna nasceu
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void backfillPublicIds() {
        users.findByPublicIdIsNull().forEach(u -> u.setPublicId(PublicIds.generate("usr")));
    }

    @Transactional(readOnly = true)
    public MeResponse me(String username) {
        AppUser user = users.findByUsername(username).orElseThrow();
        if (user.getRole() == Role.CUSTOMER) {
            Customer c = customers.findByUserUsername(username).orElseThrow();
            return new MeResponse(c.getPublicId(), username, user.getRole().name(), c.getName(), c.getEmail(),
                    c.getPhone());
        }
        return new MeResponse(user.getPublicId(), username, user.getRole().name(), null, null, null);
    }

    @Transactional
    public void changePassword(String username, ChangePasswordRequest request) {
        AppUser user = users.findByUsername(username).orElseThrow();
        if (!encoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "senha atual incorreta");
        }
        user.setPasswordHash(encoder.encode(request.newPassword()));
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        Customer customer = new Customer();
        customer.setUser(newUser(request.username(), request.password(), Role.CUSTOMER));
        customer.setName(request.name());
        customer.setPhone(request.phone());
        customer.setEmail(request.email());
        return RegisterResponse.from(customers.save(customer));
    }

    public LoginResponse login(LoginRequest request) {
        AppUser user = users.findByUsername(request.username().trim().toLowerCase()).orElse(null);
        // compara sempre contra um hash, senão o tempo de resposta revela se o usuário existe
        boolean passwordOk = encoder.matches(request.password(), user == null ? DUMMY_HASH : user.getPasswordHash());
        if (user == null || !passwordOk || !user.isActive() || user.getRole() == Role.DRIVER) {
            throw new BusinessException("UNAUTHORIZED", HttpStatus.UNAUTHORIZED, "Usuário ou senha inválidos");
        }
        String token = jwt.generate(user);
        return new LoginResponse(token, user.getRole(), jwt.expiresAt(token));
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (request.role() == Role.CUSTOMER || request.role() == Role.DRIVER) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST,
                    "role: CUSTOMER e DRIVER têm cadastro próprio");
        }
        return UserResponse.from(newUser(request.username(), request.password(), request.role()));
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> listUsers(Integer limit, Integer offset) {
        Pageable pageable = PageResponse.pageable(limit, offset);
        return PageResponse.of(users.findAllByOrderByUsernameAsc(pageable), UserResponse::from,
                pageable.getPageSize(), (int) pageable.getOffset());
    }

    @Transactional
    public AppUser newUser(String username, String rawPassword, Role role) {
        String normalized = username.trim().toLowerCase();
        if (users.existsByUsername(normalized)) {
            throw BusinessException.conflict("USERNAME_TAKEN", "Username já está em uso");
        }
        AppUser user = new AppUser();
        user.setUsername(normalized);
        user.setPasswordHash(encoder.encode(rawPassword));
        user.setRole(role);
        return users.save(user);
    }
}
