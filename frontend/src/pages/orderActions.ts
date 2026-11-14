import type { OrderStatus } from "../api/types";

export type NextAction =
    | { kind: "dispatch"; label: string }
    | { kind: "pod"; label: string }
    | { kind: "activity"; code: OrderStatus; label: string };

interface OrderState {
    status: OrderStatus;
    driver: unknown;
    vehicle: unknown;
    podRequired: boolean;
    podValue: string | null;
}

// próximo passo legal do fluxo; a API continua sendo a palavra final
export function nextAction(order: OrderState): NextAction | null {
    switch (order.status) {
        case "CREATED":
            return order.driver && order.vehicle ? { kind: "dispatch", label: "Despachar" } : null;
        case "DISPATCHED":
            return { kind: "activity", code: "DRIVER_ENROUTE", label: "Motorista a caminho" };
        case "DRIVER_ENROUTE":
            return { kind: "activity", code: "ARRIVED", label: "Chegou à retirada" };
        case "ARRIVED":
            return { kind: "activity", code: "IN_PROGRESS", label: "Iniciar entrega" };
        case "IN_PROGRESS":
            if (order.podRequired && !order.podValue) {
                return { kind: "pod", label: "Registrar prova de entrega" };
            }
            return { kind: "activity", code: "COMPLETED", label: "Concluir" };
        default:
            return null;
    }
}

export const canAssign = (status: OrderStatus) => status === "CREATED";
export const canFail = (status: OrderStatus) => status === "IN_PROGRESS";
// equipe cancela até ARRIVED
export const canCancel = (status: OrderStatus) =>
    ["CREATED", "DISPATCHED", "DRIVER_ENROUTE", "ARRIVED"].includes(status);
export const isActive = (status: OrderStatus) =>
    !["COMPLETED", "CANCELLED", "FAILED"].includes(status);

export const TIMELINE_LABEL: Record<string, string> = {
    created: "Pedido criado",
    assigned: "Motorista atribuído",
    unassigned: "Atribuição removida",
    dispatched: "Despachado",
    driver_enroute: "Motorista a caminho",
    arrived: "Chegou à retirada",
    in_progress: "Em andamento",
    pod_registered: "Prova de entrega registrada",
    completed: "Concluído",
    failed: "Falhou",
    cancelled: "Cancelado",
    stop_completed: "Parada concluída",
    route_failed: "Falha ao calcular rota",
};
