package br.com.kjfleets.repository;

import br.com.kjfleets.entity.StatusChange;
import br.com.kjfleets.entity.StatusSubject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StatusChangeRepository extends JpaRepository<StatusChange, UUID> {

    List<StatusChange> findBySubjectTypeAndSubjectIdOrderByChangedAtAscIdAsc(StatusSubject subjectType,
                                                                             UUID subjectId);
}
