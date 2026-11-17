type Tone = "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "offline";
type Entry = [label: string, tone: Tone];

const ORDER: Record<string, Entry> = {
    CREATED: ["Criado", "neutral"],
    DISPATCHED: ["Despachado", "info"],
    DRIVER_ENROUTE: ["A caminho", "info"],
    ARRIVED: ["Chegou", "primary"],
    IN_PROGRESS: ["Em andamento", "primary"],
    COMPLETED: ["Concluído", "success"],
    CANCELLED: ["Cancelado", "danger"],
    FAILED: ["Falhou", "danger"],
};

const TABLES = {
    order: ORDER,
    funnel: {
        ...ORDER,
        UNASSIGNED: ["Sem motorista", "warning"],
        ASSIGNED: ["Atribuído", "neutral"],
    } as Record<string, Entry>,
    driver: {
        AVAILABLE: ["Disponível", "success"],
        BUSY: ["Ocupado", "warning"],
        OFFLINE: ["Offline", "offline"],
    } as Record<string, Entry>,
    vehicle: {
        AVAILABLE: ["Disponível", "success"],
        IN_USE: ["Em uso", "info"],
        MAINTENANCE: ["Manutenção", "warning"],
    } as Record<string, Entry>,
    stop: {
        START: ["Posição inicial", "neutral"],
        PICKUP: ["Retirada", "neutral"],
        WAYPOINT: ["Parada", "neutral"],
        DROPOFF: ["Entrega", "neutral"],
    } as Record<string, Entry>,
    severity: {
        LOW: ["Baixa", "info"],
        MEDIUM: ["Média", "warning"],
        HIGH: ["Alta", "danger"],
    } as Record<string, Entry>,
};

export type BadgeKind = keyof typeof TABLES;

export function badgeEntry(kind: BadgeKind, value: string): { label: string; tone: Tone } {
    const [label, tone] = TABLES[kind][value] ?? [value, "neutral" as Tone];
    return { label, tone };
}

export default function StatusBadge({ kind, value }: { kind: BadgeKind; value: string }) {
    const entry = TABLES[kind][value];
    const [label, tone] = entry ?? [value, "neutral" as Tone];
    return (
        <span className={`badge badge-${tone}`}>
            <span className="badge-dot" aria-hidden="true" />
            {label}
        </span>
    );
}
