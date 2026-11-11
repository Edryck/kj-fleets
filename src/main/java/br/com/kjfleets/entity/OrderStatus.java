package br.com.kjfleets.entity;

public enum OrderStatus {
    CREATED,
    DISPATCHED,
    DRIVER_ENROUTE,
    ARRIVED,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED,
    FAILED;

    public boolean canGoTo(OrderStatus next) {
        return switch (this) {
            case CREATED -> next == DISPATCHED || next == CANCELLED;
            case DISPATCHED -> next == DRIVER_ENROUTE || next == CANCELLED;
            case DRIVER_ENROUTE -> next == ARRIVED || next == CANCELLED;
            case ARRIVED -> next == IN_PROGRESS || next == CANCELLED;
            case IN_PROGRESS -> next == COMPLETED || next == FAILED;
            case COMPLETED, CANCELLED, FAILED -> false;
        };
    }

    public boolean isActive() {
        return this == DISPATCHED || this == DRIVER_ENROUTE || this == ARRIVED || this == IN_PROGRESS;
    }

    public boolean isTerminal() {
        return this == COMPLETED || this == CANCELLED || this == FAILED;
    }
}
