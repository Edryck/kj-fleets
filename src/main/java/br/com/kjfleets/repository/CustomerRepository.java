package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    Optional<Customer> findByPublicId(String publicId);

    Optional<Customer> findByUserUsername(String username);

    Page<Customer> findAllByOrderByNameAscPublicIdAsc(Pageable pageable);

    Page<Customer> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrderByNameAscPublicIdAsc(
            String name, String email, Pageable pageable);
}
