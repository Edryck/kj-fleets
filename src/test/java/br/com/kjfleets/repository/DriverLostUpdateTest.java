package br.com.kjfleets.repository;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Driver;
import br.com.kjfleets.entity.DriverStatus;
import br.com.kjfleets.entity.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

// achado da simulação: um ping de posição que lê o motorista antes da entrega e grava depois sobrescrevia o
// status (BUSY antigo por cima do AVAILABLE da entrega), e o motorista ficava preso como ocupado
class DriverLostUpdateTest extends IntegrationTest {

    @Autowired
    private DriverRepository drivers;

    @Autowired
    private PlatformTransactionManager txManager;

    @Test
    void locationUpdateDoesNotOverwriteConcurrentStatusChange() throws Exception {
        String username = "lu" + UUID.randomUUID().toString().substring(0, 8);
        String created = mvc.perform(post("/drivers").header("Authorization", bearer(Role.FLEET_MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("username", username, "password", "password-123",
                                "name", "Corrida"))))
                .andReturn().getResponse().getContentAsString();
        String publicId = json.readTree(created).get("publicId").asString();
        TransactionTemplate outer = new TransactionTemplate(txManager);
        TransactionTemplate inner = new TransactionTemplate(txManager);
        inner.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        outer.executeWithoutResult(t -> {
            Driver stale = drivers.findByUserUsernameAndActiveTrue(username).orElseThrow();
            assertThat(stale.getStatus()).isEqualTo(DriverStatus.OFFLINE);
            // outra requisição muda o status e confirma enquanto esta ainda está aberta
            inner.executeWithoutResult(t2 -> drivers.findByUserUsernameAndActiveTrue(username).orElseThrow()
                    .setStatus(DriverStatus.AVAILABLE));
            stale.setLat(-25.43);
            stale.setLng(-49.27);
        });

        Driver after = drivers.findByUserUsernameAndActiveTrue(username).orElseThrow();
        assertThat(after.getPublicId()).isEqualTo(publicId);
        assertThat(after.getLat()).isEqualTo(-25.43);
        assertThat(after.getStatus()).isEqualTo(DriverStatus.AVAILABLE);
    }
}
