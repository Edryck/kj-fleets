package br.com.kjfleets;

import br.com.kjfleets.service.RoadRouter;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

// modo road com o mapa sintético; nunca o arquivo real da região Sul
@TestPropertySource(properties = {
        "kjfleets.routing.mode=road",
        "kjfleets.routing.osm-file=src/test/resources/osm/fixture.osm",
        "kjfleets.routing.graph-dir=target/graph-cache-fixture"})
public abstract class RoadFixtureTest extends IntegrationTest {

    @Autowired
    protected RoadRouter router;

    // o import roda em thread própria depois do startup
    @BeforeEach
    void waitForGraph() throws InterruptedException {
        for (int i = 0; i < 600 && !router.status().loaded(); i++) {
            Thread.sleep(100);
        }
    }
}
