import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { DriversPerformance, FleetPanel, FleetStatus, Page, Ref } from "../api/types";
import { ErrorState, Skeleton } from "../components/blocks";
import { formatMinutes, formatPercent } from "../components/format";
import GeneratedAt from "../components/GeneratedAt";
import { usePeriod } from "../components/PeriodSelect";
import RateValue from "../components/RateValue";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import { useMapScene } from "../map/useMapScene";
import HeroNumber from "../patterns/HeroNumber";
import {
    AlertChips,
    DashboardFrame,
    DockPanel,
    DriverList,
    PanelHead,
    StackBar,
    StatGrid,
    alertCountsOf,
} from "./dashboard/DashboardFrame";
import { dashboardScene } from "./dashboard/dashboardScene";
import {
    DashTitleActions,
    StatCell,
    dashboardPadding,
    useFramePoints,
    useNow,
} from "./dashboard/dashParts";
import { useChartColors, useDriverRowsLive } from "./dashboardParts";

const DRIVER_PARTS = [
    { key: "AVAILABLE", label: "Disponível", color: "var(--color-success)" },
    { key: "BUSY", label: "Ocupado", color: "var(--color-warning)" },
    { key: "OFFLINE", label: "Offline", color: "var(--color-offline)" },
];

const VEHICLE_PARTS = [
    { key: "AVAILABLE", label: "Livre", color: "var(--color-success)" },
    { key: "IN_USE", label: "Em uso", color: "var(--color-info)" },
    { key: "MAINTENANCE", label: "Manutenção", color: "var(--color-danger)" },
];

const dayLabel = (day: string) => day.slice(5).split("-").reverse().join("/");

const sum = (counts: Record<string, number>) =>
    Object.values(counts).reduce((total, n) => total + n, 0);

