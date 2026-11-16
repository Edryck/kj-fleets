import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { DriverRow } from "../api/types";
import { useSession } from "../auth/session";
import GeneratedAt from "../components/GeneratedAt";
import { kpiDelta } from "../components/kpiDelta";
import PeriodSelect from "../components/PeriodSelect";
import { useTopic, type LocationEvent } from "../realtime/useTopic";

export const STAGE_LABEL: Record<string, string> = {
    UNASSIGNED: "Sem motorista",
    ASSIGNED: "Atribuído",
    DISPATCHED: "Despachado",
    DRIVER_ENROUTE: "A caminho",
    ARRIVED: "Chegou",
    IN_PROGRESS: "Em andamento",
};

const COLOR_VARS = [
    "primary",
    "success",
    "warning",
    "danger",
    "info",
    "offline",
    "border",
    "surface-raised",
    "text",
    "text-muted",
    "text-subtle",
    "accent",
] as const;
export type ChartColors = Record<(typeof COLOR_VARS)[number], string>;

const readColors = (): ChartColors => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
        COLOR_VARS.map((name) => [name, style.getPropertyValue(`--color-${name}`).trim()]),
    ) as ChartColors;
};

// Recharts pinta por atributo SVG, então lê as variáveis do tema em runtime e refaz ao trocar o tema
export function useChartColors(): ChartColors {
    const [colors, setColors] = useState(readColors);
    useEffect(() => {
        const observer = new MutationObserver(() => setColors(readColors()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => observer.disconnect();
    }, []);
    return colors;
}

export function tooltipStyle(c: ChartColors) {
    return {
        contentStyle: {
            background: c["surface-raised"],
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            color: c.text,
        },
        labelStyle: { color: c.text, fontWeight: 600 },
        itemStyle: { color: c["text-muted"] },
        cursor: { fill: c.border, fillOpacity: 0.35 },
    };
}

// o legend do Recharts pinta o texto com a cor da série; aqui fica no cinza do tema
export const legendProps = (c: ChartColors) => ({
    formatter: (value: string) => <span style={{ color: c["text-muted"] }}>{value}</span>,
});

export function DeltaHint({
    current,
    previous,
    goodWhen,
}: {
    current: number;
    previous: number | null | undefined;
    goodWhen: "up" | "down" | "neutral";
}) {
    const delta = kpiDelta(current, previous, goodWhen);
    if (!delta) return <span className="caption">Sem período anterior</span>;
    const Icon = delta.diff > 0 ? ArrowUpRight : delta.diff < 0 ? ArrowDownRight : Minus;
    return (
        <span className={`delta delta-${delta.tone}`}>
            <Icon size={14} aria-hidden="true" />
            {delta.text} <span className="caption">vs. período anterior</span>
        </span>
    );
}

const SUBNAV = [
    { to: "/dashboard", label: "Visão geral", end: true },
    { to: "/dashboard/dispatch", label: "Despacho" },
    { to: "/dashboard/fleet", label: "Frota" },
];

export function DashHeader({
    title,
    sub,
    generatedAt,
    timezone,
    onRefresh,
    period = true,
    children,
}: {
    title: string;
    sub: string;
    generatedAt?: string;
    timezone?: string;
    onRefresh: () => void;
    period?: boolean;
    children?: ReactNode;
}) {
    const isAdmin = useSession()?.role === "ADMIN";
    return (
        <header className="dash-head">
            <div className="dash-title">
                <h1>{title}</h1>
                <p className="page-sub">{sub}</p>
            </div>
            <div className="dash-tools">
                {children}
                {period && <PeriodSelect />}
                {generatedAt && (
                    <GeneratedAt
                        generatedAt={generatedAt}
                        timezone={timezone}
                        onRefresh={onRefresh}
                    />
                )}
            </div>
            {isAdmin && (
                <nav className="dash-subnav" aria-label="Painéis">
                    {SUBNAV.map((item) => (
                        <NavLink key={item.to} to={item.to} end={item.end}>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            )}
        </header>
    );
}

// localização chega por socket: atualiza status, posição e último sinal das linhas sem refetch
export function useDriverRowsLive<T>(queryKey: unknown[], pick: (data: T) => DriverRow[][]) {
    const client = useQueryClient();
    useTopic<LocationEvent>("/topic/fleet/locations", (event) => {
        client.setQueryData<T>(queryKey, (data) => {
            if (!data) return data;
            const patch = (row: DriverRow): DriverRow =>
                row.driverId === event.driverId
                    ? {
                          ...row,
                          status: event.status,
                          lastSeenAt: event.at,
                          pingStale: false,
                          lat: event.lat ?? row.lat,
                          lng: event.lng ?? row.lng,
                      }
                    : row;
            const copy = structuredClone(data);
            for (const rows of pick(copy)) rows.forEach((r, i) => (rows[i] = patch(r)));
            return copy;
        });
    });
}
