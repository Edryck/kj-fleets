package br.com.kjfleets.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "places", indexes = @Index(name = "idx_places_customer", columnList = "customer_id"))
@Getter
@Setter
@NoArgsConstructor
public class Place {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String publicId;

    @Column(nullable = false)
    private String name;

    private String address;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    @Column(nullable = false)
    private boolean active = true;

    // orphanRemoval: trocar ou tirar o contato na edição apaga a linha antiga
    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "contact_id")
    private Contact contact;

    // null = lugar compartilhado da equipe; preenchido = endereço particular do cliente
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @PrePersist
    void prePersist() {
        if (publicId == null) {
            publicId = PublicIds.generate("place");
        }
    }
}
