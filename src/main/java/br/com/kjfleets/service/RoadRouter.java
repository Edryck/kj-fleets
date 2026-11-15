package br.com.kjfleets.service;

import br.com.kjfleets.config.RoutingProperties;
import com.graphhopper.GHRequest;
import com.graphhopper.GHResponse;
import com.graphhopper.GraphHopper;
import com.graphhopper.config.CHProfile;
import com.graphhopper.config.Profile;
import com.graphhopper.routing.ev.BooleanEncodedValue;
import com.graphhopper.routing.util.EdgeFilter;
import com.graphhopper.storage.index.Snap;
import com.graphhopper.util.GHUtility;
import com.graphhopper.util.PointList;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "kjfleets.routing.mode", havingValue = "road")
public class RoadRouter {

    private static final Logger log = LoggerFactory.getLogger(RoadRouter.class);
    private static final double MAX_SNAP_M = 500;

    public record RoadPath(double meters, long millis, List<double[]> points) {
    }

    public record GraphStatus(boolean loaded, String osmFile, long nodes, long edges, Instant importedAt,
                              long loadMillis, String reason) {
    }

    private final RoutingProperties props;
    private volatile GraphHopper hopper;
    private volatile GraphStatus status;

    public RoadRouter(RoutingProperties props) {
        this.props = props;
        this.status = new GraphStatus(false, props.osmFile(), 0, 0, null, 0, "importando");
    }

    // thread própria: o import da região Sul leva minutos e a API não pode esperar
    @EventListener(ApplicationReadyEvent.class)
    void startInBackground() {
        Thread.ofPlatform().daemon().name("graph-import").start(this::load);
    }

    public synchronized void load() {
        long start = System.currentTimeMillis();
        GraphHopper gh = new GraphHopper();
        try {
            gh.setOSMFile(props.osmFile());
            gh.setGraphHopperLocation(props.graphDir());
            gh.setEncodedValuesString("car_access, car_average_speed, road_access, max_speed, road_class, road_environment");
            gh.setProfiles(new Profile("car").setCustomModel(GHUtility.loadCustomModelFromJar("car.json")));
            gh.getCHPreparationHandler().setCHProfiles(new CHProfile("car"));
            if (!new File(props.graphDir()).isDirectory() && !new File(props.osmFile()).isFile()) {
                throw new IllegalStateException("arquivo OSM não encontrado: " + props.osmFile());
            }
            gh.importOrLoad();
            long took = System.currentTimeMillis() - start;
            GraphHopper old = hopper;
            hopper = gh;
            if (old != null) {
                old.close();
            }
            status = new GraphStatus(true, props.osmFile(), gh.getBaseGraph().getNodes(),
                    gh.getBaseGraph().getEdges(), Instant.now(), took, null);
            log.info("Grafo viário pronto em {} ms", took);
        } catch (Throwable e) {
            gh.close();
            log.warn("Grafo viário indisponível: {}", e.getMessage());
            status = new GraphStatus(false, props.osmFile(), 0, 0, null, 0, "erro: " + e.getMessage());
        }
    }

    public GraphStatus status() {
        return status;
    }

    public Optional<RoadPath> route(double lat1, double lng1, double lat2, double lng2) {
        GraphHopper gh = hopper;
        if (gh == null || !snaps(gh, lat1, lng1) || !snaps(gh, lat2, lng2)) {
            return Optional.empty();
        }
        GHResponse response = gh.route(new GHRequest(lat1, lng1, lat2, lng2).setProfile("car"));
        if (response.hasErrors()) {
            return Optional.empty();
        }
        PointList pl = response.getBest().getPoints();
        List<double[]> points = new ArrayList<>(pl.size());
        for (int i = 0; i < pl.size(); i++) {
            points.add(new double[]{pl.getLat(i), pl.getLon(i)});
        }
        return Optional.of(new RoadPath(response.getBest().getDistance(), response.getBest().getTime(), points));
    }

    private static boolean snaps(GraphHopper gh, double lat, double lng) {
        BooleanEncodedValue carAccess = gh.getEncodingManager().getBooleanEncodedValue("car_access");
        EdgeFilter carRoads = edge -> edge.get(carAccess) || edge.getReverse(carAccess);
        Snap snap = gh.getLocationIndex().findClosest(lat, lng, carRoads);
        return snap.isValid() && snap.getQueryDistance() <= MAX_SNAP_M;
    }

    @PreDestroy
    void close() {
        if (hopper != null) {
            hopper.close();
        }
    }
}
