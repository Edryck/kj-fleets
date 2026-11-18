import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronRight, FileCheck2, PackagePlus, TriangleAlert, UserRound } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { CustomerActive, CustomerPanel, OrdersSummary } from "../api/types";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatDateTime, formatMinutes } from "../components/format";
import GeneratedAt from "../components/GeneratedAt";
import { ConfirmDialog } from "../components/overlays";
import { usePeriod } from "../components/PeriodSelect";
import { badgeEntry } from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import HeroNumber from "../patterns/HeroNumber";
import { useTopics } from "../realtime/useTopic";
import StopProgress from "./customer/StopProgress";
import { DashTitleActions } from "./dashboard/dashParts";
import { isActive, showsEta, STATUS_HELP } from "./orderActions";

const MAX_LIVE = 20;

interface LiveEvent {
    orderId: string;
    status: CustomerActive["status"];
    etaMinutes: number | null;
    stopsDone: number;
    stopsTotal: number;
}

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

function heroCaption(active: CustomerActive[]): string {
    if (active.length === 0) return "Nada a caminho agora";
    const etas = active
        .filter((a) => showsEta(a.status) && a.etaMinutes != null)
        .map((a) => a.etaMinutes as number);
    if (etas.length === 0) return "Aguardando a saída do motorista";
    return `A próxima chega em ${formatMinutes(Math.min(...etas))}`;
}

function ActiveCard({
    order,
    index,
    onCancel,
}: {
    order: CustomerActive;
    index: number;
    onCancel: (order: CustomerActive) => void;
}) {
    const { label, tone } = badgeEntry("order", order.status);
    const eta = showsEta(order.status) ? order.etaMinutes : null;
    return (
        <Glass as="article" className="cd-card" style={rise(index + 1)}>
            <div className="cd-card-top">
                <Link className="cd-code data" to={`/orders/${order.orderId}`}>
                    {order.trackingNumber}
                </Link>
                <Link
                    className="cd-open"
                    to={`/orders/${order.orderId}`}
                    aria-label={`Ver pedido ${order.trackingNumber}`}
                >
                    <ChevronRight size={18} aria-hidden="true" />
                </Link>
            </div>
            <div className={`big-status tone-${tone}`}>
                <span className="big-status-dot" aria-hidden="true" />
                <b>{label}</b>
            </div>
            <p className="cd-help">{STATUS_HELP[order.status]}</p>
            {eta != null && (
                <div className="cd-eta">
                    <span className="cd-eta-label">Chegada em</span>
                    <span className="cd-eta-value">
                        <b>{eta}</b>
                        <small>min</small>
                    </span>
                </div>
            )}
            {order.stopsTotal > 0 && (
                <StopProgress done={order.stopsDone} total={order.stopsTotal} />
            )}
            <div className="cd-card-foot">
                <span className="cd-driver">
                    <UserRound size={16} aria-hidden="true" />
                    {order.driverName ?? "Aguardando motorista"}
                </span>
                {order.cancellable && (
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-ghost"
                        onClick={() => onCancel(order)}
                    >
                        <Ban size={14} aria-hidden="true" />
                        Cancelar pedido
                    </button>
                )}
            </div>
        </Glass>
    );
}

