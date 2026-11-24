import { useQuery } from "@tanstack/react-query";
import { ALGORITHM_LABEL } from "../components/AlgorithmFields";
import type { CSSProperties } from "react";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { RoutingReport } from "../api/types";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import GeneratedAt from "../components/GeneratedAt";
import { formatKm, formatPercent } from "../components/format";
import PeriodSelect, { usePeriod } from "../components/PeriodSelect";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import HeroNumber from "../patterns/HeroNumber";

const share = (part: number, whole: number) =>
    whole > 0 ? `${Math.max(2, Math.min(100, (part / whole) * 100))}%` : "0%";

function DistanceCompare({ planned, baseline }: { planned: number; baseline: number }) {
    return (
        <div
            className="km-compare"
            role="img"
            aria-label={`${formatKm(planned)} planejados contra ${formatKm(baseline)} na ordem de cadastro`}
        >
            <div className="km-compare-row">
                <span>Ordem de cadastro</span>
                <div className="km-track">
                    <i
                        className="is-baseline motion-grow"
                        style={{ width: share(baseline, baseline) }}
                    />
                </div>
                <b className="data">{formatKm(baseline)}</b>
            </div>
            <div className="km-compare-row">
                <span>Planejado</span>
                <div className="km-track">
                    <i
                        className="is-planned motion-grow"
                        style={{ width: share(planned, baseline), "--i": 1 } as CSSProperties}
                    />
                </div>
                <b className="data">{formatKm(planned)}</b>
            </div>
        </div>
    );
}

export default function Routing() {
    const [period] = usePeriod();
    const panel = useQuery({
        queryKey: ["analytics", "routing", period],
        queryFn: () =>
            request<RoutingReport>("GET", "/dashboard/routing/savings", undefined, { period }),
    });
    const p = panel.data;

    useTitleBlock({
        title: "Economia de rotas",
        meta: p ? (
            <GeneratedAt
                generatedAt={p.meta.generatedAt}
                timezone={p.meta.timezone}
                onRefresh={() => void panel.refetch()}
            />
        ) : undefined,
        actions: (
            <Glass className="dash-period">
                <PeriodSelect />
            </Glass>
        ),
    });

    if (panel.isError) {
        const e = panel.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => panel.refetch()} />
        );
    }

    if (!p) {
        return (
            <div className="insight" aria-busy="true">
                <Skeleton height={220} />
                <Skeleton height={240} />
            </div>
        );
    }

    const byAlgorithm = Object.entries(p.byAlgorithm)
        .map(([key, a]) => ({ key, label: ALGORITHM_LABEL[key] ?? key, ...a }))
        .sort((a, b) => b.savedKm - a.savedKm);
    const topSaved = Math.max(0, ...byAlgorithm.map((a) => a.savedKm));
    const batch = p.batchDispatchPct;

    return (
        <div className="insight">
            <Glass as="section" className="insight-hero routing-hero" aria-label="Resumo">
                <HeroNumber
                    label="km economizados"
                    value={p.savedKm}
                    decimals={1}
                    caption={`de ${formatKm(p.baselineKm)} na ordem de cadastro das paradas`}
                />
                <div className="insight-stats">
                    <HeroNumber size="stat" label="Rotas" value={p.routes} />
                    <HeroNumber
                        size="stat"
                        label="Economia média"
                        value={p.avgSavingsPct}
                        decimals={1}
                        unit="%"
                    />
                    <HeroNumber
                        size="stat"
                        label="Despachos em lote"
                        value={batch.rate == null ? null : batch.rate * 100}
                        decimals={1}
                        unit="%"
                        caption={
                            batch.rate == null
                                ? "Sem pedidos no período"
                                : `${batch.n} ${batch.n === 1 ? "pedido" : "pedidos"}`
                        }
                    />
                </div>
                {p.routes > 0 && <DistanceCompare planned={p.plannedKm} baseline={p.baselineKm} />}
            </Glass>

            <Glass
                as="section"
                className="insight-card"
                aria-labelledby="alg-title"
                style={{ "--i": 1 } as CSSProperties}
            >
                <div className="insight-card-head">
                    <h2 id="alg-title">Economia por algoritmo</h2>
                    <span className="caption">km economizados no período</span>
                </div>
                {p.routes === 0 ? (
                    <EmptyState
                        title="Nenhuma rota concluída no período"
                        description="Os números aparecem depois que uma rota for calculada."
                    />
                ) : (
                    <ul className="alg-bars">
                        {byAlgorithm.map((a, i) => (
                            <li key={a.key}>
                                <div className="alg-bar-head">
                                    <b>{a.label}</b>
                                    <span className="data">{formatKm(a.savedKm)}</span>
                                </div>
                                <div className="km-track">
                                    <i
                                        className="is-planned motion-grow"
                                        style={
                                            {
                                                width: share(a.savedKm, topSaved),
                                                "--i": i + 1,
                                            } as CSSProperties
                                        }
                                    />
                                </div>
                                <span className="caption">
                                    {a.routes} {a.routes === 1 ? "rota" : "rotas"}, economia média{" "}
                                    {formatPercent(a.avgSavingsPct)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Glass>
        </div>
    );
}
