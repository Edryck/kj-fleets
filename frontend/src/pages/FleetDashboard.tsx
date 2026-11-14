import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Moon, Package, Truck, UserCheck, WifiOff } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { DriversPerformance, FleetPanel, FleetStatus, Page, Ref } from "../api/types";
import { EmptyState, ErrorState, KpiCard, Skeleton } from "../components/blocks";
import { formatAgo, formatMinutes, formatPercent } from "../components/format";
import { usePeriod } from "../components/PeriodSelect";
import RateValue from "../components/RateValue";
import StatusBadge from "../components/StatusBadge";
import { alertKey, sortAlerts } from "./alerts";
import { AlertRow } from "./DispatchDashboard";
import {
    DashHeader,
    legendProps,
    tooltipStyle,
    useChartColors,
    useDriverRowsLive,
} from "./dashboardParts";

const VEHICLE_SLICES = [
    { key: "AVAILABLE", label: "Disponível", color: "success" },
    { key: "IN_USE", label: "Em uso", color: "info" },
    { key: "MAINTENANCE", label: "Manutenção", color: "warning" },
] as const;

const dayLabel = (day: string) => day.slice(5).split("-").reverse().join("/");

export default function FleetDashboard() {
    const [period] = usePeriod();
    const [params, setParams] = useSearchParams();
    const fleetId = params.get("fleetId") ?? "";
    const colors = useChartColors();

    const key = ["dashboard", "fleet-panel", period];
    const panel = useQuery({
        queryKey: key,
        queryFn: () => request<FleetPanel>("GET", "/dashboard/fleet", undefined, { period }),
    });
    const fleets = useQuery({
        queryKey: ["fleets", "all"],
        queryFn: () => request<Page<Ref>>("GET", "/fleets", undefined, { limit: 100 }),
    });
    // com frota escolhida, status e desempenho vêm filtrados pelos endpoints próprios
    const statusKey = ["dashboard", "fleet-status", fleetId];
    const filteredStatus = useQuery({
        queryKey: statusKey,
        queryFn: () =>
            request<FleetStatus>("GET", "/dashboard/fleet/status", undefined, { fleetId }),
        enabled: !!fleetId,
    });
    const filteredPerf = useQuery({
        queryKey: ["dashboard", "fleet-perf", period, fleetId],
        queryFn: () =>
            request<DriversPerformance>("GET", "/dashboard/drivers/performance", undefined, {
                period,
                fleetId,
            }),
        enabled: !!fleetId,
    });
    useDriverRowsLive<FleetPanel>(key, (d) => [d.fleet.drivers, d.fleet.availableDriversList]);
    useDriverRowsLive<FleetStatus>(statusKey, (d) => [d.drivers, d.availableDriversList]);

    const setFleet = (value: string) =>
        setParams(
            (prev) => {
                const copy = new URLSearchParams(prev);
                if (value) copy.set("fleetId", value);
                else copy.delete("fleetId");
                return copy;
            },
            { replace: true },
        );

    const error = panel.isError ? panel.error : null;
    if (error) {
        const e = error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => panel.refetch()} />
        );
    }

    const p = panel.data;
    const filtering = !!fleetId;
    const fleet = filtering ? filteredStatus.data : p?.fleet;
    const perf = filtering ? filteredPerf.data : p?.performance;
    const fleetGone = filtering && filteredStatus.isError;
    const loading = !p || (filtering && !fleetGone && (!fleet || !perf));

    const vehicles = VEHICLE_SLICES.map((v) => ({
        ...v,
        value: fleet?.vehiclesByStatus[v.key] ?? 0,
    }));
    const vehicleTotal = vehicles.reduce((sum, v) => sum + v.value, 0);
    const availablePct = vehicleTotal === 0 ? null : (vehicles[0].value / vehicleTotal) * 100;
    const perDay = (p?.sizing.perDay ?? []).map((d) => ({ ...d, label: dayLabel(d.day) }));
    const driverPerf = perf?.drivers ?? [];
    const names = new Map(fleet?.drivers.map((d) => [d.driverId, d.name]));
    const idle = (perf?.idleDriverIds ?? []).map((id) => ({ id, name: names.get(id) ?? id }));
    const tip = tooltipStyle(colors);
    const axis = { fill: colors["text-muted"], fontSize: 12 };
    const alerts = sortAlerts(p?.alerts ?? []);

    return (
        <div className="stack dash">
            <DashHeader
                title="Gestão de frota"
                sub="Disponibilidade, carga e desempenho dos motoristas."
                generatedAt={p?.meta.generatedAt}
                timezone={p?.meta.timezone}
                onRefresh={() => void panel.refetch()}
            >
                <label className="inline-field">
                    <span className="caption">Frota</span>
                    <select value={fleetId} onChange={(e) => setFleet(e.target.value)}>
                        <option value="">Todas</option>
                        {fleets.data?.items.map((f) => (
                            <option key={f.publicId} value={f.publicId}>
                                {f.name}
                            </option>
                        ))}
                    </select>
                </label>
            </DashHeader>

            {fleetGone && (
                <p className="notice notice-warning dash-notice" role="alert">
                    Essa frota não existe mais.
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setFleet("")}
                    >
                        Ver todas
                    </button>
                </p>
            )}

            <div className="kpi-row">
                {loading || !fleet ? (
                    Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={104} />)
                ) : (
                    <>
                        <KpiCard
                            label="Aguardando motorista"
                            value={fleet.waitingOrders}
                            icon={Package}
                            to="/dispatch"
                        />
                        <KpiCard
                            label="Motoristas disponíveis"
                            value={fleet.availableDrivers}
                            icon={UserCheck}
                        />
                        <KpiCard
                            label="Motoristas ocupados"
                            value={fleet.driversByStatus.BUSY ?? 0}
                            icon={Truck}
                        />
                        <KpiCard
                            label="Motoristas offline"
                            value={fleet.driversByStatus.OFFLINE ?? 0}
                            icon={Moon}
                        />
                    </>
                )}
            </div>

            <div className="dash-grid dash-grid-even">
                <section className="card" aria-labelledby="veh-title">
                    <div className="card-head">
                        <h2 id="veh-title">Veículos por status</h2>
                        <Link to="/vehicles" className="table-link">
                            Ver veículos
                        </Link>
                    </div>
                    {loading || !fleet ? (
                        <Skeleton height={220} />
                    ) : vehicleTotal === 0 ? (
                        <EmptyState icon={Truck} title="Nenhum veículo cadastrado" />
                    ) : (
                        <div className="donut-wrap">
                            <div className="chart donut" style={{ height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={vehicles}
                                            dataKey="value"
                                            nameKey="label"
                                            innerRadius="62%"
                                            outerRadius="90%"
                                            stroke={colors["surface-raised"]}
                                            paddingAngle={2}
                                        >
                                            {vehicles.map((v) => (
                                                <Cell key={v.key} fill={colors[v.color]} />
                                            ))}
                                        </Pie>
                                        <Tooltip {...tip} />
                                        <Legend {...legendProps(colors)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="donut-center">
                                    <b>{formatPercent(availablePct)}</b>
                                    <span className="caption">disponíveis</span>
                                </div>
                            </div>
                            <ul className="count-list">
                                {vehicles.map((v) => (
                                    <li key={v.key}>
                                        <StatusBadge kind="vehicle" value={v.key} />
                                        <span className="data">{v.value}</span>
                                    </li>
                                ))}
                                <li className="caption">
                                    Percentual calculado aqui, a partir das contagens.
                                </li>
                            </ul>
                        </div>
                    )}
                </section>

                <section className="card" aria-labelledby="size-title">
                    <div className="card-head">
                        <h2 id="size-title">Demanda e cobertura por dia</h2>
                        <span className="caption">
                            {p
                                ? `${p.sizing.waitingOrders} aguardando, ${p.sizing.availableDrivers} livres`
                                : "—"}
                        </span>
                    </div>
                    {!p ? (
                        <Skeleton height={220} />
                    ) : perDay.every(
                          (d) => d.ordersCreated === 0 && d.driversWithDelivery === 0,
                      ) ? (
                        <EmptyState title="Sem pedidos nos últimos dias" />
                    ) : (
                        <div className="chart" style={{ height: 240 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={perDay} margin={{ right: 8 }}>
                                    <CartesianGrid vertical={false} stroke={colors.border} />
                                    <XAxis dataKey="label" tick={axis} stroke={colors.border} />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={axis}
                                        stroke={colors.border}
                                        width={36}
                                        label={{
                                            value: "Quantidade",
                                            angle: -90,
                                            position: "insideLeft",
                                            fill: colors["text-muted"],
                                            fontSize: 12,
                                        }}
                                    />
                                    <Tooltip {...tip} />
                                    <Legend {...legendProps(colors)} />
                                    <Bar
                                        dataKey="ordersCreated"
                                        name="Pedidos criados"
                                        fill={colors.primary}
                                        radius={[3, 3, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="driversWithDelivery"
                                        name="Motoristas com entrega"
                                        fill={colors.info}
                                        radius={[3, 3, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </section>
            </div>

            <section className="card" aria-labelledby="drv-title">
                <div className="card-head">
                    <h2 id="drv-title">Motoristas</h2>
                    <span className="caption">{fleet ? fleet.drivers.length : "—"}</span>
                </div>
                {loading || !fleet ? (
                    <Skeleton height={160} />
                ) : fleet.drivers.length === 0 ? (
                    <EmptyState title="Nenhum motorista nesta visão" />
                ) : (
                    <div className="table-scroll scroll-box scroll-tall">
                        <table className="table table-compact">
                            <thead>
                                <tr>
                                    <th scope="col">Motorista</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Veículo</th>
                                    <th scope="col">Pedido ativo</th>
                                    <th scope="col" className="num">
                                        Fila
                                    </th>
                                    <th scope="col">Último sinal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fleet.drivers.map((d) => (
                                    <tr key={d.driverId}>
                                        <td>
                                            <Link
                                                className="table-link"
                                                to={`/drivers/${d.driverId}`}
                                            >
                                                {d.name}
                                            </Link>
                                        </td>
                                        <td>
                                            <StatusBadge kind="driver" value={d.status} />
                                        </td>
                                        <td>
                                            {d.vehiclePlate ? (
                                                <span className="cell-stack">
                                                    <Link
                                                        className="table-link data"
                                                        to="/vehicles"
                                                    >
                                                        {d.vehiclePlate}
                                                    </Link>
                                                    {d.vehicleStatus && (
                                                        <StatusBadge
                                                            kind="vehicle"
                                                            value={d.vehicleStatus}
                                                        />
                                                    )}
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                        <td>
                                            {d.activeOrderId ? (
                                                <Link
                                                    className="table-link data"
                                                    to={`/orders/${d.activeOrderId}`}
                                                >
                                                    {d.activeOrderId}
                                                </Link>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                        <td className="num">{d.queueSize}</td>
                                        <td>
                                            {d.pingStale ? (
                                                <span className="badge badge-offline">
                                                    <WifiOff size={14} aria-hidden="true" />
                                                    Sem sinal
                                                </span>
                                            ) : (
                                                formatAgo(d.lastSeenAt)
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="card" aria-labelledby="perf-title">
                <div className="card-head">
                    <h2 id="perf-title">Desempenho por motorista</h2>
                    <span className="caption">no período</span>
                </div>
                {loading || !perf ? (
                    <Skeleton height={200} />
                ) : driverPerf.length === 0 ? (
                    <EmptyState
                        title="Sem entregas no período"
                        description="Escolha um período maior para ver o desempenho."
                    />
                ) : (
                    <>
                        <div
                            className="chart"
                            style={{ height: Math.max(180, driverPerf.length * 40 + 64) }}
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={driverPerf}
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
                                        dataKey="name"
                                        width={120}
                                        tick={axis}
                                        stroke={colors.border}
                                    />
                                    <Tooltip {...tip} />
                                    <Legend {...legendProps(colors)} />
                                    <Bar
                                        dataKey="completed"
                                        name="Concluídos"
                                        stackId="a"
                                        fill={colors.success}
                                    />
                                    <Bar
                                        dataKey="failed"
                                        name="Falhos"
                                        stackId="a"
                                        fill={colors.danger}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="table-scroll">
                            <table className="table table-compact">
                                <thead>
                                    <tr>
                                        <th scope="col">Motorista</th>
                                        <th scope="col" className="num">
                                            Pedidos
                                        </th>
                                        <th scope="col">Sucesso</th>
                                        <th scope="col" className="num">
                                            Despacho até chegada
                                        </th>
                                        <th scope="col" className="num">
                                            Ocupação
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {driverPerf.map((d) => (
                                        <tr key={d.driverId}>
                                            <td>
                                                <Link
                                                    className="table-link"
                                                    to={`/drivers/${d.driverId}`}
                                                >
                                                    {d.name}
                                                </Link>{" "}
                                            </td>
                                            <td className="num">{d.orders}</td>
                                            <td>
                                                <RateValue value={d.successRate} />
                                            </td>
                                            <td className="num">
                                                {formatMinutes(d.avgDispatchToArrivedMinutes)}
                                            </td>
                                            <td className="num">{formatPercent(d.busyPct)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
                {perf && idle.length > 0 && (
                    <div className="idle-row">
                        <span className="caption">Sem entregas no período</span>
                        <ul className="chips">
                            {idle.map((d) => (
                                <li key={d.id}>
                                    <Link className="chip" to={`/drivers/${d.id}`}>
                                        {d.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <section className="card" aria-labelledby="fleet-alerts">
                <div className="card-head">
                    <h2 id="fleet-alerts">Alertas</h2>
                    <Link to="/alerts" className="table-link">
                        Ver todos
                    </Link>
                </div>
                {!p ? (
                    <Skeleton height={80} />
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
    );
}
