import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { AlertType, Alerts as AlertsData, Severity } from "../api/types";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatAgo } from "../components/format";
import GeneratedAt from "../components/GeneratedAt";
import StatusBadge from "../components/StatusBadge";
import { ALERT_LABEL, alertKey, sortAlerts, subjectLink, sumCounts } from "./alerts";

const SEVERITIES: [Severity | "", string][] = [
    ["", "Todas"],
    ["HIGH", "Alta"],
    ["MEDIUM", "Média"],
    ["LOW", "Baixa"],
];

export default function Alerts() {
    const [params, setParams] = useSearchParams();
    const type = params.get("type") ?? "";
    const [severity, setSeverity] = useState<Severity | "">("");
    const query = useQuery({
        queryKey: ["dashboard", "alerts"],
        queryFn: () => request<AlertsData>("GET", "/dashboard/alerts"),
        refetchInterval: 60_000,
    });

    if (query.isError) {
        const e = query.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => query.refetch()} />
        );
    }

    const data = query.data;
    const total = sumCounts(data?.counts);
    const chips = Object.entries(data?.counts ?? {}).filter(([, n]) => (n ?? 0) > 0);
    const rows = sortAlerts(data?.items ?? []).filter(
        (a) => (!type || a.type === type) && (!severity || a.severity === severity),
    );
    const toggleType = (next: string) =>
        setParams(next === type ? {} : { type: next }, { replace: true });

    return (
        <div className="stack dash">
            <header className="dash-head">
                <div className="dash-title">
                    <h1>Alertas</h1>
                    <p className="page-sub">
                        O que precisa de atenção agora, do mais grave ao mais leve.
                    </p>
                </div>
                <div className="dash-tools">
                    {data && (
                        <GeneratedAt
                            generatedAt={data.meta.generatedAt}
                            timezone={data.meta.timezone}
                            onRefresh={() => void query.refetch()}
                        />
                    )}
                </div>
            </header>

            {!data ? (
                <Skeleton height={200} />
            ) : total === 0 ? (
                <section className="card">
                    <EmptyState
                        icon={CircleCheck}
                        title="Nenhum alerta agora"
                        description="A lista atualiza sozinha a cada minuto."
                    />
                </section>
            ) : (
                <>
                    <div className="filters">
                        <ul className="chips" aria-label="Filtrar por tipo">
                            {chips.map(([t, n]) => (
                                <li key={t}>
                                    <button
                                        type="button"
                                        className="chip"
                                        aria-pressed={type === t}
                                        onClick={() => toggleType(t)}
                                    >
                                        {ALERT_LABEL[t as AlertType] ?? t}
                                        <span className="chip-count">{n}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="segmented" role="group" aria-label="Severidade">
                            {SEVERITIES.map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={severity === value}
                                    onClick={() => setSeverity(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <section className="card" aria-label="Lista de alertas">
                        {rows.length === 0 ? (
                            <EmptyState title="Nenhum alerta com esses filtros" />
                        ) : (
                            <div className="table-scroll">
                                <table className="table alerts-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Severidade</th>
                                            <th scope="col">Tipo</th>
                                            <th scope="col">O que aconteceu</th>
                                            <th scope="col">Ação sugerida</th>
                                            <th scope="col">Desde</th>
                                            <th scope="col">Item</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((a, i) => {
                                            const link = subjectLink(a);
                                            return (
                                                <tr key={alertKey(a, i)}>
                                                    <td>
                                                        <StatusBadge
                                                            kind="severity"
                                                            value={a.severity}
                                                        />
                                                    </td>
                                                    <td>{ALERT_LABEL[a.type] ?? a.type}</td>
                                                    <td>{a.message}</td>
                                                    <td>{a.suggestedAction || "—"}</td>
                                                    <td>{formatAgo(a.since)}</td>
                                                    <td>
                                                        {link ? (
                                                            <Link
                                                                className="table-link data"
                                                                to={link}
                                                            >
                                                                {a.subjectId}
                                                            </Link>
                                                        ) : (
                                                            <span className="data">
                                                                {a.subjectId ?? "—"}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {data.items.length < total && (
                            <p className="field-help">
                                Mostrando {data.items.length} dos {total} alertas.
                            </p>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
