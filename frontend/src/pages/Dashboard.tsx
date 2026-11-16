import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, PackagePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { AdminPanel, FleetStatus } from "../api/types";
import { useSession } from "../auth/session";
import { ErrorState, Skeleton } from "../components/blocks";
import { formatKm, formatPercent } from "../components/format";
import GeneratedAt from "../components/GeneratedAt";
import { usePeriod } from "../components/PeriodSelect";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import { useMapScene } from "../map/useMapScene";
import DotMatrix from "../patterns/DotMatrix";
import HeroNumber from "../patterns/HeroNumber";
import CustomerDashboard from "./CustomerDashboard";
import {
    AlertChips,
    DashboardFrame,
    DockPanel,
    DriverList,
    HBars,
    PanelHead,
    StackBar,
    StatGrid,
} from "./dashboard/DashboardFrame";
import { dashboardScene } from "./dashboard/dashboardScene";
import {
    DashTitleActions,
    RateDelta,
    StatCell,
    dashboardPadding,
    periodLabel,
    rateText,
    useFramePoints,
    useNow,
} from "./dashboard/dashParts";
import { DeltaHint, STAGE_LABEL, useDriverRowsLive } from "./dashboardParts";
import DispatchDashboard from "./DispatchDashboard";
import FleetDashboard from "./FleetDashboard";

export const STAGES = [
    "UNASSIGNED",
    "ASSIGNED",
    "DISPATCHED",
    "DRIVER_ENROUTE",
    "ARRIVED",
    "IN_PROGRESS",
];

export const STAGE_COLOR: Record<string, string> = {
    UNASSIGNED: "var(--color-warning)",
    ASSIGNED: "var(--color-text-muted)",
    DISPATCHED: "var(--color-info)",
    DRIVER_ENROUTE: "var(--color-accent)",
    ARRIVED: "var(--color-accent)",
    IN_PROGRESS: "var(--color-success)",
};

export const stageLink = (stage: string) =>
    stage === "UNASSIGNED" || stage === "ASSIGNED"
        ? "/dispatch"
        : `/orders?status=${stage}&active=true`;

export const DRIVER_PARTS = [
    { key: "AVAILABLE", label: "Disponível", color: "var(--color-success)" },
    { key: "BUSY", label: "Ocupado", color: "var(--color-warning)" },
    { key: "OFFLINE", label: "Offline", color: "var(--color-offline)" },
];

const VEHICLE_PARTS = [
    { key: "AVAILABLE", label: "Livre", color: "var(--color-success)" },
    { key: "IN_USE", label: "Em uso", color: "var(--color-info)" },
    { key: "MAINTENANCE", label: "Manutenção", color: "var(--color-danger)" },
];

export default function Dashboard() {
    const role = useSession()?.role;
    if (role === "ADMIN") return <AdminDashboard />;
    if (role === "DISPATCHER") return <DispatchDashboard />;
    if (role === "FLEET_MANAGER") return <FleetDashboard />;
    return <CustomerDashboard />;
}

const FLEET_KEY = ["dashboard", "fleet", "status"];

