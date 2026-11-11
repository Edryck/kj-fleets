package br.com.kjfleets.entity;

import org.junit.jupiter.api.Test;

import static br.com.kjfleets.entity.OrderStatus.*;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderStatusTest {

    @Test
    void allowedTransitions() {
        assertTrue(CREATED.canGoTo(DISPATCHED));
        assertTrue(DISPATCHED.canGoTo(DRIVER_ENROUTE));
        assertTrue(DRIVER_ENROUTE.canGoTo(ARRIVED));
        assertTrue(ARRIVED.canGoTo(IN_PROGRESS));
        assertTrue(IN_PROGRESS.canGoTo(COMPLETED));
        assertTrue(IN_PROGRESS.canGoTo(FAILED));
        assertTrue(CREATED.canGoTo(CANCELLED));
        assertTrue(DISPATCHED.canGoTo(CANCELLED));
        assertTrue(DRIVER_ENROUTE.canGoTo(CANCELLED));
        assertTrue(ARRIVED.canGoTo(CANCELLED));
    }

    @Test
    void forbiddenTransitions() {
        assertFalse(CREATED.canGoTo(IN_PROGRESS));
        assertFalse(IN_PROGRESS.canGoTo(CANCELLED));
        assertFalse(DISPATCHED.canGoTo(ARRIVED));
        for (OrderStatus next : OrderStatus.values()) {
            assertFalse(COMPLETED.canGoTo(next));
            assertFalse(CANCELLED.canGoTo(next));
            assertFalse(FAILED.canGoTo(next));
        }
    }

    @Test
    void activeAndTerminal() {
        assertFalse(CREATED.isActive());
        assertTrue(DISPATCHED.isActive());
        assertTrue(DRIVER_ENROUTE.isActive());
        assertTrue(ARRIVED.isActive());
        assertTrue(IN_PROGRESS.isActive());
        assertFalse(COMPLETED.isActive());
        assertFalse(CANCELLED.isActive());
        assertFalse(FAILED.isActive());

        assertFalse(CREATED.isTerminal());
        assertFalse(IN_PROGRESS.isTerminal());
        assertTrue(COMPLETED.isTerminal());
        assertTrue(CANCELLED.isTerminal());
        assertTrue(FAILED.isTerminal());
    }
}
