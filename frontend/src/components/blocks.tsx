import { Inbox, WifiOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Skeleton({
    height = 16,
    width = "100%",
}: {
    height?: number;
    width?: number | string;
}) {
    return <span className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

export function EmptyState({
    title,
    description,
    action,
    icon: Icon = Inbox,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    icon?: LucideIcon;
}) {
    return (
        <div className="state state-ambient">
            <Icon size={28} aria-hidden="true" />
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {action}
        </div>
    );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div className="state state-ambient state-error" role="alert">
            <WifiOff size={28} aria-hidden="true" />
            <h3>Não foi possível carregar</h3>
            <p>{message}</p>
            {onRetry && (
                <button type="button" className="btn btn-primary" onClick={onRetry}>
                    Tentar de novo
                </button>
            )}
        </div>
    );
}

export function KpiCard({
    label,
    value,
    icon: Icon,
    hint,
    to,
}: {
    label: string;
    value: ReactNode;
    icon?: LucideIcon;
    hint?: ReactNode;
    to?: string;
}) {
    const body = (
        <>
            <div className="kpi-head">
                <span className="kpi-label">{label}</span>
                {Icon && <Icon size={18} aria-hidden="true" />}
            </div>
            <div className="kpi-value">{value}</div>
            {hint && <div className="kpi-hint">{hint}</div>}
        </>
    );
    return to ? (
        <Link className="card kpi kpi-link" to={to}>
            {body}
        </Link>
    ) : (
        <div className="card kpi">{body}</div>
    );
}
