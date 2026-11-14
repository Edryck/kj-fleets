import { useQuery } from "@tanstack/react-query";
import { Bell, CircleCheck } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { request } from "../api/http";
import type { Alerts, CustomerPanel } from "../api/types";
import { formatAgo, formatMinutes } from "../components/format";
import StatusBadge from "../components/StatusBadge";
import { alertKey, sortAlerts, sumCounts } from "../pages/alerts";

function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
    useEffect(() => {
        if (!open) return;
        const onEvent = (e: MouseEvent | KeyboardEvent) => {
            if (
                e instanceof KeyboardEvent
                    ? e.key === "Escape"
                    : !ref.current?.contains(e.target as Node)
            )
                close();
        };
        document.addEventListener("mousedown", onEvent);
        document.addEventListener("keydown", onEvent);
        return () => {
            document.removeEventListener("mousedown", onEvent);
            document.removeEventListener("keydown", onEvent);
        };
    }, [open, ref, close]);
}

// sem push de alertas: 60 s + eventos de pedido (o shell invalida "dashboard")
export default function AlertsBell() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const alerts = useQuery({
        queryKey: ["dashboard", "alerts"],
        queryFn: () => request<Alerts>("GET", "/dashboard/alerts"),
        refetchInterval: 60_000,
    });
    const refetch = alerts.refetch;

    useEffect(() => {
        if (open) void refetch();
    }, [open, refetch]);
    useDismiss(open, ref, () => setOpen(false));

    const total = sumCounts(alerts.data?.counts);
    const top = sortAlerts(alerts.data?.items ?? []).slice(0, 5);

    return (
        <div className="bell" ref={ref}>
            <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={total > 0 ? `Alertas, ${total} ativos` : "Alertas"}
                onClick={() => setOpen((o) => !o)}
            >
                <Bell size={20} aria-hidden="true" />
                {total > 0 && <span className="bell-badge">{total}</span>}
            </button>
            {open && (
                <div className="popover bell-popover">
                    {alerts.isError ? (
                        <p className="bell-empty">Não foi possível carregar os alertas.</p>
                    ) : top.length === 0 ? (
                        <p className="bell-empty">
                            <CircleCheck size={18} aria-hidden="true" />
                            {alerts.isPending ? "Carregando..." : "Nenhum alerta agora"}
                        </p>
                    ) : (
                        <ul className="bell-list">
                            {top.map((a, i) => (
                                <li key={alertKey(a, i)}>
                                    <StatusBadge kind="severity" value={a.severity} />
                                    <span className="bell-message">{a.message}</span>
                                    <span className="caption">{formatAgo(a.since)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Link className="bell-all" to="/alerts" onClick={() => setOpen(false)}>
                        Ver todos
                    </Link>
                </div>
            )}
        </div>
    );
}

// cliente: o que precisa de atenção vem do próprio painel (FAILED ou parado)
export function CustomerBell() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const panel = useQuery({
        queryKey: ["dashboard", "customer-bell"],
        queryFn: () => request<CustomerPanel>("GET", "/customer/dashboard"),
        refetchInterval: 60_000,
    });
    const refetch = panel.refetch;
    useEffect(() => {
        if (open) void refetch();
    }, [open, refetch]);
    useDismiss(open, ref, () => setOpen(false));

    const items = panel.data?.attention ?? [];

    return (
        <div className="bell" ref={ref}>
            <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={items.length > 0 ? `Avisos, ${items.length} pedidos` : "Avisos"}
                onClick={() => setOpen((o) => !o)}
            >
                <Bell size={20} aria-hidden="true" />
                {items.length > 0 && <span className="bell-badge">{items.length}</span>}
            </button>
            {open && (
                <div className="popover bell-popover">
                    {items.length === 0 ? (
                        <p className="bell-empty">
                            <CircleCheck size={18} aria-hidden="true" />
                            {panel.isPending ? "Carregando..." : "Nenhum pedido precisa de atenção"}
                        </p>
                    ) : (
                        <ul className="bell-list">
                            {items.map((a) => (
                                <li key={a.orderId}>
                                    <span className="bell-message">
                                        <Link
                                            className="data table-link"
                                            to={`/orders/${a.orderId}`}
                                            onClick={() => setOpen(false)}
                                        >
                                            {a.trackingNumber}
                                        </Link>{" "}
                                        {a.kind === "FAILED"
                                            ? `não foi entregue${a.reason ? `: ${a.reason}` : ""}`
                                            : `parado há ${formatMinutes(a.minutesInStage)}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Link className="bell-all" to="/dashboard" onClick={() => setOpen(false)}>
                        Ver painel
                    </Link>
                </div>
            )}
        </div>
    );
}
