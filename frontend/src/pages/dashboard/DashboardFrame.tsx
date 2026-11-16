import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Alert, AlertType, DriverRow } from "../../api/types";
import { formatAgo } from "../../components/format";
import StatusBadge from "../../components/StatusBadge";
import Glass from "../../glass/Glass";
import { ALERT_LABEL } from "../alertCatalog";
import { initials } from "../liveMapScene";

export function DashboardFrame({
    hero,
    right,
    dock,
}: {
    hero: ReactNode;
    right: ReactNode;
    dock: ReactNode;
}) {
    return (
        <div className="dash-aerial">
            <div className="hero-scrim" aria-hidden="true" />
            <section className="dash-hero" aria-label="Destaque">
                {hero}
            </section>
            <Glass as="aside" className="dash-right">
                {right}
            </Glass>
            <div className="dash-dock">{dock}</div>
        </div>
    );
}

export function PanelHead({ title, aside }: { title: string; aside?: ReactNode }) {
    return (
        <div className="dash-panel-head">
            <h2>{title}</h2>
            {aside}
        </div>
    );
}

export function DockPanel({
    title,
    aside,
    className,
    children,
}: {
    title: string;
    aside?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Glass as="section" className={`dash-panel${className ? ` ${className}` : ""}`}>
            <PanelHead title={title} aside={aside} />
            {children}
        </Glass>
    );
}

export function StatGrid({ children }: { children: ReactNode }) {
    return <div className="dash-stats">{children}</div>;
}

export function StackBar({
    parts,
    label,
}: {
    parts: { key: string; label: string; count: number; color: string }[];
    label: string;
}) {
    const total = parts.reduce((sum, part) => sum + part.count, 0);
    return (
        <div className="dash-stack-block">
            <div className="dash-stack" role="img" aria-label={label}>
                {total === 0 ? (
                    <i style={{ flex: 1, background: "var(--color-fill-hover)" }} />
                ) : (
                    parts
                        .filter((part) => part.count > 0)
                        .map((part) => (
                            <i
                                key={part.key}
                                style={{ flex: part.count, background: part.color }}
                            />
                        ))
                )}
            </div>
            <div className="dash-legend">
                {parts.map((part) => (
                    <span key={part.key}>
                        {part.label}
                        <b>{part.count}</b>
                    </span>
                ))}
            </div>
        </div>
    );
}

export function HBars({
    rows,
    color,
}: {
    rows: { key: string; label: string; value: number; text?: string }[];
    color: string;
}) {
    const max = Math.max(1, ...rows.map((row) => row.value));
    return (
        <div className="dash-hbars">
            {rows.map((row) => (
                <div key={row.key} className="dash-hbar">
                    <div>
                        <span>{row.label}</span>
                        <b>{row.text ?? row.value}</b>
                    </div>
                    <span className="dash-track" aria-hidden="true">
                        <i style={{ width: `${(row.value / max) * 100}%`, background: color }} />
                    </span>
                </div>
            ))}
        </div>
    );
}

export function DriverList({
    rows,
    now,
    empty,
}: {
    rows: DriverRow[];
    now: number;
    empty: string;
}) {
    if (rows.length === 0) return <p className="dash-empty">{empty}</p>;
    return (
        <ul className="dash-flist">
            {rows.map((d) => (
                <li key={d.driverId}>
                    <Link className="dash-frow" to={`/map?driver=${d.driverId}`}>
                        <span className="live-dot" data-status={d.status} aria-hidden="true">
                            {initials(d.name)}
                        </span>
                        <span className="live-who">
                            <b>{d.name}</b>
                            <small>
                                <span className="data">{d.vehiclePlate ?? "Sem veículo"}</span>
                                {" · "}
                                {d.lat == null ? "Sem posição" : formatAgo(d.lastSeenAt, now)}
                            </small>
                        </span>
                        {d.pingStale ? (
                            <span className="badge badge-warning">Sem sinal</span>
                        ) : (
                            <StatusBadge kind="driver" value={d.status} />
                        )}
                    </Link>
                </li>
            ))}
        </ul>
    );
}

export function AlertChips({ counts }: { counts: Partial<Record<AlertType, number>> }) {
    const entries = Object.entries(counts).filter(([, n]) => (n ?? 0) > 0) as [AlertType, number][];
    return (
        <div className="dash-alerts">
            <span className="micro">Alertas</span>
            {entries.length === 0 ? (
                <p className="dash-empty">Nenhum alerta agora.</p>
            ) : (
                <ul className="dash-chips">
                    {entries.map(([type, n]) => (
                        <li key={type}>
                            <Link className="chip-flat" to={`/alerts?type=${type}`}>
                                {ALERT_LABEL[type] ?? type}
                                <span className="dash-chip-n">{n}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function alertCountsOf(alerts: Alert[]): Partial<Record<AlertType, number>> {
    const counts: Partial<Record<AlertType, number>> = {};
    for (const alert of alerts) counts[alert.type] = (counts[alert.type] ?? 0) + 1;
    return counts;
}
