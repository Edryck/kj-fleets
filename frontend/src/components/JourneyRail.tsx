import { Check } from "lucide-react";
import type { OrderStatus } from "../api/types";

const STEPS = ["Recebido", "Despachado", "A caminho", "Em entrega", "Entregue"];
const STEP_OF: Partial<Record<OrderStatus, number>> = {
    CREATED: 0,
    DISPATCHED: 1,
    DRIVER_ENROUTE: 2,
    ARRIVED: 2,
    IN_PROGRESS: 3,
    COMPLETED: 4,
};

// cancelado/falho não têm etapa: quem chama mostra o aviso no lugar
export default function JourneyRail({ status }: { status: OrderStatus }) {
    const current = STEP_OF[status];
    if (current === undefined) return null;
    return (
        <ol className="rail" aria-label="Etapas do pedido">
            {STEPS.map((label, i) => {
                const state =
                    i < current || status === "COMPLETED" ? "done" : i === current ? "now" : "next";
                return (
                    <li
                        key={label}
                        className={`rail-step rail-${state}`}
                        aria-current={state === "now" ? "step" : undefined}
                    >
                        <span className="rail-dot" aria-hidden="true">
                            {state === "done" && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="rail-label">{label}</span>
                    </li>
                );
            })}
        </ol>
    );
}
