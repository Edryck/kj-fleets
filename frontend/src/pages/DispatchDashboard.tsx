import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { DispatchPanel } from "../api/types";
import { ErrorState, Skeleton } from "../components/blocks";
import { formatMinutes } from "../components/format";
import GeneratedAt from "../components/GeneratedAt";
import { usePeriod } from "../components/PeriodSelect";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import { useMapScene } from "../map/useMapScene";
import DotMatrix from "../patterns/DotMatrix";
import HeroNumber from "../patterns/HeroNumber";
import {
    AlertChips,
    DashboardFrame,
    DockPanel,
    DriverList,
    PanelHead,
    StatGrid,
    alertCountsOf,
} from "./dashboard/DashboardFrame";
import { dashboardScene } from "./dashboard/dashboardScene";
import {
    DashTitleActions,
    StatCell,
    dashboardPadding,
    rateText,
    useFramePoints,
    useNow,
} from "./dashboard/dashParts";
import { DeltaHint, useDriverRowsLive } from "./dashboardParts";

const QUEUE_COLUMNS = [
    {
        key: "unassigned",
        stage: "UNASSIGNED",
        label: "Sem motorista",
        color: "var(--color-warning)",
        to: "/dispatch",
    },
    {
        key: "assigned",
        stage: "ASSIGNED",
        label: "Atribuído",
        color: "var(--color-text-muted)",
        to: "/dispatch",
    },
    {
        key: "inProgress",
        stage: "IN_PROGRESS",
        label: "Em andamento",
        color: "var(--color-success)",
        to: "/orders?active=true",
    },
] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function DispatchDashboard() {
    const [period] = usePeriod();
    const client = useQueryClient();
    const navigate = useNavigate();
    const now = useNow(30_000);
    const [padding] = useState(dashboardPadding);
    const key = useMemo(() => ["dashboard", "dispatch-panel", period], [period]);
    const panel = useQuery({
        queryKey: key,
        queryFn: () => request<DispatchPanel>("GET", "/dashboard/dispatch", undefined, { period }),
    });
    useDriverRowsLive<DispatchPanel>(key, (d) => [d.availableDrivers]);
    const dispatch = useMutation({
        mutationFn: (orderId: string) =>
            request<unknown>("POST", `/orders/${orderId}/dispatch`, {}),
        onSuccess: () => {
            toast.success("Pedido despachado.");
            void client.invalidateQueries({ queryKey: ["dashboard"] });
            void client.invalidateQueries({ queryKey: ["orders"] });
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });

    const drivers = useMemo(() => panel.data?.availableDrivers ?? [], [panel.data]);
    const driverIds = useMemo(() => new Set(drivers.map((d) => d.driverId)), [drivers]);
    const frame = useFramePoints(drivers);
    const scene = useMemo(
        () => dashboardScene({ drivers, now, padding, frame }),
        [drivers, now, padding, frame],
    );
    useMapScene(
        panel.isSuccess
            ? {
                  ...scene,
                  onMarkerClick: (id) => {
                      if (driverIds.has(id)) navigate(`/map?driver=${id}`);
                  },
              }
            : null,
    );

    const p = panel.data;
    useTitleBlock({
        title: "Despacho agora",
        meta: p ? (
            <GeneratedAt
                generatedAt={p.meta.generatedAt}
                timezone={p.meta.timezone}
                onRefresh={() => void panel.refetch()}
            />
        ) : undefined,
        actions: <DashTitleActions />,
    });

    if (panel.isError) {
        const e = panel.error as ApiError;
        return (
            <Glass className="live-floating">
                <ErrorState
                    message={messageFor(e.code, e.message)}
                    onRetry={() => panel.refetch()}
                />
            </Glass>
        );
    }

    const q = p?.queue;
    const s = p?.summary;
    const prev = s?.previous;
    const stale = q?.stale?.items ?? [];
    const staleByStage = stale.reduce<Record<string, number>>((acc, o) => {
        acc[o.stage] = (acc[o.stage] ?? 0) + 1;
        return acc;
    }, {});
    const assigned = q?.assignedNotDispatched.items ?? [];

    const hero =
        !p || !s ? (
            <div className="dash-hero-loading">
                <Skeleton height={14} width={180} />
                <Skeleton height={128} width={220} />
                <Skeleton height={120} width={420} />
            </div>
        ) : (
            <>
                <HeroNumber
                    label="Pedidos aguardando"
                    value={p.counts.waitingOrders}
                    caption={plural(
                        p.counts.availableDrivers,
                        "motorista disponível",
                        "motoristas disponíveis",
                    )}
                />
                <StatGrid>
                    <StatCell
                        label="Criados"
                        value={s.created}
                        delta={
                            <DeltaHint
                                current={s.created}
                                previous={prev?.created}
                                goodWhen="neutral"
                            />
                        }
                    />
                    <StatCell
                        label="Concluídos"
                        value={s.completed}
                        delta={
                            <DeltaHint
                                current={s.completed}
                                previous={prev?.completed}
                                goodWhen="up"
                            />
                        }
                    />
                    <StatCell
                        label={`Falhas · ${rateText(s.failureRate)}`}
                        value={s.failed}
                        delta={
                            <DeltaHint current={s.failed} previous={prev?.failed} goodWhen="down" />
                        }
                        sub={`${s.cancelled} cancelados (${rateText(s.cancelRate)})`}
                    />
                    <StatCell
                        label={`Taxa de sucesso · ${s.successRate.n}`}
                        value={s.successRate.rate == null ? null : s.successRate.rate * 100}
                        unit="%"
                    />
                    <StatCell label="Espera média" value={s.avgWaitMinutes} unit="min" />
                    <StatCell label="Ciclo médio" value={s.avgCycleMinutes} unit="min" />
                </StatGrid>
            </>
        );

    const right = (
        <>
            <PanelHead
                title="Motoristas livres"
                aside={
                    <Link className="dash-link" to="/map">
                        Mapa ao vivo <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                }
            />
            {!p ? (
                <Skeleton height={160} />
            ) : (
                <DriverList rows={drivers} now={now} empty="Nenhum motorista livre agora." />
            )}
            {p && <AlertChips counts={alertCountsOf(p.alerts)} />}
        </>
    );

    const dock = (
        <>
            <DockPanel
                title="Fila agora"
                aside={
                    <Link className="dash-link" to="/dispatch">
                        Abrir despacho <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                }
            >
                {!q ? (
                    <Skeleton height={150} />
                ) : (
                    <DotMatrix
                        unit={{ one: "pedido", many: "pedidos" }}
                        columns={QUEUE_COLUMNS.map((c) => ({
                            key: c.key,
                            label: c.label,
                            count:
                                c.key === "unassigned"
                                    ? q.unassigned.total
                                    : c.key === "assigned"
                                      ? q.assignedNotDispatched.total
                                      : q.inProgress.total,
                            stale: staleByStage[c.stage] ?? 0,
                            color: c.color,
                            to: c.to,
                        }))}
                    />
                )}
            </DockPanel>
            <DockPanel
                title="Prontos para sair"
                aside={
                    q && <span className="micro">{q.assignedNotDispatched.total} atribuídos</span>
                }
            >
                {!q ? (
                    <Skeleton height={120} />
                ) : assigned.length === 0 ? (
                    <p className="dash-empty">Tudo que foi atribuído já saiu.</p>
                ) : (
                    <ul className="dash-olist">
                        {assigned.map((o) => {
                            const busy = dispatch.isPending && dispatch.variables === o.orderId;
                            return (
                                <li key={o.orderId} className="dash-orow">
                                    <Link className="dash-orow-main" to={`/orders/${o.orderId}`}>
                                        <b className="data">{o.trackingNumber}</b>
                                        <small>
                                            {o.pickupName} → {o.dropoffName} ·{" "}
                                            {formatMinutes(o.minutesInStage)}
                                        </small>
                                    </Link>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        disabled={busy}
                                        onClick={() => dispatch.mutate(o.orderId)}
                                    >
                                        {busy ? (
                                            <Loader2
                                                size={14}
                                                className="spin"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <Send size={14} aria-hidden="true" />
                                        )}
                                        Despachar
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </DockPanel>
            <DockPanel
                title="Parados"
                aside={q && <span className="micro">{q.stale?.total ?? 0} acima do limite</span>}
            >
                {!q ? (
                    <Skeleton height={120} />
                ) : stale.length === 0 ? (
                    <p className="dash-empty">Nada parado além do limite.</p>
                ) : (
                    <ul className="dash-olist">
                        {stale.map((o) => {
                            const critical = o.minutesInStage > 2 * o.limitMin;
                            return (
                                <li key={o.orderId}>
                                    <Link
                                        className={`dash-orow dash-orow-link${critical ? " is-critical" : ""}`}
                                        to={`/orders/${o.orderId}`}
                                    >
                                        <span className="dash-orow-main">
                                            <b className="data">{o.trackingNumber}</b>
                                            <small>
                                                <StatusBadge kind="funnel" value={o.stage} />
                                            </small>
                                        </span>
                                        <span className="dash-orow-time">
                                            {critical && (
                                                <span className="sr-only">
                                                    Muito acima do limite:{" "}
                                                </span>
                                            )}
                                            <b>{formatMinutes(o.minutesInStage)}</b>
                                            <small>limite {formatMinutes(o.limitMin)}</small>
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </DockPanel>
        </>
    );

    return <DashboardFrame hero={hero} right={right} dock={dock} />;
}
