package br.com.kjfleets.repository;

import br.com.kjfleets.entity.AppUser;
import br.com.kjfleets.entity.Role;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByUsername(String username);

    List<AppUser> findByPublicIdIsNull();

    Optional<AppUser> findByPublicId(String publicId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<AppUser> findByRoleAndActiveTrueOrderById(Role role);

    boolean existsByUsername(String username);

    Page<AppUser> findAllByOrderByUsernameAsc(Pageable pageable);
}
