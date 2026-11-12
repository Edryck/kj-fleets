package br.com.kjfleets.security;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public record CurrentActor(String username, String role) {

    // sem autenticação (ou anônimo) o autor fica nulo
    public static CurrentActor get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return new CurrentActor(null, null);
        }
        // cada usuário tem um papel só, então a primeira authority já é o papel
        String role = auth.getAuthorities().stream().findFirst()
                .map(a -> a.getAuthority().replaceFirst("^ROLE_", "")).orElse(null);
        return new CurrentActor(auth.getName(), role);
    }
}
