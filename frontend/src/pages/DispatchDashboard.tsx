import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Layers, Loader2, Package, Users, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Alert, DispatchPanel, DriverRow } from "../api/types";
import { EmptyState, ErrorState, KpiCard, Skeleton } from "../components/blocks";
import { formatAgo, formatMinutes } from "../components/format";
import { usePeriod } from "../components/PeriodSelect";
import RateValue from "../components/RateValue";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import { ALERT_LABEL, alertKey, sortAlerts, subjectLink } from "./alerts";
import { DashHeader, useDriverRowsLive } from "./dashboardParts";

export function AlertRow({ alert }: { alert: Alert }) {
    const link = subjectLink(alert);
    return (
        <li className="alert-row">
            <StatusBadge kind="severity" value={alert.severity} />
            <div className="alert-text">
                <span>{alert.message}</span>
                <span className="caption">
                    {ALERT_LABEL[alert.type] ?? alert.type} · {formatAgo(alert.since)}
                    {link && (
                        <>
                            {" · "}
                            <Link className="table-link data" to={link}>
                                {alert.subjectId}
                            </Link>
                        </>
                    )}
                </span>
                {alert.suggestedAction && <span className="caption">{alert.suggestedAction}</span>}
            </div>
        </li>
    );
}

export function DriverList({ rows }: { rows: DriverRow[] }) {
    return (
        <ul className="driver-list">
            {rows.map((d) => (
                <li key={d.driverId}>
                    <div className="driver-main">
                        <Link className="table-link" to={`/drivers/${d.driverId}`}>
                            {d.name}
                        </Link>
                        <span className="caption">
                            {d.vehiclePlate ? (
                                <span className="data">{d.vehiclePlate}</span>
                            ) : (
                                "Sem veículo"
                            )}
                            {" · "}
                            {d.lastSeenAt ? `visto ${formatAgo(d.lastSeenAt)}` : "nunca visto"}
                        </span>
                    </div>
                    {d.pingStale ? (
                        <span className="badge badge-offline">
                            <WifiOff size={14} aria-hidden="true" />
                            Sem sinal
                        </span>
                    ) : (
                        <StatusBadge kind="driver" value={d.status} />
                    )}
                </li>
            ))}
        </ul>
    );
}

