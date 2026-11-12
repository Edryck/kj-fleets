package br.com.kjfleets.repository;

import br.com.kjfleets.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByUsername(String username);

    List<AppUser> findByPublicIdIsNull();

    boolean existsByUsername(String username);

    Page<AppUser> findAllByOrderByUsernameAsc(Pageable pageable);
}
