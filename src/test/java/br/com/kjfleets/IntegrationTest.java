package br.com.kjfleets;

import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.AppUserRepository;
import br.com.kjfleets.security.JwtService;
import br.com.kjfleets.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

    // sobe uma vez só e é reaproveitado por todas as classes de teste
    static {
        POSTGRES.start();
    }

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    @Autowired
    protected AuthService authService;

    @Autowired
    protected AppUserRepository userRepository;

    @Autowired
    protected JwtService jwtService;

    protected String tokenFor(Role role) {
        String username = role.name().toLowerCase() + "-user";
        var user = userRepository.findByUsername(username)
                .orElseGet(() -> authService.newUser(username, "password-123", role));
        return jwtService.generate(user);
    }

    protected String bearer(Role role) {
        return "Bearer " + tokenFor(role);
    }
}
