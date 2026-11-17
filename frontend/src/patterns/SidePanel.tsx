import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import Glass from "../glass/Glass";

export function SidePanelLayout({
    open,
    panel,
    children,
}: {
    open: boolean;
    panel: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className={`side-layout${open ? " has-panel" : ""}`}>
            <div className="side-layout-main">{children}</div>
            {open && panel}
        </div>
    );
}

const modalOpen = () => document.querySelector('[aria-modal="true"]') !== null;

export function SidePanel({
    title,
    onClose,
    footer,
    className,
    children,
}: {
    title: string;
    onClose: () => void;
    footer?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    const panelId = useId();
    const titleId = useId();

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        document.getElementById(panelId)?.focus();
        return () => {
            if (previous && document.contains(previous)) previous.focus();
        };
    }, [panelId]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !modalOpen()) onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <Glass
            as="aside"
            id={panelId}
            className={`side-panel${className ? ` ${className}` : ""}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            tabIndex={-1}
        >
            <header className="side-panel-head">
                <h2 id={titleId}>{title}</h2>
                <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={onClose}
                    aria-label="Fechar"
                >
                    <X size={18} aria-hidden="true" />
                </button>
            </header>
            <div className="side-panel-body">{children}</div>
            {footer && <footer className="side-panel-foot">{footer}</footer>}
        </Glass>
    );
}
