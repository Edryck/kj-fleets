package br.com.kjfleets.repository;

import br.com.kjfleets.IntegrationTest;
import br.com.kjfleets.entity.Order;
import br.com.kjfleets.entity.Payload;
import br.com.kjfleets.entity.Place;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.matchesPattern;

class OrderPersistenceTest extends IntegrationTest {

    @Autowired
    private OrderRepository orders;

    @Autowired
    private PlaceRepository places;

    @Autowired
    private TransactionTemplate tx;

    private Place newPlace(String label) {
        Place place = new Place();
        place.setName(label + "-" + UUID.randomUUID());
        place.setLat(-24.862);
        place.setLng(-54.337);
        return places.save(place);
    }

    private UUID saveOrder(Place pickup, Place dropoff, List<Place> waypoints, Map<String, Object> meta) {
        return tx.execute(status -> {
            Order order = new Order();
            order.setMeta(meta);
            Payload payload = new Payload();
            payload.setOrder(order);
            payload.setPickup(pickup);
            payload.setDropoff(dropoff);
            payload.setWaypoints(waypoints);
            order.setPayload(payload);
            return orders.save(order).getId();
        });
    }

    @Test
    void trackingNumberFormat() {
        Place pickup = newPlace("coleta");
        Place dropoff = newPlace("entrega");
        UUID id = saveOrder(pickup, dropoff, List.of(), null);

        tx.executeWithoutResult(status -> {
            Order order = orders.findById(id).orElseThrow();
            assertThat(order.getTrackingNumber(), matchesPattern("KJ[A-Z0-9]{8}"));
            assertThat(order.getPublicId(), matchesPattern("order_[a-z0-9]{6}"));
        });
    }

    @Test
    void metaRoundTrips() {
        Place pickup = newPlace("coleta");
        Place dropoff = newPlace("entrega");
        Map<String, Object> meta = Map.of("externalRef", "PED-991", "n", 3);
        UUID id = saveOrder(pickup, dropoff, List.of(), meta);

        tx.executeWithoutResult(status -> {
            Order order = orders.findById(id).orElseThrow();
            assertEquals(meta, order.getMeta());
        });
    }

    @Test
    void waypointsKeepOrder() {
        Place pickup = newPlace("coleta");
        Place dropoff = newPlace("entrega");
        Place a = newPlace("parada-a");
        Place b = newPlace("parada-b");
        Place c = newPlace("parada-c");
        UUID id = saveOrder(pickup, dropoff, List.of(a, b, c), null);

        tx.executeWithoutResult(status -> {
            Order order = orders.findById(id).orElseThrow();
            List<UUID> reloaded = order.getPayload().getWaypoints().stream().map(Place::getId).toList();
            assertEquals(List.of(a.getId(), b.getId(), c.getId()), reloaded);
            assertTrue(order.getPayload().getItems().isEmpty());
        });
    }
}
