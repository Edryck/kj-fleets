import { useQuery } from "@tanstack/react-query";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
    Area,
    AreaChart,
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
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import { prefersReducedMotion } from "../motion/reducedMotion";
import HeroNumber from "../patterns/HeroNumber";
import { legendProps, tooltipStyle, useChartColors } from "./dashboardParts";

const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(2, 4)}`;

function ChartCard({
    id,
    title,
    caption,
    index,
    children,
}: {
    id: string;
    title: string;
    caption: string;
    index: number;
    children: ReactNode;
}) {
    return (
        <Glass
            as="section"
            className="insight-card"
            aria-labelledby={id}
            style={{ "--i": index } as CSSProperties}
        >
            <div className="insight-card-head">
                <h2 id={id}>{title}</h2>
                <span className="caption">{caption}</span>
            </div>
            {children}
        </Glass>
    );
}

export default function Trends() {
    const staff = useSession()?.role !== "CUSTOMER";
    const colors = useChartColors();
    const animate = !prefersReducedMotion();
    const panel = useQuery({
        queryKey: ["analytics", "trends"],
        queryFn: () => request<YearlyTrends>("GET", "/dashboard/trends/yearly"),
    });
    const p = panel.data;

    useTitleBlock({
        title: "Tendência anual",
        meta: p ? (
            <GeneratedAt
                generatedAt={p.meta.generatedAt}
                timezone={p.meta.timezone}
                onRefresh={() => void panel.refetch()}
            />
        ) : undefined,
    });

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

    if (!p) {
        return (
            <div className="insight" aria-busy="true">
                <Skeleton height={360} />
                <Skeleton height={240} />
            </div>
        );
    }

    const tip = tooltipStyle(colors);
    const axis = { fill: colors["text-muted"], fontSize: 12 };
    const total = months.reduce((sum, m) => sum + m.created, 0);
    const hasOrders = total > 0;
    const motion = { isAnimationActive: animate, animationDuration: 1200 };

    return (
        <div className="insight">
            <Glass as="section" className="insight-hero trend-hero" aria-labelledby="orders-title">
                <HeroNumber
                    label="Pedidos no ano"
                    value={total}
                    caption={`${months.length} meses, o atual ainda parcial`}
                />
                <div className="trend-curve">
                    <div className="insight-card-head">
                        <h2 id="orders-title">Pedidos por mês</h2>
                        <span className="caption">* mês atual, parcial</span>
                    </div>
                    {hasOrders ? (
                        <div className="chart" style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={months} margin={{ top: 8, right: 8 }}>
                                    <defs>
                                        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                                            <stop
                                                offset="0%"
                                                stopColor={colors.accent}
                                                stopOpacity={0.4}
                                            />
                                            <stop
                                                offset="100%"
                                                stopColor={colors.accent}
                                                stopOpacity={0}
                                            />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                        vertical={false}
                                        stroke={colors.border}
                                        strokeDasharray="2 6"
                                    />
                                    <XAxis dataKey="label" tick={axis} stroke={colors.border} />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={axis}
                                        stroke={colors.border}
                                        width={36}
                                    />
                                    <Tooltip {...tip} />
                                    <Area
                                        type="monotone"
                                        dataKey="created"
                                        name="Pedidos criados"
                                        stroke={colors.primary}
                                        strokeWidth={2.5}
                                        fill="url(#trend-fill)"
                                        {...motion}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState
                            title="Nenhum pedido nos últimos 13 meses"
                            description="Os gráficos aparecem quando houver pedidos criados."
                        />
                    )}
                </div>
            </Glass>

            {hasOrders && (
                <>
                    <div className="insight-grid">
                        <ChartCard
                            id="outcome-title"
                            title="Resultado por mês"
                            caption="pedidos criados no mês, pelo desfecho"
                            index={1}
                        >
                            <div className="chart" style={{ height: 240 }}>
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
                                            {...motion}
                                        />
                                        <Bar
                                            dataKey="failed"
                                            name="Falhos"
                                            stackId="orders"
                                            fill={colors.danger}
                                            {...motion}
                                        />
                                        <Bar
                                            dataKey="cancelled"
                                            name="Cancelados"
                                            stackId="orders"
                                            fill={colors.offline}
                                            radius={[4, 4, 0, 0]}
                                            {...motion}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard
                            id="rate-title"
                            title="Taxa de sucesso"
                            caption="% dos pedidos criados no mês"
                            index={2}
                        >
                            {!months.some((m) => m.successPct != null) ? (
                                <EmptyState title="Sem pedidos com resultado fechado" />
                            ) : (
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
                                                {...motion}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </ChartCard>
                    </div>

                    {staff && (
                        <div className="insight-grid">
                            <ChartCard
                                id="cycle-title"
                                title="Ciclo médio"
                                caption="minutos, do despacho à conclusão"
                                index={3}
                            >
                                {months.some((m) => m.avgCycleMinutes != null) ? (
                                    <div className="chart" style={{ height: 220 }}>
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
                                                    {...motion}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <EmptyState title="Sem dados no período" />
                                )}
                            </ChartCard>

                            <ChartCard
                                id="km-title"
                                title="Km economizados"
                                caption="roteirização contra a referência"
                                index={4}
                            >
                                {months.some((m) => m.savedKm != null) ? (
                                    <div className="chart" style={{ height: 220 }}>
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
                                                    radius={[4, 4, 0, 0]}
                                                    {...motion}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <EmptyState title="Sem dados no período" />
                                )}
                            </ChartCard>
                        </div>
                    )}

                    {staff && (
                        <ChartCard
                            id="driver-title"
                            title="Entregas por motorista"
                            caption="concluídas por mês"
                            index={5}
                        >
                            {drivers.length === 0 ? (
                                <EmptyState title="Nenhuma entrega concluída no período" />
                            ) : (
                                <DriverHeatmap
                                    months={months.map((m) => m.month)}
                                    drivers={drivers}
                                />
                            )}
                        </ChartCard>
                    )}
                </>
            )}
        </div>
    );
}

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
                                                      background: `color-mix(in srgb, var(--color-route) ${Math.round((value / max) * 70)}%, transparent)`,
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
