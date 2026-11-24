import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { DriverRow, Rate } from "../../api/types";
import { useSession } from "../../auth/session";
import { formatPercent } from "../../components/format";
import type { DeltaTone } from "../../components/kpiDelta";
import PeriodSelect, { PERIODS, type Period } from "../../components/PeriodSelect";
import Glass from "../../glass/Glass";
import type { Padding } from "../../map/camera";
import { useCountUp } from "../../motion/useCountUp";

const pp = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function ppDelta(
    current: Rate,
    previous: Rate | null | undefined,
): { diff: number; text: string; tone: DeltaTone } | null {
    if (current.rate == null || previous?.rate == null) return null;
    const diff = Math.round((current.rate - previous.rate) * 1000) / 10;
    if (diff === 0) return { diff, text: "igual", tone: "neutral" };
    return {
        diff,
        text: `${diff > 0 ? "+" : ""}${pp.format(diff)} p.p.`,
        tone: diff > 0 ? "success" : "danger",
    };
}

export function RateDelta({
    current,
    previous,
}: {
    current: Rate;
    previous: Rate | null | undefined;
}) {
    const delta = ppDelta(current, previous);
    if (!delta) return <span className="caption">Sem período anterior</span>;
    const Icon = delta.diff > 0 ? ArrowUpRight : delta.diff < 0 ? ArrowDownRight : Minus;
    return (
        <span className={`delta delta-${delta.tone}`}>
            <Icon size={14} aria-hidden="true" />
            {delta.text} <span className="caption">vs. período anterior</span>
        </span>
    );
}

export function useNow(intervalMs: number): number {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return now;
}

export function rateText(rate: Rate): string {
    return rate.rate == null ? "—" : formatPercent(rate.rate * 100);
}

export function periodLabel(period: Period): string {
    return PERIODS.find((p) => p.value === period)?.label ?? "";
}

const SUBNAV = [
    { to: "/dashboard", label: "Visão geral", end: true },
    { to: "/dashboard/dispatch", label: "Métricas de despacho" },
    { to: "/dashboard/fleet", label: "Métricas de frota" },
];

export function DashTitleActions({ period = true }: { period?: boolean }) {
    const isAdmin = useSession()?.role === "ADMIN";
    if (!period && !isAdmin) return null;
    return (
        <div className="dash-title-actions">
            {period && (
                <Glass className="dash-period">
                    <PeriodSelect />
                </Glass>
            )}
            {isAdmin && (
                <Glass as="nav" className="dash-subnav-glass" aria-label="Painéis">
                    <div className="segmented">
                        {SUBNAV.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) => (isActive ? "is-active" : "")}
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </div>
                </Glass>
            )}
        </div>
    );
}

export function StatCell({
    label,
    value,
    unit,
    decimals = 0,
    delta,
    sub,
}: {
    label: string;
    value: number | null;
    unit?: string;
    decimals?: number;
    delta?: ReactNode;
    sub?: ReactNode;
}) {
    const text = useCountUp(value, { decimals, delay: 150 });
    return (
        <div className="dash-stat">
            <div className="dash-stat-value">
                <span>{text}</span>
                {unit && value != null && <small>{unit}</small>}
            </div>
            <div className="dash-stat-label">
                <span>{label}</span>
                {delta}
            </div>
            {sub && <span className="dash-stat-sub">{sub}</span>}
        </div>
    );
}

export function dashboardPadding(): Padding {
    const width = typeof window === "undefined" ? 1440 : window.innerWidth;
    const height = typeof window === "undefined" ? 900 : window.innerHeight;
    if (width < 768) return { top: 120, bottom: 60, left: 30, right: 30 };
    if (width < 1280 || height < 820)
        return { top: 140, bottom: 80, left: Math.round(width * 0.5), right: 50 };
    return {
        top: 90,
        bottom: 300,
        left: Math.round(width * 0.42),
        right: width < 1440 ? 350 : 380,
    };
}

function located(drivers: DriverRow[]) {
    const rows = drivers.filter((d) => d.lat != null && d.lng != null);
    return {
        key: rows
            .map((d) => d.driverId)
            .sort()
            .join(","),
        points: rows.map((d) => [d.lat as number, d.lng as number] as [number, number]),
    };
}

export function useFramePoints(drivers: DriverRow[]): [number, number][] {
    const next = located(drivers);
    const [frame, setFrame] = useState(next);
    if (frame.key !== next.key) {
        setFrame(next);
        return next.points;
    }
    return frame.points;
}
