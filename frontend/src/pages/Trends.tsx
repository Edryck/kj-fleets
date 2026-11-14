import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { YearlyTrends } from "../api/types";
import { useSession } from "../auth/session";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import GeneratedAt from "../components/GeneratedAt";
import { formatMinutes } from "../components/format";
import { legendProps, tooltipStyle, useChartColors } from "./dashboardParts";

// "2026-11" -> "11/26"; o último mês é o corrente, ainda parcial
const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(2, 4)}`;

export default function Trends() {
    const staff = useSession()?.role !== "CUSTOMER";
    const colors = useChartColors();
    const panel = useQuery({
        queryKey: ["analytics", "trends"],
        queryFn: () => request<YearlyTrends>("GET", "/dashboard/trends/yearly"),
    });
    const p = panel.data;

    const months = useMemo(
        () =>
            (p?.months ?? []).map((m, i, all) => ({
                ...m,
                label: monthLabel(m.month) + (i === all.length - 1 ? "*" : ""),
                successPct: m.successRate.rate == null ? null : m.successRate.rate * 100,
            })),
        [p],
    );
    const drivers = useMemo(() => {
        const byId = new Map<
            string,
            { driverId: string; name: string; cells: Map<string, number> }
        >();
        for (const row of p?.byDriver ?? []) {
            const entry = byId.get(row.driverId) ?? {
                driverId: row.driverId,
                name: row.name,
                cells: new Map<string, number>(),
            };
            entry.cells.set(row.month, row.completed);
            byId.set(row.driverId, entry);
        }
        return [...byId.values()];
    }, [p]);

    if (panel.isError) {
        const e = panel.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => panel.refetch()} />
        );
    }

    const tip = tooltipStyle(colors);
    const axis = { fill: colors["text-muted"], fontSize: 12 };
    const hasOrders = months.some((m) => m.created > 0);

    return (
        <div className="stack dash">
            <header className="dash-head">
                <div className="dash-title">
                    <h1>Tendência anual</h1>
                    <p className="page-sub">
                        Últimos 13 meses. Cada mês conta os pedidos criados nele.
                    </p>
                </div>
                {p && (
                    <div className="dash-tools">
                        <GeneratedAt
                            generatedAt={p.meta.generatedAt}
                            timezone={p.meta.timezone}
                            onRefresh={() => void panel.refetch()}
                        />
                    </div>
                )}
            </header>

            {!p ? (
                <Skeleton height={320} />
            ) : !hasOrders ? (
                <section className="card">
                    <EmptyState
                        title="Nenhum pedido nos últimos 13 meses"
                        description="Os gráficos aparecem quando houver pedidos criados."
                    />
                </section>
            ) : (
                <>
                    <section className="card" aria-labelledby="orders-title">
                        <div className="card-head">
                            <h2 id="orders-title">Pedidos por mês</h2>
                            <span className="caption">* mês atual, parcial</span>
                        </div>
                        <div className="chart" style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={months} margin={{ right: 8 }}>
                                    <CartesianGrid vertical={false} stroke={colors.border} />
                                    <XAxis dataKey="label" tick={axis} stroke={colors.border} />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={axis}
                                        stroke={colors.border}
                                        width={36}
                                    />
                                    <Tooltip {...tip} />
                                    <Legend {...legendProps(colors)} />
                                    <Bar
                                        dataKey="completed"
                                        name="Concluídos"
                                        stackId="orders"
                                        fill={colors.success}
                                    />
                                    <Bar
                                        dataKey="failed"
                                        name="Falhos"
                                        stackId="orders"
                                        fill={colors.danger}
                                    />
                                    <Bar
                                        dataKey="cancelled"
                                        name="Cancelados"
                                        stackId="orders"
                                        fill={colors.offline}
                                        radius={[3, 3, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    <section className="card" aria-labelledby="rate-title">
                        <div className="card-head">
                            <h2 id="rate-title">Taxa de sucesso</h2>
                            <span className="caption">% dos pedidos criados no mês</span>
                        </div>
                        {!months.some((m) => m.successPct != null) ? (
                            <EmptyState title="Sem pedidos com resultado fechado" />
                        ) : (
                            <div className="chart" style={{ height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={months} margin={{ right: 8 }}>
                                        <CartesianGrid vertical={false} stroke={colors.border} />
                                        <XAxis dataKey="label" tick={axis} stroke={colors.border} />
                                        <YAxis
                                            domain={[0, 100]}
                                            unit="%"
                                            tick={axis}
                                            stroke={colors.border}
                                            width={44}
                                        />
                                        <Tooltip {...tip} />
                                        <Line
                                            type="monotone"
                                            dataKey="successPct"
                                            name="Sucesso"
                                            stroke={colors.primary}
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>

                    {staff && (
                        <div className="dash-grid dash-grid-even">
                            <section className="card" aria-labelledby="cycle-title">
                                <div className="card-head">
                                    <h2 id="cycle-title">Ciclo médio</h2>
                                    <span className="caption">
                                        minutos, do despacho à conclusão
                                    </span>
                                </div>
                                {months.some((m) => m.avgCycleMinutes != null) ? (
                                    <div className="chart" style={{ height: 240 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={months} margin={{ right: 8 }}>
                                                <CartesianGrid
                                                    vertical={false}
                                                    stroke={colors.border}
                                                />
                                                <XAxis
                                                    dataKey="label"
                                                    tick={axis}
                                                    stroke={colors.border}
                                                />
                                                <YAxis
                                                    tick={axis}
                                                    stroke={colors.border}
                                                    width={36}
                                                    allowDecimals={false}
                                                />
                                                <Tooltip
                                                    {...tip}
                                                    formatter={(v) => formatMinutes(Number(v))}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="avgCycleMinutes"
                                                    name="Ciclo médio"
                                                    stroke={colors.info}
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <EmptyState title="Sem dados no período" />
                                )}
                            </section>

                            <section className="card" aria-labelledby="km-title">
                                <div className="card-head">
                                    <h2 id="km-title">Km economizados</h2>
                                    <span className="caption">
                                        roteirização contra a referência
                                    </span>
                                </div>
                                {months.some((m) => m.savedKm != null) ? (
                                    <div className="chart" style={{ height: 240 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={months} margin={{ right: 8 }}>
                                                <CartesianGrid
                                                    vertical={false}
                                                    stroke={colors.border}
                                                />
                                                <XAxis
                                                    dataKey="label"
                                                    tick={axis}
                                                    stroke={colors.border}
                                                />
                                                <YAxis
                                                    tick={axis}
                                                    stroke={colors.border}
                                                    width={44}
                                                />
                                                <Tooltip {...tip} />
                                                <Bar
                                                    dataKey="savedKm"
                                                    name="Km economizados"
                                                    fill={colors.primary}
                                                    radius={[3, 3, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <EmptyState title="Sem dados no período" />
                                )}
                            </section>
                        </div>
                    )}

                    {staff && (
                        <section className="card" aria-labelledby="driver-title">
                            <div className="card-head">
                                <h2 id="driver-title">Entregas por motorista</h2>
                                <span className="caption">concluídas por mês</span>
                            </div>
                            {drivers.length === 0 ? (
                                <EmptyState title="Nenhuma entrega concluída no período" />
                            ) : (
                                <DriverHeatmap
                                    months={months.map((m) => m.month)}
                                    drivers={drivers}
                                />
                            )}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

// células vazias são "—": a API não manda o mês quando não houve entrega
function DriverHeatmap({
    months,
    drivers,
}: {
    months: string[];
    drivers: { driverId: string; name: string; cells: Map<string, number> }[];
}) {
    const max = Math.max(1, ...drivers.flatMap((d) => [...d.cells.values()]));
    return (
        <div className="table-scroll">
            <table className="table heatmap">
                <thead>
                    <tr>
                        <th scope="col">Motorista</th>
                        {months.map((m) => (
                            <th key={m} scope="col" className="num">
                                {monthLabel(m)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {drivers.map((d) => (
                        <tr key={d.driverId}>
                            <th scope="row">{d.name}</th>
                            {months.map((m) => {
                                const value = d.cells.get(m);
                                return (
                                    <td
                                        key={m}
                                        className="num data"
                                        style={
                                            value
                                                ? {
                                                      background: `color-mix(in srgb, var(--color-primary) ${Math.round((value / max) * 70)}%, transparent)`,
                                                  }
                                                : undefined
                                        }
                                    >
                                        {value ?? "—"}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
