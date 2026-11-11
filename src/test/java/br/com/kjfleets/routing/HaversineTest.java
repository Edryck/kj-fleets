package br.com.kjfleets.routing;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HaversineTest {

    @Test
    void saoPauloToRio() {
        assertEquals(360.75, Haversine.km(-23.5505, -46.6333, -22.9068, -43.1729), 0.1);
    }

    @Test
    void samePointIsZero() {
        assertEquals(0.0, Haversine.km(-24.862, -54.337, -24.862, -54.337), 1e-9);
    }
}