export default function FleetDashboard() {
    const [period] = usePeriod();
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const now = useNow(30_000);
    const [padding] = useState(dashboardPadding);
    const colors = useChartColors();
    const fleetId = params.get("fleetId") ?? "";
    const key = useMemo(() => ["dashboard", "fleet-panel", period], [period]);
    const panel = useQuery({
        queryKey: key,
        queryFn: () => request<FleetPanel>("GET", "/dashboard/fleet", undefined, { period }),
    });
    const fleets = useQuery({
        queryKey: ["fleets", "all"],
        queryFn: () => request<Page<Ref>>("GET", "/fleets", undefined, { limit: 100 }),
    });
    const statusKey = useMemo(() => ["dashboard", "fleet-status", fleetId], [fleetId]);
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

    const p = panel.data;
    const filtering = !!fleetId;
    const fleet = filtering ? filteredStatus.data : p?.fleet;
    const perf = filtering ? filteredPerf.data : p?.performance;
    const fleetGone = filtering && filteredStatus.isError;
    const loading = !p || (filtering && !fleetGone && (!fleet || !perf));

    const drivers = useMemo(() => fleet?.drivers ?? [], [fleet]);
    const driverIds = useMemo(() => new Set(drivers.map((d) => d.driverId)), [drivers]);
    const frame = useFramePoints(drivers);
    const scene = useMemo(
        () => dashboardScene({ drivers, now, padding, frame }),
        [drivers, now, padding, frame],
    );
    useMapScene(
        fleet
            ? {
                  ...scene,
                  onMarkerClick: (id) => {
                      if (driverIds.has(id)) navigate(`/map?driver=${id}`);
                  },
              }
            : null,
    );

    useTitleBlock({
        title: "Gestão de frota",
        meta: p ? (
            <GeneratedAt
                generatedAt={p.meta.generatedAt}
                timezone={p.meta.timezone}
                onRefresh={() => void panel.refetch()}
            />
        ) : undefined,
        actions: (
            <div className="dash-title-actions">
                <DashTitleActions />
                <Glass as="label" className="dash-fleet-select">
                    <span className="micro">Frota</span>
                    <select
                        aria-label="Frota"
                        value={fleetId}
                        onChange={(e) => setFleet(e.target.value)}
                    >
                        <option value="">Todas</option>
                        {fleets.data?.items.map((f) => (
                            <option key={f.publicId} value={f.publicId}>
                                {f.name}
                            </option>
                        ))}
                    </select>
                </Glass>
            </div>
        ),
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

    const total = fleet ? sum(fleet.driversByStatus) : 0;
    const vehicleTotal = fleet ? sum(fleet.vehiclesByStatus) : 0;
    const freeVehicles = fleet?.vehiclesByStatus.AVAILABLE ?? 0;
    const noSignal = drivers.filter((d) => d.pingStale).length;
    const perDay = (p?.sizing.perDay ?? []).map((d) => ({ ...d, label: dayLabel(d.day) }));
    const emptyDays = perDay.every((d) => d.ordersCreated === 0 && d.driversWithDelivery === 0);
    const driverPerf = perf?.drivers ?? [];
    const names = new Map(drivers.map((d) => [d.driverId, d.name]));
    const idle = (perf?.idleDriverIds ?? []).map((id) => ({ id, name: names.get(id) ?? id }));
    const sortedDrivers = [...drivers].sort(
        (a, b) =>
            Number(b.pingStale) - Number(a.pingStale) ||
            Number(a.status === "OFFLINE") - Number(b.status === "OFFLINE"),
    );
    const axis = { fill: colors["text-subtle"], fontSize: 11 };

    const hero = (
        <>
            {fleetGone && (
                <p className="notice notice-warning dash-hero-notice" role="alert">
                    Essa frota não existe mais.{" "}
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setFleet("")}
                    >
                        Ver todas
                    </button>
                </p>
            )}
            {loading || !fleet ? (
                !fleetGone && (
                    <div className="dash-hero-loading">
                        <Skeleton height={14} width={180} />
                        <Skeleton height={128} width={220} />
                        <Skeleton height={120} width={420} />
                    </div>
                )
            ) : (
                <>
                    <HeroNumber
                        label="Disponíveis agora"
                        value={fleet.availableDrivers}
                        caption={`de ${total} motoristas`}
                    />
                    <StatGrid>
                        <StatCell label="Ocupados" value={fleet.driversByStatus.BUSY ?? 0} />
                        <StatCell label="Offline" value={fleet.driversByStatus.OFFLINE ?? 0} />
                        <StatCell label="Sem sinal" value={noSignal} />
                        <StatCell label="Aguardando motorista" value={fleet.waitingOrders} />
                        <StatCell
                            label={`Veículos livres · ${freeVehicles} de ${vehicleTotal}`}
                            value={vehicleTotal === 0 ? null : (freeVehicles / vehicleTotal) * 100}
                            unit="%"
                        />
                        <StatCell
                            label="Em manutenção"
                            value={fleet.vehiclesByStatus.MAINTENANCE ?? 0}
                        />
                    </StatGrid>
                </>
            )}
        </>
    );

    const right = (
        <>
            <PanelHead
                title="Frota por status"
                aside={
                    <Link className="dash-link" to="/vehicles">
                        Veículos <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                }
            />
            {loading || !fleet ? (
                <Skeleton height={160} />
            ) : (
                <>
                    <StackBar
                        label="Motoristas por status"
                        parts={DRIVER_PARTS.map((part) => ({
                            ...part,
                            count: fleet.driversByStatus[part.key] ?? 0,
                        }))}
                    />
                    <StackBar
                        label="Veículos por status"
                        parts={VEHICLE_PARTS.map((part) => ({
                            ...part,
                            count: fleet.vehiclesByStatus[part.key] ?? 0,
                        }))}
                    />
                    <DriverList
                        rows={sortedDrivers}
                        now={now}
                        empty="Nenhum motorista nesta visão."
                    />
                </>
            )}
            {p && <AlertChips counts={alertCountsOf(p.alerts)} />}
        </>
    );

    const dock = (
        <>
            <DockPanel
                title="Desempenho por motorista"
                aside={<span className="micro">no período</span>}
            >
                {loading || !perf ? (
                    <Skeleton height={150} />
                ) : driverPerf.length === 0 ? (
                    <p className="dash-empty">
                        Sem entregas no período. Escolha um período maior para ver o desempenho.
                    </p>
                ) : (
                    <div className="dash-table-wrap">
                        <table className="dash-table" aria-label="Desempenho por motorista">
                            <thead>
                                <tr>
                                    <th scope="col">Motorista</th>
                                    <th scope="col" className="num">
                                        Pedidos
                                    </th>
                                    <th scope="col" className="num">
                                        Concl. / falhas
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
                                                className="dash-table-link"
                                                to={`/drivers/${d.driverId}`}
                                            >
                                                {d.name}
                                            </Link>
                                        </td>
                                        <td className="num">{d.orders}</td>
                                        <td className="num">
                                            {d.completed} / {d.failed}
                                        </td>
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
                )}
                {perf && idle.length > 0 && (
                    <div className="dash-idle">
                        <span className="micro">Sem entregas no período</span>
                        <ul className="dash-chips">
                            {idle.map((d) => (
                                <li key={d.id}>
                                    <Link className="chip-flat" to={`/drivers/${d.id}`}>
                                        {d.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </DockPanel>
            <DockPanel
                title="Demanda e cobertura"
                className="dash-panel-chart"
                aside={
                    p && (
                        <span className="micro">
                            {p.sizing.waitingOrders} aguardando · {p.sizing.availableDrivers} livres
                        </span>
                    )
                }
            >
                {!p ? (
                    <Skeleton height={150} />
                ) : emptyDays ? (
                    <p className="dash-chart-empty">Sem pedidos nos últimos dias.</p>
                ) : (
                    <>
                        <div className="dash-chart-legend">
                            <span>
                                <i style={{ background: "var(--color-accent)" }} />
                                Pedidos criados
                            </span>
                            <span>
                                <i style={{ background: "var(--color-text-subtle)" }} />
                                Motoristas com entrega
                            </span>
                        </div>
                        <div className="dash-chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={perDay}
                                    margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                                >
                                    <CartesianGrid
                                        vertical={false}
                                        stroke={colors["text-subtle"]}
                                        strokeOpacity={0.18}
                                    />
                                    <XAxis
                                        dataKey="label"
                                        tick={axis}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={axis}
                                        tickLine={false}
                                        axisLine={false}
                                        width={40}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: colors["surface-raised"],
                                            border: "none",
                                            borderRadius: 12,
                                            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.28)",
                                            color: colors.text,
                                        }}
                                        labelStyle={{ color: colors.text, fontWeight: 600 }}
                                        itemStyle={{ color: colors["text-muted"] }}
                                        cursor={{ fill: colors["text-subtle"], fillOpacity: 0.12 }}
                                    />
                                    <Bar
                                        dataKey="ordersCreated"
                                        name="Pedidos criados"
                                        fill={colors.accent}
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={18}
                                    />
                                    <Bar
                                        dataKey="driversWithDelivery"
                                        name="Motoristas com entrega"
                                        fill={colors["text-subtle"]}
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={18}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}
            </DockPanel>
        </>
    );

    return <DashboardFrame hero={hero} right={right} dock={dock} />;
}
