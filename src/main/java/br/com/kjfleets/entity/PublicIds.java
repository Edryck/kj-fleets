package br.com.kjfleets.entity;

import java.security.SecureRandom;

public final class PublicIds {

    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private PublicIds() {
    }

    public static String generate(String prefix) {
        StringBuilder id = new StringBuilder(prefix).append('_');
        for (int i = 0; i < 6; i++) {
            id.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return id.toString();
    }
}
