import type { Rate } from "../api/types";
import { formatRate } from "./format";

export default function RateValue({ value }: { value: Rate | null | undefined }) {
    if (!value || value.rate == null) {
        return (
            <span title="Sem pedidos no período" aria-label="Sem pedidos no período">
                —
            </span>
        );
    }
    return (
        <span>
            {formatRate(value.rate)}{" "}
            <span className="caption">
                ({value.n} {value.n === 1 ? "pedido" : "pedidos"})
            </span>
        </span>
    );
}
