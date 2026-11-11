package br.com.kjfleets.config;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public BusinessException(String code, HttpStatus status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public static BusinessException notFound(String what) {
        return new BusinessException("NOT_FOUND", HttpStatus.NOT_FOUND, what + " não encontrado");
    }

    public static BusinessException conflict(String code, String message) {
        return new BusinessException(code, HttpStatus.CONFLICT, message);
    }

    public String code() {
        return code;
    }

    public HttpStatus status() {
        return status;
    }
}
