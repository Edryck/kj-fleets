import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface OverlayProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}

function Overlay({
    title,
    onClose,
    children,
    footer,
    variant,
}: OverlayProps & { variant: "modal" | "drawer" }) {
    const titleId = useId();
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        panel.current?.focus();
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            previous?.focus();
        };
    }, [onClose]);

    return (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div
                ref={panel}
                className={`panel panel-${variant}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <header className="panel-head">
                    <h2 id={titleId}>{title}</h2>
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={onClose}
                        aria-label="Fechar"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </header>
                <div className="panel-body">{children}</div>
                {footer && <footer className="panel-foot">{footer}</footer>}
            </div>
        </div>
    );
}

export const Modal = (props: OverlayProps) => <Overlay {...props} variant="modal" />;
export const Drawer = (props: OverlayProps) => <Overlay {...props} variant="drawer" />;

export function ConfirmDialog({
    title,
    description,
    confirmLabel,
    destructive,
    askReason,
    reasonRequired,
    busy,
    onConfirm,
    onClose,
}: {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    askReason?: boolean;
    reasonRequired?: boolean;
    busy?: boolean;
    onConfirm: (reason?: string) => void;
    onClose: () => void;
}) {
    const [reason, setReason] = useState("");
    const reasonId = useId();
    return (
        <Modal
            title={title}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Voltar
                    </button>
                    <button
                        type="button"
                        className={`btn ${destructive ? "btn-danger" : "btn-primary"}`}
                        disabled={busy || (askReason && reasonRequired && !reason.trim())}
                        onClick={() =>
                            onConfirm(askReason ? reason.trim() || undefined : undefined)
                        }
                    >
                        {busy && <Loader2 size={16} className="spin" aria-hidden="true" />}
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <p>{description}</p>
            {askReason && (
                <div className="field">
                    <label htmlFor={reasonId}>Motivo</label>
                    <textarea
                        id={reasonId}
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>
            )}
        </Modal>
    );
}
