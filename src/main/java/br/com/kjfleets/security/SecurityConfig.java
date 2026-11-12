package br.com.kjfleets.security;

import br.com.kjfleets.config.ApiExceptionHandler;
import br.com.kjfleets.entity.Role;
import br.com.kjfleets.repository.AppUserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationEntryPoint entryPoint() {
        return (request, response, e) ->
                ApiExceptionHandler.write(response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Não autenticado");
    }

    @Bean
    AccessDeniedHandler accessDeniedHandler() {
        return (request, response, e) ->
                ApiExceptionHandler.write(response, HttpStatus.FORBIDDEN, "FORBIDDEN", "Sem permissão");
    }

    // só aceita motorista ativo; qualquer outro papel cai como credencial inválida
    @Bean
    DaoAuthenticationProvider driverAuthProvider(AppUserRepository users, PasswordEncoder encoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(username -> users.findByUsername(username)
                .filter(u -> u.isActive() && u.getRole() == Role.DRIVER)
                .map(u -> User.withUsername(u.getUsername()).password(u.getPasswordHash()).roles("DRIVER").build())
                .orElseThrow(() -> new UsernameNotFoundException(
                        "motorista não encontrado")));
        provider.setPasswordEncoder(encoder);
        return provider;
    }

    @Bean
    @Order(1)
    SecurityFilterChain driverChain(HttpSecurity http, DaoAuthenticationProvider driverAuthProvider,
                                    AuthenticationEntryPoint entryPoint, AccessDeniedHandler deniedHandler) {
        return http
                .securityMatcher("/driver/**")
                .authenticationProvider(driverAuthProvider)
                .httpBasic(basic -> basic.authenticationEntryPoint(entryPoint))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable())
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> auth.anyRequest().hasRole("DRIVER"))
                .build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain apiChain(HttpSecurity http, JwtService jwt, AppUserRepository users,
                                 AuthenticationEntryPoint entryPoint, AccessDeniedHandler deniedHandler) {
        return http
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .addFilterBefore(new JwtFilter(jwt, users), UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/**", "/track/**").permitAll()
                        .requestMatchers("/users/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/drivers/**", "/vehicles/**", "/fleets/**", "/places/**")
                        .hasAnyRole("ADMIN", "DISPATCHER", "FLEET_MANAGER")
                        .requestMatchers("/drivers/**", "/vehicles/**", "/fleets/**").hasAnyRole("ADMIN", "FLEET_MANAGER")
                        .requestMatchers("/places/**").hasAnyRole("ADMIN", "DISPATCHER")
                        .requestMatchers(HttpMethod.POST, "/orders").hasAnyRole("ADMIN", "DISPATCHER", "CUSTOMER")
                        .requestMatchers(HttpMethod.GET, "/orders/*/route")
                        .hasAnyRole("ADMIN", "DISPATCHER", "FLEET_MANAGER")
                        .requestMatchers(HttpMethod.POST, "/orders/*/route").hasAnyRole("ADMIN", "DISPATCHER")
                        .requestMatchers(HttpMethod.GET, "/orders/**")
                        .hasAnyRole("ADMIN", "DISPATCHER", "FLEET_MANAGER", "CUSTOMER")
                        .requestMatchers(HttpMethod.POST, "/orders/*/cancel").hasAnyRole("ADMIN", "DISPATCHER", "CUSTOMER")
                        .requestMatchers("/orders/**", "/dispatch/**").hasAnyRole("ADMIN", "DISPATCHER")
                        .requestMatchers(HttpMethod.GET, "/customers/**").hasAnyRole("ADMIN", "DISPATCHER", "FLEET_MANAGER")
                        .anyRequest().authenticated())
                .build();
    }
}
