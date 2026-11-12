package br.com.kjfleets.service;

import br.com.kjfleets.config.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

import java.util.Arrays;

final class Search {

    private Search() {
    }

    // null quando q não foi informada; senão o padrão LIKE minúsculo com %, _ e \ escapados (match literal)
    static String pattern(String q) {
        String trimmed = q == null ? "" : q.trim();
        if (trimmed.length() > 100) {
            throw new BusinessException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, "q deve ter até 100 caracteres");
        }
        if (trimmed.isEmpty()) {
            return null;
        }
        return "%" + trimmed.toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    static void requireWriterForInactive(boolean includeInactive, Authentication auth, String... roles) {
        if (includeInactive && Arrays.stream(roles)
                .noneMatch(role -> auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role)))) {
            throw new BusinessException("FORBIDDEN", HttpStatus.FORBIDDEN, "Sem permissão");
        }
    }
}
