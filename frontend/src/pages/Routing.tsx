import { useQuery } from "@tanstack/react-query";
import { CircleGauge, PiggyBank, Route as RouteIcon, Waypoints } from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { RoutingReport } from "../api/types";
import { EmptyState, ErrorState, KpiCard, Skeleton } from "../components/blocks";
import GeneratedAt from "../components/GeneratedAt";
import { formatKm, formatPercent } from "../components/format";
import PeriodSelect, { usePeriod } from "../components/PeriodSelect";
import RateValue from "../components/RateValue";
import { legendProps, tooltipStyle, useChartColors } from "./dashboardParts";

const ALGORITHM_LABEL: Record<string, string> = {
    NEAREST_NEIGHBOR: "Vizinho mais próximo",
    TWO_OPT: "2-opt",
    HELD_KARP: "Held-Karp (exato)",
    SIMULATED_ANNEALING: "Recozimento simulado",
};

export default function Routing() {
    const [period] = usePeriod();
    const colors = useChartColors();
    const panel = useQuery({
        queryKey: ["analytics", "routing", period],
        queryFn: () =>
            request<RoutingReport>("GET", "/dashboard/routing/savings", undefined, { period }),
    });

    if (panel.isError) {
        const e = panel.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => panel.refetch()} />
        );
    }

    const p = panel.data;
    const byAlgorithm = Object.entries(p?.byAlgorithm ?? {}).map(([key, a]) => ({
        key,
        label: ALGORITHM_LABEL[key] ?? key,
        savedKm: a.savedKm,
        routes: a.routes,
    }));
    const tip = tooltipStyle(colors);
    const axis = { fill: colors["text-muted"], fontSize: 12 };

    return (
        <div className="stack dash">
            <header className="dash-head">
                <div className="dash-title">
                    <h1>Economia de rotas</h1>
                    <p className="page-sub">
                        Quilômetros planejados contra a ordem de cadastro das paradas.
                    </p>
                </div>
                <div className="dash-tools">
                    <PeriodSelect />
                    {p && (
                        <GeneratedAt
                            generatedAt={p.meta.generatedAt}
                            timezone={p.meta.timezone}
                            onRefresh={() => void panel.refetch()}
                        />
                    )}
                </div>
            </header>

            <div className="kpi-row">
                {!p ? (
                    Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={104} />)
                ) : (
                    <>
                        <KpiCard label="Rotas" value={p.routes} icon={RouteIcon} />
                        <KpiCard
                            label="Km planejados"
                            value={formatKm(p.plannedKm)}
                            icon={Waypoints}
                        />
                        <KpiCard
                            label="Km economizados"
                            value={formatKm(p.savedKm)}
                            icon={PiggyBank}
                            hint={`de ${formatKm(p.baselineKm)} de referência`}
                        />
                        <KpiCard
                            label="Economia média"
                            value={formatPercent(p.avgSavingsPct)}
                            icon={CircleGauge}
                        />
                    </>
                )}
            </div>

            <section className="card" aria-labelledby="batch-title">
                <h2 id="batch-title">Despacho em lote</h2>
                {!p ? (
                    <Skeleton height={48} />
                ) : (
                    <dl className="metrics">
                        <div>
                            <dt>Despachos em lote</dt>
                            <dd>
                                <RateValue value={p.batchDispatchPct} />
                            </dd>
                        </div>
                    </dl>
                )}
            </section>

            <section className="card" aria-labelledby="alg-title">
                <div className="card-head">
                    <h2 id="alg-title">Economia por algoritmo</h2>
                    <span className="caption">km economizados</span>
                </div>
                {!p ? (
                    <Skeleton height={240} />
                ) : p.routes === 0 ? (
                    <EmptyState
                        title="Nenhuma rota concluída no período"
                        description="Os números aparecem depois que uma rota for calculada."
                    />
                ) : (
                    <div className="chart" style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byAlgorithm} margin={{ right: 8 }}>
                                <CartesianGrid vertical={false} stroke={colors.border} />
                                <XAxis dataKey="label" tick={axis} stroke={colors.border} />
                                <YAxis tick={axis} stroke={colors.border} width={44} />
                                <Tooltip {...tip} />
                                <Legend {...legendProps(colors)} />
                                <Bar
                                    dataKey="savedKm"
                                    name="Km economizados"
                                    fill={colors.primary}
                                    radius={[3, 3, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>
        </div>
    );
}
