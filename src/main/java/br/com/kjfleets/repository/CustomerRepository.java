package br.com.kjfleets.repository;

import br.com.kjfleets.entity.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    Optional<Customer> findByPublicId(String publicId);

    Optional<Customer> findByUserUsername(String username);

    Page<Customer> findAllByOrderByNameAscPublicIdAsc(Pageable pageable);

    @Query("""
            select c from Customer c
            where lower(c.name) like :pattern escape '\\' or lower(c.email) like :pattern escape '\\'
            order by c.name asc, c.publicId asc""")
    Page<Customer> search(@Param("pattern") String pattern, Pageable pageable);
}
