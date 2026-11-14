import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, PackagePlus, Timer, TriangleAlert, UserRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { CustomerActive, CustomerPanel } from "../api/types";
import { EmptyState, ErrorState, KpiCard, Skeleton } from "../components/blocks";
import { formatDateTime, formatMinutes } from "../components/format";
import JourneyRail from "../components/JourneyRail";
import { ConfirmDialog } from "../components/overlays";
import { usePeriod } from "../components/PeriodSelect";
import RateValue from "../components/RateValue";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import { useTopics } from "../realtime/useTopic";
import { isActive, showsEta, STATUS_HELP } from "./orderActions";
import { DashHeader } from "./dashboardParts";

// limite razoável de assinaturas por tela
const MAX_LIVE = 20;

interface LiveEvent {
    orderId: string;
    status: CustomerActive["status"];
    etaMinutes: number | null;
    stopsDone: number;
    stopsTotal: number;
}

export default function CustomerDashboard() {
    const [period] = usePeriod();
    const client = useQueryClient();
    const key = ["dashboard", "customer", period];
    const [cancelling, setCancelling] = useState<CustomerActive | null>(null);
    const panel = useQuery({
        queryKey: key,
        queryFn: () => request<CustomerPanel>("GET", "/customer/dashboard", undefined, { period }),
    });
    const p = panel.data;

    // sem posição do motorista: o evento só traz status, previsão e paradas
    const liveIds = (p?.active ?? []).slice(0, MAX_LIVE).map((a) => `/topic/orders/${a.orderId}`);
    useTopics<LiveEvent>(liveIds, (e) => {
        if (!isActive(e.status)) {
            void client.invalidateQueries({ queryKey: ["dashboard"] });
            void client.invalidateQueries({ queryKey: ["orders"] });
            return;
        }
        client.setQueryData<CustomerPanel>(key, (data) =>
            data
                ? {
                      ...data,
                      active: data.active.map((a) =>
                          a.orderId === e.orderId
                              ? {
                                    ...a,
                                    status: e.status,
                                    etaMinutes: e.etaMinutes,
                                    stopsDone: e.stopsDone,
                                    stopsTotal: e.stopsTotal,
                                    cancellable: e.status === "CREATED",
                                }
                              : a,
                      ),
                  }
                : data,
        );
    });

    const cancel = useMutation({
        mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
            request<unknown>("POST", `/orders/${orderId}/cancel`, { reason }),
        onSuccess: () => {
            toast.success("Pedido cancelado.");
            setCancelling(null);
            void client.invalidateQueries({ queryKey: ["dashboard"] });
            void client.invalidateQueries({ queryKey: ["orders"] });
        },
        onError: (e: ApiError) => {
            toast.error(messageFor(e.code, e.message));
            setCancelling(null);
            void client.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });

    if (panel.isError) {
        const e = panel.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => panel.refetch()} />
        );
    }

    const empty =
        p &&
        p.active.length === 0 &&
        p.recentDelivered.length === 0 &&
        p.attention.length === 0 &&
        p.summary.created === 0;

    return (
        <div className="stack dash">
            <DashHeader
                title="Seus pedidos"
                sub="O que está a caminho, o que precisa de atenção e o que já chegou."
                generatedAt={p?.meta.generatedAt}
                timezone={p?.meta.timezone}
                onRefresh={() => void panel.refetch()}
            >
                <Link className="btn btn-primary" to="/orders/new">
                    <PackagePlus size={18} aria-hidden="true" />
                    Novo pedido
                </Link>
            </DashHeader>

            {!p && <Skeleton height={220} />}

            {empty && (
                <EmptyState
                    title="Você ainda não tem pedidos"
                    description="Crie o primeiro e acompanhe a entrega por aqui."
                    action={
                        <Link className="btn btn-primary" to="/orders/new">
                            Novo pedido
                        </Link>
                    }
                />
            )}

            {p && p.attention.length > 0 && (
                <section className="stack-sm" aria-label="Precisam de atenção">
                    {p.attention.map((a) => (
                        <Link
                            key={a.orderId}
                            to={`/orders/${a.orderId}`}
                            className={`attention ${a.kind === "FAILED" ? "attention-bad" : ""}`}
                        >
                            <TriangleAlert size={18} aria-hidden="true" />
                            <span>
                                <strong className="data">{a.trackingNumber}</strong>
                                {a.kind === "FAILED"
                                    ? ` não foi entregue${a.reason ? `: ${a.reason}` : "."}`
                                    : ` está parado há ${formatMinutes(a.minutesInStage)}.`}
                            </span>
                        </Link>
                    ))}
                </section>
            )}

            {p && p.active.length > 0 && (
                <section className="stack-sm">
                    <h2>Em andamento</h2>
                    <div className="active-grid">
                        {p.active.map((a) => (
                            <article key={a.orderId} className="card active-card">
                                <div className="track-head">
                                    <Link className="data table-link" to={`/orders/${a.orderId}`}>
                                        {a.trackingNumber}
                                    </Link>
                                    <StatusBadge kind="order" value={a.status} />
                                </div>
                                <p className="status-help">{STATUS_HELP[a.status]}</p>
                                <JourneyRail status={a.status} />
                                <div className="status-facts">
                                    {showsEta(a.status) && (
                                        <span className="status-fact">
                                            <Timer size={18} aria-hidden="true" />
                                            <span>
                                                Chegada em{" "}
                                                <strong>{formatMinutes(a.etaMinutes)}</strong>
                                            </span>
                                        </span>
                                    )}
                                    {a.driverName && (
                                        <span className="status-fact">
                                            <UserRound size={18} aria-hidden="true" />
                                            <span>{a.driverName}</span>
                                        </span>
                                    )}
                                    {a.stopsTotal > 0 && (
                                        <span className="status-fact progress">
                                            <progress value={a.stopsDone} max={a.stopsTotal} />
                                            <span>
                                                {a.stopsDone} de {a.stopsTotal} paradas
                                            </span>
                                        </span>
                                    )}
                                </div>
                                <div className="active-actions">
                                    <Link
                                        className="btn btn-secondary btn-sm"
                                        to={`/orders/${a.orderId}`}
                                    >
                                        Ver pedido
                                    </Link>
                                    {a.cancellable && (
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm btn-danger-ghost"
                                            onClick={() => setCancelling(a)}
                                        >
                                            <Ban size={14} aria-hidden="true" />
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {p && !empty && (
                <>
                    <section className="stack-sm">
                        <h2>Resumo do período</h2>
                        <div className="kpi-row">
                            <KpiCard label="Pedidos feitos" value={p.summary.created} />
                            <KpiCard
                                label="Entregues"
                                value={p.summary.completed}
                                icon={CheckCircle2}
                            />
                            <KpiCard
                                label="Não entregues"
                                value={p.summary.failed + p.summary.cancelled}
                                hint={`${p.summary.failed} falharam, ${p.summary.cancelled} cancelados`}
                            />
                            <KpiCard
                                label="Entregas com sucesso"
                                value={<RateValue value={p.summary.successRate} />}
                            />
                            <KpiCard
                                label="Espera até sair"
                                value={formatMinutes(p.summary.avgWaitMinutes)}
                                hint="Do pedido até o despacho"
                            />
                            <KpiCard
                                label="Tempo de entrega"
                                value={formatMinutes(p.summary.avgCycleMinutes)}
                                hint="Do despacho até a entrega"
                            />
                        </div>
                    </section>

                    <section className="card">
                        <h2>Últimas entregas</h2>
                        {p.recentDelivered.length === 0 ? (
                            <p className="field-help">Nenhuma entrega concluída ainda.</p>
                        ) : (
                            <ul className="delivered-list">
                                {p.recentDelivered.map((d) => (
                                    <li key={d.orderId}>
                                        <Link
                                            className="data table-link"
                                            to={`/orders/${d.orderId}`}
                                        >
                                            {d.trackingNumber}
                                        </Link>
                                        <span className="caption">
                                            {formatDateTime(d.finishedAt)}
                                            {d.hasPod && " · com comprovante"}
                                        </span>
                                        <Link
                                            className="btn btn-ghost btn-sm"
                                            to={`/orders/${d.orderId}`}
                                        >
                                            Ver
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}

            {cancelling && (
                <ConfirmDialog
                    title="Cancelar pedido"
                    description={`O pedido ${cancelling.trackingNumber} será cancelado. Isso não pode ser desfeito.`}
                    confirmLabel="Cancelar pedido"
                    destructive
                    askReason
                    reasonRequired
                    busy={cancel.isPending}
                    onClose={() => setCancelling(null)}
                    onConfirm={(reason) => cancel.mutate({ orderId: cancelling.orderId, reason })}
                />
            )}
        </div>
    );
}
