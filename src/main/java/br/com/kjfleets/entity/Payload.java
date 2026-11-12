package br.com.kjfleets.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "payloads")
@Getter
@Setter
@NoArgsConstructor
public class Payload {

    @Id
    @GeneratedValue
    private UUID id;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private Order order;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Place pickup;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Place dropoff;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "payload_waypoints",
            joinColumns = @JoinColumn(name = "payload_id"),
            inverseJoinColumns = @JoinColumn(name = "place_id"))
    @OrderColumn(name = "position")
    @BatchSize(size = 100)
    private List<Place> waypoints = new ArrayList<>();

    // unidirectional: @OrderColumn com mappedBy gera aviso do Hibernate; a FK fica em payload_items
    @OneToMany(cascade = CascadeType.ALL)
    @JoinColumn(name = "payload_id")
    @OrderColumn(name = "position")
    @BatchSize(size = 100)
    private List<PayloadItem> items = new ArrayList<>();
}
