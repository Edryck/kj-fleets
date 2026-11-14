import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Route as RouteIcon } from "lucide-react";
import { useState } from "react";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { OrderRoute } from "../api/types";
import AlgorithmFields, { ALGORITHM_LABEL } from "../components/AlgorithmFields";
import { EmptyState, KpiCard } from "../components/blocks";
import { formatDateTime, formatKm, formatMinutes, formatPercent } from "../components/format";
import { toast } from "../components/Toasts";

const MODE_LABEL: Record<string, string> = { HAVERSINE: "Linha reta" };

interface Props {
    orderId: string;
    route: OrderRoute | null | undefined;
    waypointCount: number;
    // admin/despachante em pedido não terminal
    canRecalculate: boolean;
}

export default function RouteBlock({ orderId, route, waypointCount, canRecalculate }: Props) {
    const client = useQueryClient();
    const [algorithm, setAlgorithm] = useState("");
    const [seed, setSeed] = useState("");
    const [error, setError] = useState<string | null>(null);

    const calculate = useMutation({
        mutationFn: () =>
            request<OrderRoute>("POST", `/orders/${orderId}/route`, {
                algorithm: algorithm || undefined,
                seed: algorithm === "SIMULATED_ANNEALING" && seed ? Number(seed) : undefined,
            }),
        onSuccess: () => {
            setError(null);
            toast.success("Rota calculada.");
            void client.invalidateQueries({ queryKey: ["order", orderId] });
        },
        onError: (e: ApiError) => {
            if (e.code === "ORDER_INVALID_TRANSITION") {
                void client.invalidateQueries({ queryKey: ["order", orderId] });
            }
            // fica no card: o toast some e o motivo importa para escolher outro algoritmo
            setError(
                e.code === "GRAPH_NOT_LOADED"
                    ? "Mapa viário indisponível. Por enquanto as rotas usam linha reta entre paradas."
                    : e.code === "NO_PATH_FOUND"
                      ? "Não há caminho entre as paradas."
                      : messageFor(e.code, e.message),
            );
        },
    });

    const form = canRecalculate && (
        <form
            className="route-form"
            onSubmit={(e) => {
                e.preventDefault();
                calculate.mutate();
            }}
        >
            <AlgorithmFields
                algorithm={algorithm}
                onAlgorithm={setAlgorithm}
                seed={seed}
                onSeed={setSeed}
                waypointCount={waypointCount}
            />
            <button type="submit" className="btn btn-secondary" disabled={calculate.isPending}>
                {calculate.isPending ? (
                    <Loader2 size={16} className="spin" aria-hidden="true" />
                ) : (
                    <RefreshCw size={16} aria-hidden="true" />
                )}
                {route ? "Recalcular rota" : "Calcular rota"}
            </button>
        </form>
    );

    return (
        <section className="card">
            <h2>Rota</h2>
            {error && (
                <p className="notice notice-danger" role="alert">
                    {error}
                </p>
            )}
            {route ? (
                <div className="stack-sm">
                    <p className="route-meta">
                        <span className="badge badge-neutral">
                            <RouteIcon size={14} aria-hidden="true" />
                            {ALGORITHM_LABEL[route.algorithm] ?? route.algorithm}
                        </span>
                        <span className="caption">
                            {MODE_LABEL[route.mode] ?? route.mode} · calculada em{" "}
                            {formatDateTime(route.computedAt)}
                        </span>
                    </p>
                    <div className="route-kpis">
                        <KpiCard label="Distância" value={formatKm(route.totalKm)} />
                        <KpiCard label="Sem otimizar" value={formatKm(route.baselineKm)} />
                        <KpiCard label="Economia" value={formatPercent(route.savingsPct)} />
                        <KpiCard label="Chegada em" value={formatMinutes(route.etaMinutes)} />
                    </div>
                    {form}
                </div>
            ) : (
                <>
                    <EmptyState
                        title="Sem rota calculada"
                        description={
                            canRecalculate
                                ? "Calcule para ver a ordem das paradas e a distância."
                                : "Este pedido ainda não tem rota."
                        }
                        icon={RouteIcon}
                    />
                    {form}
                </>
            )}
        </section>
    );
}
