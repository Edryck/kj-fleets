package br.com.kjfleets.dto;

import org.springframework.http.HttpStatus;

import java.time.Instant;

public record ErrorResponse(int status, String code, String message, Instant timestamp) {

    public static ErrorResponse of(HttpStatus status, String code, String message) {
        return new ErrorResponse(status.value(), code, message, Instant.now());
    }
}
