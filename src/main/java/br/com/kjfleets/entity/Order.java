package br.com.kjfleets.entity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "orders", indexes = {
        @Index(columnList = "status"),
        @Index(columnList = "created_at"),
        @Index(columnList = "finished_at"),
        @Index(columnList = "status, created_at"),
        @Index(columnList = "driver_id, finished_at")
})
@Getter
@Setter
@NoArgsConstructor
public class Order {

    private static final String TRACKING_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String publicId;

    @Column(nullable = false, unique = true)
    private String trackingNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.CREATED;

    @ManyToOne(fetch = FetchType.LAZY)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    private Driver driver;

    @ManyToOne(fetch = FetchType.LAZY)
    private Vehicle vehicle;

    @OneToOne(mappedBy = "order", cascade = CascadeType.ALL, optional = false, fetch = FetchType.LAZY)
    private Payload payload;

    @Column(nullable = false)
    private boolean podRequired;

    private String podValue;

    private Instant podAt;

    private String reason;

    @Column(length = 500)
    private String notes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> meta;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant dispatchedAt;

    private Instant finishedAt;

    @Version
    private Long version;

    @PrePersist
    void prePersist() {
        if (publicId == null) {
            publicId = PublicIds.generate("order");
        }
        if (trackingNumber == null) {
            trackingNumber = newTrackingNumber();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    private static String newTrackingNumber() {
        StringBuilder number = new StringBuilder("KJ");
        for (int i = 0; i < 8; i++) {
            number.append(TRACKING_ALPHABET.charAt(RANDOM.nextInt(TRACKING_ALPHABET.length())));
        }
        return number.toString();
    }
}
