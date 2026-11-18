package br.com.kjfleets.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "vehicles")
@Getter
@Setter
@NoArgsConstructor
public class Vehicle {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String publicId;

    @Column(nullable = false, unique = true)
    private String plate;

    @Column(nullable = false)
    private String type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VehicleStatus status = VehicleStatus.AVAILABLE;

    @Column(nullable = false)
    private boolean active = true;
    @Column(length = 40)
    private String brand;
    @Column(length = 60)
    private String model;
    @Column(name = "model_year")
    private Integer modelYear;
    @Column(length = 20)
    private String color;
    @Column(name = "capacity_kg")
    private Integer capacityKg;
    @Column(name = "volume_m3", precision = 6, scale = 2)
    private BigDecimal volumeM3;
    @Column(name = "odometer_km")
    private Integer odometerKm;

    @PrePersist
    void prePersist() {
        if (publicId == null) {
            publicId = PublicIds.generate("vehicle");
        }
    }
}