function SummaryPanel({ summary, index }: { summary: OrdersSummary; index: number }) {
    const rate = summary.successRate;
    return (
        <Glass
            as="section"
            className="cd-panel cd-summary"
            aria-labelledby="cd-summary-title"
            style={rise(index)}
        >
            <h2 id="cd-summary-title">Resumo do período</h2>
            <div className="cd-stats">
                <HeroNumber size="stat" label="Pedidos feitos" value={summary.created} />
                <HeroNumber size="stat" label="Entregues" value={summary.completed} />
                <HeroNumber
                    size="stat"
                    label="Não entregues"
                    value={summary.failed + summary.cancelled}
                    caption={`${summary.failed} ${summary.failed === 1 ? "falhou" : "falharam"}, ${summary.cancelled} ${summary.cancelled === 1 ? "cancelado" : "cancelados"}`}
                />
                <HeroNumber
                    size="stat"
                    label="Entregas com sucesso"
                    value={rate.rate == null ? null : rate.rate * 100}
                    decimals={1}
                    unit="%"
                    caption={
                        rate.rate == null
                            ? "Sem pedidos fechados"
                            : `${rate.n} ${rate.n === 1 ? "pedido" : "pedidos"}`
                    }
                />
                <HeroNumber
                    size="stat"
                    label="Espera até sair"
                    value={summary.avgWaitMinutes}
                    unit="min"
                    caption="Do pedido ao despacho"
                />
                <HeroNumber
                    size="stat"
                    label="Tempo de entrega"
                    value={summary.avgCycleMinutes}
                    unit="min"
                    caption="Do despacho à entrega"
                />
            </div>
        </Glass>
    );
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

    useTitleBlock({
        title: "Minhas entregas",
        meta: p ? (
            <GeneratedAt
                generatedAt={p.meta.generatedAt}
                timezone={p.meta.timezone}
                onRefresh={() => void panel.refetch()}
            />
        ) : undefined,
        actions: <DashTitleActions />,
    });

    if (panel.isError) {
        const e = panel.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => panel.refetch()} />
        );
    }

    if (!p) {
        return (
            <div className="cd" aria-busy="true">
                <Skeleton height={160} />
                <Skeleton height={300} />
            </div>
        );
    }

    const newOrder = (
        <Link className="btn btn-primary" to="/orders/new">
            <PackagePlus size={18} aria-hidden="true" />
            Novo pedido
        </Link>
    );

    const empty =
        p.active.length === 0 &&
        p.recentDelivered.length === 0 &&
        p.attention.length === 0 &&
        p.summary.created === 0;

    if (empty) {
        return (
            <div className="cd">
                <Glass as="section" className="cd-panel cd-empty">
                    <EmptyState
                        icon={PackagePlus}
                        title="Você ainda não tem pedidos"
                        description="Crie o primeiro e acompanhe a entrega por aqui."
                        action={newOrder}
                    />
                </Glass>
            </div>
        );
    }

    return (
        <div className="cd">
            <section className="cd-hero" aria-label="Destaque">
                <HeroNumber
                    label="Em andamento"
                    value={p.active.length}
                    caption={heroCaption(p.active)}
                />
                {newOrder}
            </section>

            <div className="cd-layout">
                <section className="cd-active" aria-label="Entregas em andamento">
                    {p.active.length === 0 ? (
                        <Glass className="cd-panel cd-none" style={rise(1)}>
                            <p>Nenhuma entrega a caminho. Os pedidos novos aparecem aqui.</p>
                        </Glass>
                    ) : (
                        p.active.map((a, i) => (
                            <ActiveCard
                                key={a.orderId}
                                order={a}
                                index={i}
                                onCancel={setCancelling}
                            />
                        ))
                    )}
                </section>

                <div className="cd-side">
                    {p.attention.length > 0 && (
                        <Glass
                            as="section"
                            className="cd-panel"
                            aria-labelledby="cd-attention-title"
                            style={rise(2)}
                        >
                            <h2 id="cd-attention-title">Precisa de atenção</h2>
                            <ul className="cd-list">
                                {p.attention.map((a) => (
                                    <li key={a.orderId} data-kind={a.kind}>
                                        <TriangleAlert size={16} aria-hidden="true" />
                                        <div className="cd-list-text">
                                            <Link
                                                className="cd-code data"
                                                to={`/orders/${a.orderId}`}
                                            >
                                                {a.trackingNumber}
                                            </Link>
                                            <span>
                                                {a.kind === "FAILED"
                                                    ? `Não foi entregue${a.reason ? `: ${a.reason}` : ""}`
                                                    : `Parado há ${formatMinutes(a.minutesInStage)}`}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Glass>
                    )}

                    <Glass
                        as="section"
                        className="cd-panel"
                        aria-labelledby="cd-delivered-title"
                        style={rise(3)}
                    >
                        <h2 id="cd-delivered-title">Entregues recentemente</h2>
                        {p.recentDelivered.length === 0 ? (
                            <p className="cd-muted">Nenhuma entrega concluída ainda.</p>
                        ) : (
                            <ul className="cd-list">
                                {p.recentDelivered.map((d) => (
                                    <li key={d.orderId} data-kind="DELIVERED">
                                        <FileCheck2 size={16} aria-hidden="true" />
                                        <div className="cd-list-text">
                                            <Link
                                                className="cd-code data"
                                                to={`/orders/${d.orderId}`}
                                            >
                                                {d.trackingNumber}
                                            </Link>
                                            <span>{formatDateTime(d.finishedAt)}</span>
                                        </div>
                                        {d.hasPod && (
                                            <span className="pod-chip">Com comprovante</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Glass>
                </div>
            </div>

            <SummaryPanel summary={p.summary} index={4} />

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
