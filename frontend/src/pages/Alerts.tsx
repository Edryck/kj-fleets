import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Alert, AlertType, Alerts as AlertsData, Severity } from "../api/types";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatAgo } from "../components/format";
import GeneratedAt from "../components/GeneratedAt";
import StatusBadge from "../components/StatusBadge";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import HeroNumber from "../patterns/HeroNumber";
import { ALERT_LABEL, alertKey, sortAlerts, subjectLink, sumCounts } from "./alertCatalog";

const SEVERITIES: [Severity | "", string][] = [
    ["", "Todas"],
    ["HIGH", "Alta"],
    ["MEDIUM", "Média"],
    ["LOW", "Baixa"],
];

const SEVERITY_LABEL: Record<Severity, string> = { HIGH: "alta", MEDIUM: "média", LOW: "baixa" };

interface Group {
    type: AlertType;
    severity: Severity;
    items: Alert[];
}

function groupByType(sorted: Alert[]): Group[] {
    const groups = new Map<AlertType, Group>();
    for (const a of sorted) {
        const group = groups.get(a.type);
        if (group) group.items.push(a);
        else groups.set(a.type, { type: a.type, severity: a.severity, items: [a] });
    }
    return [...groups.values()];
}

function AlertGroup({ group, index }: { group: Group; index: number }) {
    const label = ALERT_LABEL[group.type] ?? group.type;
    return (
        <Glass
            as="section"
            className="alert-group"
            data-severity={group.severity}
            aria-label={`${label}, ${group.items.length} ${group.items.length === 1 ? "alerta" : "alertas"}`}
            style={{ "--i": Math.min(index, 8) } as CSSProperties}
        >
            <span className="alert-stripe" aria-hidden="true" />
            <header className="alert-group-head">
                <h2>{label}</h2>
                <span className="alert-group-count">{group.items.length}</span>
                <StatusBadge kind="severity" value={group.severity} />
            </header>
            <ul className="alert-items">
                {group.items.map((a, i) => {
                    const link = subjectLink(a);
                    return (
                        <li key={alertKey(a, i)} data-severity={a.severity}>
                            <span className="alert-dot" aria-hidden="true" />
                            <div className="alert-body">
                                <p className="alert-message">{a.message}</p>
                                {a.suggestedAction && (
                                    <p className="alert-action">{a.suggestedAction}</p>
                                )}
                            </div>
                            <div className="alert-meta">
                                <span>{formatAgo(a.since)}</span>
                                {link ? (
                                    <Link className="table-link data" to={link}>
                                        {a.subjectId}
                                    </Link>
                                ) : (
                                    a.subjectId && <span className="data">{a.subjectId}</span>
                                )}
                                {group.items.some((x) => x.severity !== group.severity) && (
                                    <span className="caption">
                                        severidade {SEVERITY_LABEL[a.severity]}
                                    </span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Glass>
    );
}

export default function Alerts() {
    const [params, setParams] = useSearchParams();
    const type = params.get("type") ?? "";
    const [severity, setSeverity] = useState<Severity | "">("");
    const query = useQuery({
        queryKey: ["dashboard", "alerts"],
        queryFn: () => request<AlertsData>("GET", "/dashboard/alerts"),
        refetchInterval: 60_000,
    });
    const data = query.data;

    useTitleBlock({
        title: "Alertas",
        meta: data ? (
            <GeneratedAt
                generatedAt={data.meta.generatedAt}
                timezone={data.meta.timezone}
                onRefresh={() => void query.refetch()}
            />
        ) : undefined,
    });

    if (query.isError) {
        const e = query.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => query.refetch()} />
        );
    }

    const total = sumCounts(data?.counts);
    const chips = Object.entries(data?.counts ?? {}).filter(([, n]) => (n ?? 0) > 0);
    const rows = sortAlerts(data?.items ?? []).filter(
        (a) => (!type || a.type === type) && (!severity || a.severity === severity),
    );
    const groups = groupByType(rows);
    const high = (data?.items ?? []).filter((a) => a.severity === "HIGH").length;
    const toggleType = (next: string) =>
        setParams(next === type ? {} : { type: next }, { replace: true });

    if (!data) {
        return (
            <div className="insight" aria-busy="true">
                <Skeleton height={140} />
                <Skeleton height={220} />
            </div>
        );
    }

    if (total === 0) {
        return (
            <div className="insight">
                <Glass as="section" className="insight-card">
                    <EmptyState
                        icon={CircleCheck}
                        title="Nenhum alerta agora"
                        description="A lista atualiza sozinha a cada minuto."
                    />
                </Glass>
            </div>
        );
    }

    return (
        <div className="insight">
            <Glass as="section" className="insight-hero alert-hero" aria-label="Resumo">
                <HeroNumber
                    label="Alertas ativos"
                    value={total}
                    caption={high > 0 ? `${high} de severidade alta` : "Nenhum de severidade alta"}
                />
                <div className="alert-filters">
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
            </Glass>

            {groups.length === 0 ? (
                <Glass as="section" className="insight-card">
                    <EmptyState title="Nenhum alerta com esses filtros" />
                </Glass>
            ) : (
                <div className="alert-groups">
                    {groups.map((g, i) => (
                        <AlertGroup key={g.type} group={g} index={i} />
                    ))}
                </div>
            )}
            {data.items.length < total && (
                <p className="insight-note">
                    Mostrando {data.items.length} dos {total} alertas.
                </p>
            )}
        </div>
    );
}
