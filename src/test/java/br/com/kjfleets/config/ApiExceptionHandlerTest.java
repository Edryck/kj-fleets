package br.com.kjfleets.config;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.dto.PageResponse;
import br.com.kjfleets.entity.PublicIds;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.context.support.WithMockUser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WithMockUser
class ApiExceptionHandlerTest extends IntegrationTest {

    @Test
    void businessExceptionKeepsCodeAndStatus() throws Exception {
        mvc.perform(get("/auth/test-probe/business"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLATE_TAKEN"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.timestamp").isString());
    }

    @Test
    void invalidFieldIs400() throws Exception {
        mvc.perform(post("/auth/test-probe/validate").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"lat\":91}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value(containsString("lat")));
    }

    @Test
    void malformedBodyIs400() throws Exception {
        mvc.perform(post("/auth/test-probe/validate").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{bad"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void unknownRouteIs404() throws Exception {
        mvc.perform(get("/nope"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unexpectedErrorIs500WithoutStack() throws Exception {
        String body = mvc.perform(get("/auth/test-probe/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains("Exception"));
    }

    @Test
    void wrongMethodIs405() throws Exception {
        mvc.perform(delete("/auth/test-probe/business").with(csrf()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void wrongMediaTypeIs415() throws Exception {
        mvc.perform(post("/auth/test-probe/validate").with(csrf())
                        .contentType(MediaType.TEXT_PLAIN).content("{\"lat\":1}"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void accessDeniedIsLeftToSecurityAnd403() throws Exception {
        mvc.perform(get("/auth/test-probe/denied"))
                .andExpect(status().isForbidden());
    }

    @Test
    void authenticationFailureIsLeftToSecurityAnd401() throws Exception {
        mvc.perform(get("/auth/test-probe/unauthenticated"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void writeKeepsUtf8AndIsoTimestamp() throws IOException {
        MockHttpServletResponse response = new MockHttpServletResponse();

        ApiExceptionHandler.write(response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "não autorizado");

        String body = response.getContentAsString(StandardCharsets.UTF_8);
        assertEquals("UTF-8", response.getCharacterEncoding());
        assertTrue(response.getContentType().startsWith(MediaType.APPLICATION_JSON_VALUE));
        assertTrue(body.contains("não autorizado"));
        assertTrue(Pattern.compile("\"timestamp\":\"\\d{4}-\\d{2}-\\d{2}T").matcher(body).find());
    }

    @Test
    void pageParamsAreBounded() {
        assertEquals(100, PageResponse.pageable(500, 0).getPageSize());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(BusinessException.class,
                () -> PageResponse.pageable(0, 0)).status());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(BusinessException.class,
                () -> PageResponse.pageable(20, -1)).status());
    }

    @Test
    void publicIdFormat() {
        assertTrue(PublicIds.generate("driver").matches("driver_[a-z0-9]{6}"));
    }
}
