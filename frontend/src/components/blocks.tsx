import { Inbox, WifiOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

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