function AdminDashboard() {
    const [period] = usePeriod();
    const navigate = useNavigate();
    const now = useNow(30_000);
    const [padding] = useState(dashboardPadding);
    const panel = useQuery({
        queryKey: ["dashboard", "admin", period],
        queryFn: () => request<AdminPanel>("GET", "/dashboard/admin", undefined, { period }),
    });
    const fleet = useQuery({
        queryKey: FLEET_KEY,
        queryFn: () => request<FleetStatus>("GET", "/dashboard/fleet/status"),
    });
    useDriverRowsLive<FleetStatus>(FLEET_KEY, (data) => [data.drivers]);

    const drivers = useMemo(() => fleet.data?.drivers ?? [], [fleet.data]);
    const driverIds = useMemo(() => new Set(drivers.map((d) => d.driverId)), [drivers]);
    const frame = useFramePoints(drivers);
    const scene = useMemo(
        () => dashboardScene({ drivers, now, padding, frame }),
        [drivers, now, padding, frame],
    );
    useMapScene(
        fleet.isSuccess
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
        title: "Visão geral",
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

    const s = p?.summary;
    const prev = s?.previous;
    const reasons = s?.topFailureReasons ?? [];
    const sortedDrivers = [...drivers].sort(
        (a, b) => Number(a.status === "OFFLINE") - Number(b.status === "OFFLINE"),
    );

    const hero = !s ? (
        <div className="dash-hero-loading">
            <Skeleton height={14} width={180} />
            <Skeleton height={128} width={260} />
            <Skeleton height={120} width={420} />
        </div>
    ) : (
        <>
            <HeroNumber
                label={`Taxa de sucesso · ${periodLabel(period)}`}
                value={s.successRate.rate == null ? null : s.successRate.rate * 100}
                unit="%"
                caption={`${s.successRate.n} pedidos finalizados`}
                delta={<RateDelta current={s.successRate} previous={prev?.successRate} />}
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
                        <DeltaHint current={s.completed} previous={prev?.completed} goodWhen="up" />
                    }
                />
                <StatCell
                    label={`Falhas · ${rateText(s.failureRate)}`}
                    value={s.failed}
                    delta={<DeltaHint current={s.failed} previous={prev?.failed} goodWhen="down" />}
                    sub={
                        <>
                            {`${s.cancelled} cancelados (${rateText(s.cancelRate)}) · ${s.cancelledByCustomer} pelo cliente · ${s.cancelledByStaff} pela equipe${s.cancelledByUnknown > 0 ? ` · ${s.cancelledByUnknown} sem autor` : ""}`}
                            <DeltaHint
                                current={s.cancelled}
                                previous={prev?.cancelled}
                                goodWhen="down"
                            />
                        </>
                    }
                />
                <StatCell label="Espera média" value={s.avgWaitMinutes} unit="min" />
                <StatCell label="Ciclo médio" value={s.avgCycleMinutes} unit="min" />
                <StatCell
                    label={`Prova de entrega · ${s.podRate.n}`}
                    value={s.podRate.rate == null ? null : s.podRate.rate * 100}
                    unit="%"
                />
            </StatGrid>
            {s.created === 0 && (
                <p className="notice dash-hero-notice">
                    Nenhum pedido neste período.{" "}
                    <Link to="/orders/new">
                        <PackagePlus size={16} aria-hidden="true" /> Crie um pedido
                    </Link>
                </p>
            )}
        </>
    );

    const right = (
        <>
            <PanelHead
                title="Frota agora"
                aside={
                    <Link className="dash-link" to="/map">
                        Mapa ao vivo <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                }
            />
            {!p ? (
                <Skeleton height={40} />
            ) : (
                <>
                    <StackBar
                        label="Motoristas por status"
                        parts={DRIVER_PARTS.map((part) => ({
                            ...part,
                            count: p.fleet.driversByStatus[part.key] ?? 0,
                        }))}
                    />
                    <StackBar
                        label="Veículos por status"
                        parts={VEHICLE_PARTS.map((part) => ({
                            ...part,
                            count: p.fleet.vehiclesByStatus[part.key] ?? 0,
                        }))}
                    />
                </>
            )}
            {fleet.isSuccess ? (
                <DriverList rows={sortedDrivers} now={now} empty="Nenhum motorista cadastrado." />
            ) : (
                <Skeleton height={160} />
            )}
            {p && <AlertChips counts={p.alertCounts} />}
        </>
    );

    const dock = (
        <>
            <DockPanel title="Funil agora">
                {p ? (
                    <DotMatrix
                        unit={{ one: "pedido", many: "pedidos" }}
                        columns={STAGES.map((stage) => ({
                            key: stage,
                            label: STAGE_LABEL[stage],
                            count: p.funnel.byStage[stage] ?? 0,
                            stale: p.funnel.staleByStage[stage] ?? 0,
                            color: STAGE_COLOR[stage],
                            to: stageLink(stage),
                        }))}
                    />
                ) : (
                    <Skeleton height={150} />
                )}
            </DockPanel>
            <DockPanel
                title="Motivos de falha"
                aside={s && <span className="micro">{s.failed} falhas</span>}
            >
                {!s ? (
                    <Skeleton height={120} />
                ) : reasons.length === 0 ? (
                    <p className="dash-empty">Sem falhas no período.</p>
                ) : (
                    <HBars
                        color="var(--color-danger)"
                        rows={reasons.map((r) => ({
                            key: r.reason,
                            label: r.reason,
                            value: r.count,
                        }))}
                    />
                )}
            </DockPanel>
            <DockPanel
                title="Economia de rotas"
                aside={
                    <Link className="dash-link" to="/analytics/routing">
                        Detalhes <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                }
            >
                {!p ? (
                    <Skeleton height={120} />
                ) : p.routing.routes === 0 ? (
                    <p className="dash-empty">
                        A economia aparece quando houver rotas planejadas no período.
                    </p>
                ) : (
                    <>
                        <HeroNumber
                            size="large"
                            label="Km economizados"
                            value={p.routing.savedKm}
                            unit="km"
                            delta={
                                p.routing.avgSavingsPct != null ? (
                                    <span className="delta delta-success">
                                        {formatPercent(p.routing.avgSavingsPct)} média
                                    </span>
                                ) : undefined
                            }
                        />
                        <p className="dash-saved-sub">
                            {p.routing.routes} rotas · planejado vs. ordem original
                        </p>
                        <div className="dash-cmp">
                            <CompareRow
                                label="Planejado"
                                km={p.routing.plannedKm}
                                max={Math.max(p.routing.plannedKm, p.routing.baselineKm)}
                                color="var(--color-accent)"
                            />
                            <CompareRow
                                label="Original"
                                km={p.routing.baselineKm}
                                max={Math.max(p.routing.plannedKm, p.routing.baselineKm)}
                                color="var(--color-text-subtle)"
                            />
                        </div>
                    </>
                )}
            </DockPanel>
        </>
    );

    return <DashboardFrame hero={hero} right={right} dock={dock} />;
}

export function CompareRow({
    label,
    km,
    max,
    color,
}: {
    label: string;
    km: number;
    max: number;
    color: string;
}) {
    return (
        <div className="dash-cmp-row">
            <span>{label}</span>
            <span className="dash-track" aria-hidden="true">
                <i style={{ width: `${max > 0 ? (km / max) * 100 : 0}%`, background: color }} />
            </span>
            <b>{formatKm(km)}</b>
        </div>
    );
}
