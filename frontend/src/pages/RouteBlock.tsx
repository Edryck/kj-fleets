import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { OrderRoute } from "../api/types";
import AlgorithmFields, { ALGORITHM_LABEL } from "../components/AlgorithmFields";
import { formatDateTime, formatKm, formatPercent } from "../components/format";
import { FallbackNotice, MapLegend, legsFromStops } from "../components/RouteLegs";
import { toast } from "../components/Toasts";
import Glass from "../glass/Glass";
import HeroNumber from "../patterns/HeroNumber";
import { timelineFromRoute, type TimelineStop } from "../patterns/StopTimeline";

const MODE_LABEL: Record<string, string> = { HAVERSINE: "Linha reta", ROAD: "Pelas ruas" };
const DENSE = 8;

interface Props {
    orderId: string;
    route: OrderRoute | null | undefined;
    waypointCount: number;
    canRecalculate: boolean;
}

function RouteStepper({ stops }: { stops: TimelineStop[] }) {
    const done = stops.filter((s) => s.state === "done").length;
    const dense = stops.length > DENSE;
    const fill = stops.length > 1 ? Math.min(1, done / (stops.length - 1)) : 0;
    const shown = (stop: TimelineStop, index: number) =>
        !dense || index === 0 || index === stops.length - 1 || stop.state === "next";
    return (
        <div className={`strip-stepper${dense ? " is-dense" : ""}`}>
            <p className="sr-only">
                {done} de {stops.length} paradas concluídas
            </p>
            <div className="strip-stepper-line" aria-hidden="true">
                <span
                    className="strip-stepper-fill"
                    style={{ "--fill": fill } as React.CSSProperties}
                />
                {stops.map((stop) => (
                    <span key={stop.id} className={`strip-pin is-${stop.state}`}>
                        {!dense && stop.label}
                    </span>
                ))}
            </div>
            <div className="strip-stepper-labels" aria-hidden="true">
                {stops.map((stop, index) => (
                    <span key={stop.id} className={stop.state === "next" ? "is-next" : undefined}>
                        {shown(stop, index) ? stop.name : ""}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function RouteBlock({ orderId, route, waypointCount, canRecalculate }: Props) {
    const client = useQueryClient();
    const [algorithm, setAlgorithm] = useState("");
    const [seed, setSeed] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    const calculate = useMutation({
        mutationFn: () =>
            request<OrderRoute>("POST", `/orders/${orderId}/route`, {
                algorithm: algorithm || undefined,
                seed: algorithm === "SIMULATED_ANNEALING" && seed ? Number(seed) : undefined,
            }),
        onSuccess: () => {
            setError(null);
            setOpen(false);
            toast.success("Rota calculada.");
            void client.invalidateQueries({ queryKey: ["order", orderId] });
        },
        onError: (e: ApiError) => {
            if (e.code === "ORDER_INVALID_TRANSITION") {
                void client.invalidateQueries({ queryKey: ["order", orderId] });
            }
            setError(
                e.code === "GRAPH_NOT_LOADED"
                    ? "Mapa viário indisponível. Por enquanto as rotas usam linha reta entre paradas."
                    : e.code === "NO_PATH_FOUND"
                      ? "Não há caminho entre as paradas."
                      : messageFor(e.code, e.message),
            );
        },
    });

    const form = canRecalculate && (!route || open) && (
        <form
            className="strip-form"
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
            <button type="submit" className="btn btn-primary" disabled={calculate.isPending}>
                {calculate.isPending && <Loader2 size={16} className="spin" aria-hidden="true" />}
                {route ? "Recalcular rota" : "Calcular rota"}
            </button>
        </form>
    );

    const errorNotice = error && (
        <p className="notice notice-danger strip-wide" role="alert">
            {error}
        </p>
    );

    if (!route) {
        return (
            <Glass as="section" className="order-strip is-empty" aria-label="Rota">
                <div className="strip-empty">
                    <span className="micro">Rota</span>
                    <b>Sem rota calculada</b>
                    <small>
                        {canRecalculate
                            ? "Calcule para ver a ordem das paradas e a distância."
                            : "Este pedido ainda não tem rota."}
                    </small>
                </div>
                {errorNotice}
                {form}
            </Glass>
        );
    }

    const stops = timelineFromRoute(route.stops, route.mode);
    const legs = legsFromStops(route.stops, route.mode === "HAVERSINE");
    const roadOk = route.mode === "ROAD" && route.fallbackLegs === 0;

    return (
        <Glass as="section" className="order-strip" aria-label="Rota">
            <div className="strip-route">
                <div className="strip-head">
                    <span className="micro">
                        Rota · {ALGORITHM_LABEL[route.algorithm] ?? route.algorithm}
                    </span>
                    <span className={`est-chip${roadOk ? " is-road" : ""}`}>
                        {MODE_LABEL[route.mode] ?? route.mode}
                    </span>
                    <span className="strip-when">
                        calculada em {formatDateTime(route.computedAt)}
                    </span>
                </div>
                <RouteStepper stops={stops} />
                <MapLegend legs={legs} />
            </div>
            <div className="strip-metrics">
                <div className="strip-metric">
                    <span className="micro">Total</span>
                    <b>{formatKm(route.totalKm)}</b>
                </div>
                <div className="strip-metric">
                    <span className="micro">Original</span>
                    <b>{formatKm(route.baselineKm)}</b>
                </div>
                <div className="strip-metric">
                    <span className="micro">Economia</span>
                    <b className={(route.savingsPct ?? 0) > 0 ? "is-good" : undefined}>
                        {formatPercent(route.savingsPct)}
                    </b>
                </div>
                <HeroNumber size="stat" label="Chegada em" value={route.etaMinutes} unit="min" />
                {canRecalculate && (
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-expanded={open}
                        onClick={() => setOpen((v) => !v)}
                    >
                        <RefreshCw size={14} aria-hidden="true" />
                        Recalcular
                    </button>
                )}
            </div>
            {route.fallbackLegs > 0 && (
                <div className="strip-wide">
                    <FallbackNotice count={route.fallbackLegs} />
                </div>
            )}
            {errorNotice}
            {form && <div className="strip-wide">{form}</div>}
        </Glass>
    );
}
