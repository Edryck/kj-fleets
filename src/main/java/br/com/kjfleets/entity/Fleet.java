package br.com.kjfleets.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "fleets")
@Getter
@Setter
@NoArgsConstructor
public class Fleet {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String publicId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private boolean active = true;

    // Fleet é o dono do join table: a lista lê driverCount de várias frotas sem N+1
    @ManyToMany
    @JoinTable(name = "driver_fleet", joinColumns = @JoinColumn(name = "fleet_id"),
            inverseJoinColumns = @JoinColumn(name = "driver_id"))
    @BatchSize(size = 100)
    private Set<Driver> drivers = new HashSet<>();

    @PrePersist
    void prePersist() {
        if (publicId == null) {
            publicId = PublicIds.generate("fleet");
        }
    }
}
