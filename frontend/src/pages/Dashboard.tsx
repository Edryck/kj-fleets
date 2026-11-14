import { useQuery } from "@tanstack/react-query";
import {
    Ban,
    BellRing,
    CheckCircle2,
    CircleCheck,
    FilePlus2,
    PackagePlus,
    Route as RouteIcon,
    XCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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
import type { AdminPanel, AlertType } from "../api/types";
import { useSession } from "../auth/session";
import { EmptyState, ErrorState, KpiCard, Skeleton } from "../components/blocks";
import { formatKm, formatMinutes, formatPercent } from "../components/format";
import RateValue from "../components/RateValue";
import StatusBadge from "../components/StatusBadge";
import { usePeriod } from "../components/PeriodSelect";
import { ALERT_LABEL } from "./alerts";
import DispatchDashboard from "./DispatchDashboard";
import FleetDashboard from "./FleetDashboard";
import { PendingScreen } from "./SystemPages";
import {
    DashHeader,
    DeltaHint,
    STAGE_LABEL,
    legendProps,
    tooltipStyle,
    useChartColors,
} from "./dashboardParts";

const STAGES = ["UNASSIGNED", "ASSIGNED", "DISPATCHED", "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS"];

const stageLink = (stage: string) =>
    stage === "UNASSIGNED" || stage === "ASSIGNED"
        ? "/dispatch"
        : `/orders?status=${stage}&active=true`;

// /dashboard escolhe o painel pelo perfil; o cliente entra na tarefa seguinte
export default function Dashboard() {
    const role = useSession()?.role;
    if (role === "ADMIN") return <AdminDashboard />;
    if (role === "DISPATCHER") return <DispatchDashboard />;
    if (role === "FLEET_MANAGER") return <FleetDashboard />;
    return <PendingScreen title="Dashboard" />;
}

function AdminDashboard() {
    const [period] = usePeriod();
    const navigate = useNavigate();
    const colors = useChartColors();
    const panel = useQuery({
        queryKey: ["dashboard", "admin", period],
        queryFn: () => request<AdminPanel>("GET", "/dashboard/admin", undefined, { period }),
    });

    if (panel.isError) {
        const e = panel.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => panel.refetch()} />
        );
    }

    const p = panel.data;
    const s = p?.summary;
    const prev = s?.previous;
    const stages = STAGES.map((stage) => {
        const total = p?.funnel.byStage[stage] ?? 0;
        const stale = Math.min(p?.funnel.staleByStage[stage] ?? 0, total);
        return { stage, label: STAGE_LABEL[stage], onTime: total - stale, stale, total };
    });
    const funnelEmpty = stages.every((x) => x.total === 0);
    const reasons = s?.topFailureReasons ?? [];
    const alertTypes = Object.entries(p?.alertCounts ?? {}).filter(([, n]) => (n ?? 0) > 0);
    const cancelAuthors: [string, number][] = s
        ? [
              ["Cliente", s.cancelledByCustomer],
              ["Equipe", s.cancelledByStaff],
              ["Sem autor", s.cancelledByUnknown],
          ]
        : [];
    const tip = tooltipStyle(colors);
    const axis = { fill: colors["text-muted"], fontSize: 12 };

    return (
        <div className="stack dash">
            <DashHeader
                title="Visão geral"
                sub="Pedidos, frota e alertas da operação."
                generatedAt={p?.meta.generatedAt}
                timezone={p?.meta.timezone}
                onRefresh={() => void panel.refetch()}
            />

            {s && s.created === 0 && (
                <p className="notice notice-info dash-notice">
                    Nenhum pedido neste período.
                    <Link to="/orders/new">
                        <PackagePlus size={16} aria-hidden="true" /> Crie um pedido
                    </Link>
                </p>
            )}

            <div className="kpi-row">
                {!s ? (
                    Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={104} />)
                ) : (
                    <>
                        <KpiCard
                            label="Criados"
                            value={s.created}
                            icon={FilePlus2}
                            to="/orders"
                            hint={
                                <DeltaHint
                                    current={s.created}
                                    previous={prev?.created}
                                    goodWhen="neutral"
                                />
                            }
                        />
                        <KpiCard
                            label="Concluídos"
                            value={s.completed}
                            icon={CheckCircle2}
                            to="/orders?status=COMPLETED"
                            hint={
                                <DeltaHint
                                    current={s.completed}
                                    previous={prev?.completed}
                                    goodWhen="up"
                                />
                            }
                        />
                        <KpiCard
                            label="Falhos"
                            value={s.failed}
                            icon={XCircle}
                            to="/orders?status=FAILED"
                            hint={
                                <DeltaHint
                                    current={s.failed}
                                    previous={prev?.failed}
                                    goodWhen="down"
                                />
                            }
                        />
                        <KpiCard
                            label="Cancelados"
                            value={s.cancelled}
                            icon={Ban}
                            to="/orders?status=CANCELLED"
                            hint={
                                <DeltaHint
                                    current={s.cancelled}
                                    previous={prev?.cancelled}
                                    goodWhen="down"
                                />
                            }
                        />
                    </>
                )}
            </div>

            <section className="card" aria-labelledby="rates-title">
                <h2 id="rates-title">Resultados e tempos</h2>
                {!s ? (
                    <Skeleton height={64} />
                ) : (
                    <dl className="metrics">
                        <div>
                            <dt>Sucesso</dt>
                            <dd>
                                <RateValue value={s.successRate} />
                            </dd>
                        </div>
                        <div>
                            <dt>Falha</dt>
                            <dd>
                                <RateValue value={s.failureRate} />
                            </dd>
                        </div>
                        <div>
                            <dt>Cancelamento</dt>
                            <dd>
                                <RateValue value={s.cancelRate} />
                            </dd>
                        </div>
                        <div>
                            <dt>Com prova de entrega</dt>
                            <dd>
                                <RateValue value={s.podRate} />
                            </dd>
                        </div>
                        <div>
                            <dt>Espera até despacho</dt>
                            <dd>{formatMinutes(s.avgWaitMinutes)}</dd>
                        </div>
                        <div>
                            <dt>Despacho até conclusão</dt>
                            <dd>{formatMinutes(s.avgCycleMinutes)}</dd>
                        </div>
                    </dl>
                )}
            </section>

            <div className="dash-grid">
                <section className="card card-fill" aria-labelledby="funnel-title">
                    <div className="card-head">
                        <h2 id="funnel-title">Funil de pedidos</h2>
                        <span className="caption">Agora, não depende do período</span>
                    </div>
                    {!p ? (
                        <Skeleton height={260} />
                    ) : funnelEmpty ? (
                        <EmptyState
                            title="Nenhum pedido em andamento"
                            description="Os pedidos aparecem aqui assim que forem criados."
                        />
                    ) : (
                        <>
                            <div className="chart chart-fill">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={stages}
                                        layout="vertical"
                                        margin={{ left: 8, right: 16 }}
                                    >
                                        <CartesianGrid horizontal={false} stroke={colors.border} />
                                        <XAxis
                                            type="number"
                                            allowDecimals={false}
                                            tick={axis}
                                            stroke={colors.border}
                                            label={{
                                                value: "Pedidos",
                                                position: "insideBottomRight",
                                                offset: -2,
                                                fill: colors["text-muted"],
                                                fontSize: 12,
                                            }}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="label"
                                            width={120}
                                            tick={axis}
                                            stroke={colors.border}
                                        />
                                        <Tooltip {...tip} />
                                        <Legend {...legendProps(colors)} />
                                        <Bar
                                            dataKey="onTime"
                                            name="No prazo"
                                            stackId="a"
                                            fill={colors.primary}
                                            cursor="pointer"
                                            onClick={(_, i) => navigate(stageLink(STAGES[i]))}
                                        />
                                        <Bar
                                            dataKey="stale"
                                            name="Parados"
                                            stackId="a"
                                            fill={colors.warning}
                                            cursor="pointer"
                                            onClick={(_, i) => navigate(stageLink(STAGES[i]))}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <ul className="stage-links">
                                {stages.map((x) => (
                                    <li key={x.stage}>
                                        <Link to={stageLink(x.stage)}>
                                            {x.label}: {x.total}
                                            {x.stale > 0 && ` (${x.stale} parados)`}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>

                <div className="dash-side">
                    <section className="card" aria-labelledby="fleet-title">
                        <h2 id="fleet-title">Frota</h2>
                        {!p ? (
                            <Skeleton height={140} />
                        ) : (
                            <div className="count-groups">
                                <div>
                                    <p className="caption">Motoristas</p>
                                    {["AVAILABLE", "BUSY", "OFFLINE"].map((st) => (
                                        <Link key={st} to="/drivers" className="count-row">
                                            <StatusBadge kind="driver" value={st} />
                                            <span className="data">
                                                {p.fleet.driversByStatus[st] ?? 0}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                                <div>
                                    <p className="caption">Veículos</p>
                                    {["AVAILABLE", "IN_USE", "MAINTENANCE"].map((st) => (
                                        <Link key={st} to="/vehicles" className="count-row">
                                            <StatusBadge kind="vehicle" value={st} />
                                            <span className="data">
                                                {p.fleet.vehiclesByStatus[st] ?? 0}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                                <div className="count-foot">
                                    <span>
                                        Aguardando motorista{" "}
                                        <b className="data">{p.fleet.waitingOrders}</b>
                                    </span>
                                    <span>
                                        Motoristas disponíveis{" "}
                                        <b className="data">{p.fleet.availableDrivers}</b>
                                    </span>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="card" aria-labelledby="routing-title">
                        <div className="card-head">
                            <h2 id="routing-title">Economia de rotas</h2>
                            <Link to="/analytics/routing" className="table-link">
                                Detalhes
                            </Link>
                        </div>
                        {!p ? (
                            <Skeleton height={120} />
                        ) : p.routing.routes === 0 ? (
                            <EmptyState
                                icon={RouteIcon}
                                title="Nenhuma rota no período"
                                description="A economia aparece quando houver rotas planejadas."
                            />
                        ) : (
                            <dl className="metrics metrics-2">
                                <div>
                                    <dt>Rotas</dt>
                                    <dd>{p.routing.routes}</dd>
                                </div>
                                <div>
                                    <dt>Km economizados</dt>
                                    <dd>{formatKm(p.routing.savedKm)}</dd>
                                </div>
                                <div>
                                    <dt>Planejado</dt>
                                    <dd>{formatKm(p.routing.plannedKm)}</dd>
                                </div>
                                <div>
                                    <dt>Sem otimizar</dt>
                                    <dd>{formatKm(p.routing.baselineKm)}</dd>
                                </div>
                                <div>
                                    <dt>Economia média</dt>
                                    <dd>{formatPercent(p.routing.avgSavingsPct)}</dd>
                                </div>
                                <div>
                                    <dt>Despacho em lote</dt>
                                    <dd>
                                        <RateValue value={p.routing.batchDispatchPct} />
                                    </dd>
                                </div>
                            </dl>
                        )}
                    </section>
                </div>
            </div>

            <div className="dash-grid dash-grid-3">
                <section className="card" aria-labelledby="reasons-title">
                    <h2 id="reasons-title">Motivos de falha</h2>
                    {!s ? (
                        <Skeleton height={160} />
                    ) : reasons.length === 0 ? (
                        <EmptyState icon={CircleCheck} title="Sem falhas no período" />
                    ) : (
                        <div
                            className="chart"
                            style={{ height: Math.max(160, reasons.length * 44 + 48) }}
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={reasons}
                                    layout="vertical"
                                    margin={{ left: 8, right: 16 }}
                                >
                                    <CartesianGrid horizontal={false} stroke={colors.border} />
                                    <XAxis
                                        type="number"
                                        allowDecimals={false}
                                        tick={axis}
                                        stroke={colors.border}
                                        label={{
                                            value: "Falhas",
                                            position: "insideBottomRight",
                                            offset: -2,
                                            fill: colors["text-muted"],
                                            fontSize: 12,
                                        }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="reason"
                                        width={120}
                                        tick={axis}
                                        stroke={colors.border}
                                    />
                                    <Tooltip {...tip} />
                                    <Legend {...legendProps(colors)} />
                                    <Bar dataKey="count" name="Falhas" fill={colors.danger} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </section>

                <section className="card" aria-labelledby="cancel-title">
                    <h2 id="cancel-title">Cancelamentos por autor</h2>
                    {!s ? (
                        <Skeleton height={100} />
                    ) : (
                        <dl className="metrics metrics-1">
                            {cancelAuthors.map(([label, n]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{n}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </section>

                <section className="card" aria-labelledby="alerts-title">
                    <div className="card-head">
                        <h2 id="alerts-title">Alertas</h2>
                        <Link to="/alerts" className="table-link">
                            Ver todos
                        </Link>
                    </div>
                    {!p ? (
                        <Skeleton height={100} />
                    ) : alertTypes.length === 0 ? (
                        <EmptyState icon={CircleCheck} title="Nenhum alerta agora" />
                    ) : (
                        <ul className="chips">
                            {alertTypes.map(([type, n]) => (
                                <li key={type}>
                                    <Link className="chip" to={`/alerts?type=${type}`}>
                                        <BellRing size={14} aria-hidden="true" />
                                        {ALERT_LABEL[type as AlertType] ?? type}
                                        <span className="chip-count">{n}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
