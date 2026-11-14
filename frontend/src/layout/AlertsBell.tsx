import { useQuery } from "@tanstack/react-query";
import { Bell, CircleCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../api/http";
import type { Alerts } from "../api/types";
import { formatAgo } from "../components/format";
import StatusBadge from "../components/StatusBadge";
import { alertKey, sortAlerts, sumCounts } from "../pages/alerts";

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
        if (!open) return;
        void refetch();
        const close = (e: MouseEvent | KeyboardEvent) => {
            if (
                e instanceof KeyboardEvent
                    ? e.key === "Escape"
                    : !ref.current?.contains(e.target as Node)
            )
                setOpen(false);
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open, refetch]);

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
