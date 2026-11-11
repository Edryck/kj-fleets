package br.com.kjfleets.security;

import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final AppUserRepository users;

    public JwtFilter(JwtService jwt, AppUserRepository users) {
        this.jwt = jwt;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            // consulta o banco a cada request para desativação valer na hora
            jwt.username(header.substring(7))
                    .flatMap(users::findByUsername)
                    .filter(AppUser::isActive)
                    .filter(user -> user.getRole() != Role.DRIVER)
                    .ifPresent(user -> SecurityContextHolder.getContext().setAuthentication(
                            UsernamePasswordAuthenticationToken.authenticated(user.getUsername(), null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole())))));
        }
        chain.doFilter(request, response);
    }
}