export default function DispatchDashboard() {
    const [period] = usePeriod();
    const client = useQueryClient();
    const key = ["dashboard", "dispatch-panel", period];
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

    if (panel.isError) {
        const e = panel.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => panel.refetch()} />
        );
    }

    const p = panel.data;
    const q = p?.queue;
    const alerts = sortAlerts(p?.alerts ?? []);

    return (
        <div className="stack dash">
            <DashHeader
                title="Central de despacho"
                sub="Filas, motoristas livres e alertas de quem opera."
                generatedAt={p?.meta.generatedAt}
                timezone={p?.meta.timezone}
                onRefresh={() => void panel.refetch()}
            >
                <Link className="btn btn-primary" to="/dispatch">
                    <Layers size={18} aria-hidden="true" />
                    Abrir despacho em lote
                </Link>
            </DashHeader>

            <div className="kpi-row">
                {!p ? (
                    Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={104} />)
                ) : (
                    <>
                        <KpiCard
                            label="Aguardando motorista"
                            value={p.counts.waitingOrders}
                            icon={Package}
                            to="/dispatch"
                        />
                        <KpiCard
                            label="Motoristas disponíveis"
                            value={p.counts.availableDrivers}
                            icon={Users}
                            to="/drivers"
                        />
                        <KpiCard
                            label="Pedidos no período"
                            value={p.summary.created}
                            icon={Package}
                            to="/orders"
                            hint={`${p.summary.completed} concluídos, ${p.summary.failed} falhos, ${p.summary.cancelled} cancelados`}
                        />
                        <KpiCard
                            label="Taxa de sucesso"
                            value={<RateValue value={p.summary.successRate} />}
                            icon={CircleCheck}
                        />
                    </>
                )}
            </div>

            <div className="dash-cols">
                <div className="stack">
                    <section className="card" aria-labelledby="q-unassigned">
                        <div className="card-head">
                            <h2 id="q-unassigned">Sem motorista</h2>
                            <span className="caption">{q ? q.unassigned.total : "—"} na fila</span>
                        </div>
                        {!q ? (
                            <Skeleton height={120} />
                        ) : q.unassigned.items.length === 0 ? (
                            <EmptyState title="Nada esperando motorista" />
                        ) : (
                            <div className="table-scroll scroll-box">
                                <table className="table table-compact">
                                    <thead>
                                        <tr>
                                            <th scope="col">Pedido</th>
                                            <th scope="col">Trajeto</th>
                                            <th scope="col" className="num">
                                                Esperando
                                            </th>
                                            <th scope="col">
                                                <span className="sr-only">Ação</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {q.unassigned.items.map((o) => (
                                            <tr key={o.orderId}>
                                                <td>
                                                    <Link
                                                        className="table-link data"
                                                        to={`/orders/${o.orderId}`}
                                                    >
                                                        {o.trackingNumber}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <div className="route-cell">
                                                        <span>{o.pickupName}</span>
                                                        <span className="caption">
                                                            para {o.dropoffName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="num">
                                                    {formatMinutes(o.minutesInStage)}
                                                </td>
                                                <td className="num">
                                                    <Link
                                                        className="btn btn-secondary btn-sm"
                                                        to={`/orders/${o.orderId}`}
                                                    >
                                                        Atribuir
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="card" aria-labelledby="q-assigned">
                        <div className="card-head">
                            <h2 id="q-assigned">Atribuídos sem despacho</h2>
                            <span className="caption">
                                {q ? q.assignedNotDispatched.total : "—"} na fila
                            </span>
                        </div>
                        {!q ? (
                            <Skeleton height={100} />
                        ) : q.assignedNotDispatched.items.length === 0 ? (
                            <EmptyState title="Tudo que foi atribuído já saiu" />
                        ) : (
                            <div className="table-scroll scroll-box">
                                <table className="table table-compact">
                                    <thead>
                                        <tr>
                                            <th scope="col">Pedido</th>
                                            <th scope="col">Trajeto</th>
                                            <th scope="col" className="num">
                                                Esperando
                                            </th>
                                            <th scope="col">
                                                <span className="sr-only">Ação</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {q.assignedNotDispatched.items.map((o) => (
                                            <tr key={o.orderId}>
                                                <td>
                                                    <Link
                                                        className="table-link data"
                                                        to={`/orders/${o.orderId}`}
                                                    >
                                                        {o.trackingNumber}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <div className="route-cell">
                                                        <span>{o.pickupName}</span>
                                                        <span className="caption">
                                                            para {o.dropoffName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="num">
                                                    {formatMinutes(o.minutesInStage)}
                                                </td>
                                                <td className="num">
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        disabled={
                                                            dispatch.isPending &&
                                                            dispatch.variables === o.orderId
                                                        }
                                                        onClick={() => dispatch.mutate(o.orderId)}
                                                    >
                                                        {dispatch.isPending &&
                                                            dispatch.variables === o.orderId && (
                                                                <Loader2
                                                                    size={14}
                                                                    className="spin"
                                                                    aria-hidden="true"
                                                                />
                                                            )}
                                                        Despachar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="card" aria-labelledby="q-progress">
                        <div className="card-head">
                            <h2 id="q-progress">Em andamento</h2>
                            <span className="caption">{q ? q.inProgress.total : "—"} pedidos</span>
                        </div>
                        {!q ? (
                            <Skeleton height={100} />
                        ) : q.inProgress.items.length === 0 ? (
                            <EmptyState title="Nenhuma entrega em andamento" />
                        ) : (
                            <div className="table-scroll scroll-box">
                                <table className="table table-compact">
                                    <thead>
                                        <tr>
                                            <th scope="col">Pedido</th>
                                            <th scope="col">Status</th>
                                            <th scope="col">Motorista</th>
                                            <th scope="col">Paradas</th>
                                            <th scope="col" className="num">
                                                ETA
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {q.inProgress.items.map((o) => (
                                            <tr key={o.orderId}>
                                                <td>
                                                    <Link
                                                        className="table-link data"
                                                        to={`/orders/${o.orderId}`}
                                                    >
                                                        {o.orderId}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <StatusBadge kind="order" value={o.status} />
                                                </td>
                                                <td>{o.driverName ?? "—"}</td>
                                                <td>
                                                    <div
                                                        className="progress"
                                                        title={`${o.stopsDone} de ${o.stopsTotal} paradas`}
                                                    >
                                                        <progress
                                                            value={o.stopsDone}
                                                            max={Math.max(o.stopsTotal, 1)}
                                                        />
                                                        <span className="caption data">
                                                            {o.stopsDone}/{o.stopsTotal}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="num">
                                                    {formatMinutes(o.etaMinutes)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="card" aria-labelledby="q-stale">
                        <div className="card-head">
                            <h2 id="q-stale">Parados</h2>
                            <span className="caption">
                                {q?.stale ? q.stale.total : "—"} acima do limite
                            </span>
                        </div>
                        {!q ? (
                            <Skeleton height={100} />
                        ) : !q.stale || q.stale.items.length === 0 ? (
                            <EmptyState icon={CircleCheck} title="Nada parado além do limite" />
                        ) : (
                            <div className="table-scroll scroll-box">
                                <table className="table table-compact">
                                    <thead>
                                        <tr>
                                            <th scope="col">Pedido</th>
                                            <th scope="col">Etapa</th>
                                            <th scope="col" className="num">
                                                Tempo
                                            </th>
                                            <th scope="col" className="num">
                                                Limite
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {q.stale.items.map((o) => {
                                            const critical = o.minutesInStage > 2 * o.limitMin;
                                            return (
                                                <tr
                                                    key={o.orderId}
                                                    className={
                                                        critical ? "row-critical" : undefined
                                                    }
                                                >
                                                    <td>
                                                        <Link
                                                            className="table-link data"
                                                            to={`/orders/${o.orderId}`}
                                                        >
                                                            {o.trackingNumber}
                                                        </Link>
                                                    </td>
                                                    <td>
                                                        <StatusBadge
                                                            kind="funnel"
                                                            value={o.stage}
                                                        />
                                                    </td>
                                                    <td className="num">
                                                        {critical && (
                                                            <span className="sr-only">
                                                                Muito acima do limite:{" "}
                                                            </span>
                                                        )}
                                                        {formatMinutes(o.minutesInStage)}
                                                    </td>
                                                    <td className="num">
                                                        {formatMinutes(o.limitMin)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>

                <div className="stack">
                    <section className="card" aria-labelledby="free-drivers">
                        <div className="card-head">
                            <h2 id="free-drivers">Motoristas livres</h2>
                            <span className="caption">{p ? p.availableDrivers.length : "—"}</span>
                        </div>
                        {!p ? (
                            <Skeleton height={120} />
                        ) : p.availableDrivers.length === 0 ? (
                            <EmptyState icon={Users} title="Nenhum motorista livre" />
                        ) : (
                            <DriverList rows={p.availableDrivers} />
                        )}
                    </section>

                    <section className="card" aria-labelledby="op-alerts">
                        <div className="card-head">
                            <h2 id="op-alerts">Alertas</h2>
                            <Link to="/alerts" className="table-link">
                                Ver todos
                            </Link>
                        </div>
                        {!p ? (
                            <Skeleton height={100} />
                        ) : alerts.length === 0 ? (
                            <EmptyState icon={CircleCheck} title="Nenhum alerta agora" />
                        ) : (
                            <ul className="alert-list">
                                {alerts.map((a, i) => (
                                    <AlertRow key={alertKey(a, i)} alert={a} />
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
