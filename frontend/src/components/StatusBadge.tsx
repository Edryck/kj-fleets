import {
    Ban,
    CheckCircle2,
    CircleDashed,
    CircleSlash,
    Clock,
    Flag,
    MapPinCheck,
    Navigation,
    PackageCheck,
    Send,
    TriangleAlert,
    Truck,
    Wrench,
    XCircle,
    type LucideIcon,
} from "lucide-react";

type Tone = "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "offline";
type Entry = [label: string, tone: Tone, icon: LucideIcon];

const ORDER: Record<string, Entry> = {
    CREATED: ["Criado", "neutral", CircleDashed],
    DISPATCHED: ["Despachado", "info", Send],
    DRIVER_ENROUTE: ["A caminho", "info", Navigation],
    ARRIVED: ["Chegou", "primary", MapPinCheck],
    IN_PROGRESS: ["Em andamento", "primary", Truck],
    COMPLETED: ["Concluído", "success", CheckCircle2],
    CANCELLED: ["Cancelado", "danger", Ban],
    FAILED: ["Falhou", "danger", XCircle],
};

const TABLES = {
    order: ORDER,
    // funil: UNASSIGNED/ASSIGNED além dos estados do pedido
    funnel: {
        ...ORDER,
        UNASSIGNED: ["Sem motorista", "warning", Clock],
        ASSIGNED: ["Atribuído", "neutral", PackageCheck],
    } as Record<string, Entry>,
    driver: {
        AVAILABLE: ["Disponível", "success", CheckCircle2],
        BUSY: ["Ocupado", "warning", Truck],
        OFFLINE: ["Offline", "offline", CircleSlash],
    } as Record<string, Entry>,
    vehicle: {
        AVAILABLE: ["Disponível", "success", CheckCircle2],
        IN_USE: ["Em uso", "info", Truck],
        MAINTENANCE: ["Manutenção", "warning", Wrench],
    } as Record<string, Entry>,
    stop: {
        START: ["Posição inicial", "neutral", Flag],
        PICKUP: ["Retirada", "neutral", PackageCheck],
        WAYPOINT: ["Parada", "neutral", MapPinCheck],
        DROPOFF: ["Entrega", "neutral", Flag],
    } as Record<string, Entry>,
    severity: {
        LOW: ["Baixa", "info", TriangleAlert],
        MEDIUM: ["Média", "warning", TriangleAlert],
        HIGH: ["Alta", "danger", TriangleAlert],
    } as Record<string, Entry>,
};

export type BadgeKind = keyof typeof TABLES;

export default function StatusBadge({ kind, value }: { kind: BadgeKind; value: string }) {
    const entry = TABLES[kind][value];
    // valor desconhecido aparece cru, em tom neutro
    const [label, tone, Icon] = entry ?? [value, "neutral" as Tone, CircleDashed];
    return (
        <span className={`badge badge-${tone}`}>
            <Icon size={14} aria-hidden="true" />
            {label}
        </span>
    );
}
