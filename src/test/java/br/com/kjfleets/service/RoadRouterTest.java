package br.com.kjfleets.service;

import br.com.kjfleets.config.RoutingProperties;
import br.com.kjfleets.config.RoutingProperties.Mode;
import br.com.kjfleets.service.RoadRouter.RoadPath;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RoadRouterTest {

    @TempDir
    static Path cache;
    static RoadRouter router;

    private static RoadRouter newRouter(String osmFile, Path graphDir) {
        return new RoadRouter(new RoutingProperties(Mode.ROAD, 1.3, 40, 200, 300, osmFile, graphDir.toString()));
    }

    @BeforeAll
    static void loadFixture() {
        router = newRouter("src/test/resources/osm/fixture.osm", cache);
        router.load();
    }

    @Test
    void routeBetweenTwoStreets() {
        Optional<RoadPath> path = router.route(-24.8600, -54.3300, -24.8660, -54.3210);
        assertTrue(path.isPresent());
        assertTrue(path.get().meters() > 0);
        assertTrue(path.get().points().size() >= 2);
    }

    @Test
    void noPathReturnsEmpty() {
        // ilha existe no mapa mas não liga com a malha; ponto distante cai na regra de 500 m
        assertTrue(router.route(-24.8600, -54.3300, -24.8600, -54.2970).isEmpty());
        assertTrue(router.route(-24.8600, -54.3300, -25.5163, -54.5854).isEmpty());
    }

    @Test
    void footwayOnlyPointReturnsEmpty() {
        assertTrue(router.route(-24.8600, -54.3300, -24.8700, -54.2785).isEmpty());
    }

    @Test
    void statusBeforeAndAfterLoad(@TempDir Path dir) {
        RoadRouter fresh = newRouter("src/test/resources/osm/fixture.osm", dir);
        assertFalse(fresh.status().loaded());
        assertEquals("importando", fresh.status().reason());
        assertTrue(fresh.route(-24.8600, -54.3300, -24.8660, -54.3210).isEmpty());

        fresh.load();
        assertTrue(fresh.status().loaded());
        assertNull(fresh.status().reason());
        assertNotNull(fresh.status().importedAt());
        assertTrue(fresh.status().nodes() > 0 && fresh.status().edges() > 0);
    }

    @Test
    void missingFileReportsError(@TempDir Path dir) {
        RoadRouter broken = newRouter("nao-existe.osm.pbf", dir.resolve("cache"));
        broken.load();
        assertFalse(broken.status().loaded());
        assertTrue(broken.status().reason().startsWith("erro"));
    }
}
