package br.com.kjfleets.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tracking_statuses", indexes = @Index(columnList = "order_id, created_at"))
@Getter
@Setter
@NoArgsConstructor
public class TrackingStatus {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Order order;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Column(nullable = false)
    private String code;

    private String details;

    private Double lat;

    private Double lng;

    @Column(nullable = false)
    private Instant createdAt;

    private String actorUsername;

    private String actorRole;

    public static TrackingStatus of(Order order, String code, String details, Double lat, Double lng,
                                    String actorUsername, String actorRole) {
        TrackingStatus tracking = new TrackingStatus();
        tracking.order = order;
        tracking.status = order.getStatus();
        tracking.code = code;
        tracking.details = details;
        tracking.lat = lat;
        tracking.lng = lng;
        tracking.createdAt = Instant.now();
        tracking.actorUsername = actorUsername;
        tracking.actorRole = actorRole;
        return tracking;
    }
}
