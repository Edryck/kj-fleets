package br.com.kjfleets.repository;

import br.com.kjfleets.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// achado do teste de carga: sem índice, a lista de pedidos do cliente varria a tabela inteira e
// ficava mais lenta a cada pedido criado
class OrderIndexTest extends IntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void customerListingHasIndex() {
        List<String> indexes = jdbc.queryForList(
                "select indexdef from pg_indexes where tablename = 'orders'", String.class);
        assertThat(indexes).anyMatch(def -> def.contains("(customer_id, created_at)"));
    }
}
