package br.com.kjfleets.controller;

import br.com.kjfleets.IntegrationTest;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

class CorsDefaultTest extends IntegrationTest {

    @Test
    void corsEmptyByDefault() throws Exception {
        mvc.perform(options("/orders").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
