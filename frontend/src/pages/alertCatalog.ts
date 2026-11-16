import type { Alert, AlertType, Severity } from "../api/types";

export const ALERT_LABEL: Record<AlertType, string> = {
    STALE_ORDER: "Pedido parado",
    DRIVER_NO_SIGNAL: "Motorista sem sinal",
    STATUS_INCONSISTENT: "Status inconsistente",
    VEHICLE_MAINTENANCE_ON_AVAILABLE_DRIVER: "Veículo em manutenção com motorista livre",
    DEMAND_OVER_CAPACITY: "Demanda acima da capacidade",
    SUSPICIOUS_STOP: "Parada suspeita",
    ROUTE_MISSING: "Pedido sem rota",
    LONG_MAINTENANCE: "Manutenção longa",
};

const RANK: Record<Severity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

// mais severo primeiro; empate pelo mais antigo (há mais tempo esperando)
export function sortAlerts(items: Alert[]): Alert[] {
    return [...items].sort(
        (a, b) => RANK[b.severity] - RANK[a.severity] || Date.parse(a.since) - Date.parse(b.since),
    );
}

export function sumCounts(counts: Partial<Record<string, number>> | undefined): number {
    return Object.values(counts ?? {}).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

// o mesmo pedido pode ter vários alertas do mesmo tipo (ex.: paradas suspeitas)
export const alertKey = (a: Alert, i: number) => `${a.type}-${a.subjectId ?? ""}-${i}`;

export function subjectLink(alert: Alert): string | null {
    if (!alert.subjectId) return null;
    const type = alert.subjectType.toUpperCase();
    if (type === "ORDER") return `/orders/${alert.subjectId}`;
    if (type === "DRIVER") return `/drivers/${alert.subjectId}`;
    if (type === "VEHICLE") return "/vehicles";
    return null;
}
