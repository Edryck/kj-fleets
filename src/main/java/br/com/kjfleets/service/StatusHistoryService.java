package br.com.kjfleets.service;

import br.com.kjfleets.entity.StatusChange;
import br.com.kjfleets.entity.StatusSubject;
import br.com.kjfleets.repository.StatusChangeRepository;
import br.com.kjfleets.security.CurrentActor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class StatusHistoryService {

    private final StatusChangeRepository changes;
    private final JdbcTemplate jdbc;

    public StatusHistoryService(StatusChangeRepository changes, JdbcTemplate jdbc) {
        this.changes = changes;
        this.jdbc = jdbc;
    }

    public void record(StatusSubject type, UUID id, String from, String to, String reason) {
        record(type, id, from, to, reason, false);
    }

    // force existe pro delete: o status não muda, mas a saída do sujeito precisa aparecer no histórico
    public void record(StatusSubject type, UUID id, String from, String to, String reason, boolean force) {
        if (!force && to.equals(from)) {
            return;
        }
        StatusChange change = new StatusChange();
        change.setSubjectType(type);
        change.setSubjectId(id);
        change.setFromStatus(from);
        change.setToStatus(to);
        change.setChangedAt(Instant.now());
        String username = CurrentActor.get().username();
        change.setChangedBy(username == null ? "system" : username);
        change.setReason(reason);
        changes.save(change);
    }

    // quem já existia antes do histórico ganha uma linha com o status atual
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void baseline() {
        for (StatusSubject type : StatusSubject.values()) {
            String table = type == StatusSubject.DRIVER ? "drivers" : "vehicles";
            jdbc.update("""
                    INSERT INTO status_changes (id, subject_type, subject_id, from_status, to_status, changed_at,
                                                changed_by, reason)
                    SELECT gen_random_uuid(), ?, s.id, NULL, s.status, now(), 'system', 'baseline'
                    FROM %s s
                    WHERE NOT EXISTS (SELECT 1 FROM status_changes c WHERE c.subject_type = ? AND c.subject_id = s.id)
                    """.formatted(table), type.name(), type.name());
        }
    }
}
