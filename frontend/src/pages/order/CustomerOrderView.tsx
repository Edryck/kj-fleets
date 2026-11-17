import { ArrowLeft, Ban, Check, Copy } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { OrderDetail as Order } from "../../api/types";
import { ErrorState, Skeleton } from "../../components/blocks";
import { formatDateTime } from "../../components/format";
import JourneyRail from "../../components/JourneyRail";
import Glass from "../../glass/Glass";
import { useTitleBlock } from "../../layout/titleBlockContext";
import HeroNumber from "../../patterns/HeroNumber";
import StopTimeline, { timelineFromOrder } from "../../patterns/StopTimeline";
import { initials } from "../liveMapScene";
import { STATUS_HELP, TIMELINE_LABEL, showsEta } from "../orderActions";
import { BigStatus } from "./OrderPreview";
import { useCopyTrackingLink, type OrderDetailState } from "./useOrderDetail";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="rowline order-row">
            <span>{label}</span>
            <b>{children}</b>
        </div>
    );
}

function Events({ state }: { state: OrderDetailState }) {
    const { tracking } = state;
    if (tracking.isError)
        return (
            <ErrorState
                message="Não foi possível carregar o histórico."
                onRetry={() => tracking.refetch()}
            />
        );
    if (!tracking.data) return <Skeleton height={80} />;
    if (tracking.data.length === 0) return <p className="order-tab-empty">Sem eventos ainda.</p>;
    return (
        <ol className="order-events">
            {[...tracking.data].reverse().map((t, i) => (
                <li
                    key={`${t.at}-${i}`}
                    className={
                        t.status === "CANCELLED" || t.status === "FAILED" ? "is-bad" : undefined
                    }
                >
                    <div className="rowline">
                        <span>{TIMELINE_LABEL[t.code] ?? t.code}</span>
                        <b>{formatDateTime(t.at)}</b>
                    </div>
                </li>
            ))}
        </ol>
    );
}

export default function CustomerOrderView({
    state,
    order: o,
}: {
    state: OrderDetailState;
    order: Order;
}) {
    const { live, track, setDialog } = state;
    const { copied, copy } = useCopyTrackingLink(o.trackingNumber);
    const eta = live ? live.etaMinutes : (track.data?.etaMinutes ?? null);
    const etaKnown = live != null || !track.isPending;
    const places = [o.pickup, ...o.waypoints, o.dropoff];
    const pickedUp = o.status === "IN_PROGRESS";
    const stops = timelineFromOrder(o).map((stop, i) => ({
        ...stop,
        state: pickedUp && stop.kind === "pickup" ? ("done" as const) : stop.state,
        note: places[i]?.address ?? undefined,
    }));

    useTitleBlock({
        title: o.trackingNumber,
        eyebrow: (
            <Link to="/orders" className="title-back">
                <ArrowLeft size={14} aria-hidden="true" />
                Pedidos
            </Link>
        ),
        meta: (
            <>
                <span>Criado em {formatDateTime(o.createdAt)}</span>
                {o.dispatchedAt && <span>Despachado em {formatDateTime(o.dispatchedAt)}</span>}
                {o.finishedAt && <span>Finalizado em {formatDateTime(o.finishedAt)}</span>}
            </>
        ),
        actions: (
            <>
                <button type="button" className="btn btn-secondary" onClick={copy}>
                    {copied ? (
                        <Check size={16} aria-hidden="true" />
                    ) : (
                        <Copy size={16} aria-hidden="true" />
                    )}
                    {copied ? "Link copiado" : "Copiar link público"}
                </button>
                {o.status === "CREATED" && (
                    <button
                        type="button"
                        className="btn btn-secondary btn-danger-ghost"
                        onClick={() => setDialog("cancel")}
                    >
                        <Ban size={16} aria-hidden="true" />
                        Cancelar pedido
                    </button>
                )}
            </>
        ),
    });

    return (
        <div className="order-customer">
            <div className="oc-column">
                <Glass
                    as="section"
                    className="oc-hero"
                    style={rise(0)}
                    aria-label="Situação do pedido"
                    aria-live="polite"
                >
                    <div className="oc-hero-head">
                        <BigStatus status={o.status} />
                        <p className="oc-help">{STATUS_HELP[o.status]}</p>
                    </div>
                    {showsEta(o.status) && !etaKnown && <Skeleton height={128} width={240} />}
                    {showsEta(o.status) && etaKnown && (
                        <HeroNumber
                            label="Chegada estimada"
                            value={eta}
                            unit="min"
                            caption={eta == null ? "Previsão indisponível no momento" : undefined}
                        />
                    )}
                    <JourneyRail status={o.status} />
                    {live && live.stopsTotal > 0 && (
                        <div className="oc-progress">
                            <progress value={live.stopsDone} max={live.stopsTotal} />
                            <span>
                                {live.stopsDone} de {live.stopsTotal} paradas
                            </span>
                        </div>
                    )}
                    {o.driver && (
                        <div className="op-person oc-person">
                            <span className="op-avatar" aria-hidden="true">
                                {initials(o.driver.name)}
                            </span>
                            <span>
                                <small>Motorista</small>
                                <b>{o.driver.name}</b>
                            </span>
                        </div>
                    )}
                </Glass>

                <Glass as="section" className="oc-card" style={rise(1)}>
                    <h2 className="oc-title">Paradas</h2>
                    <StopTimeline stops={stops} label="Paradas" />
                </Glass>
            </div>

            <div className="oc-column">
                <Glass as="section" className="oc-card" style={rise(2)}>
                    <h2 className="oc-title">Linha do tempo</h2>
                    <Events state={state} />
                </Glass>

                <Glass as="section" className="oc-card" style={rise(3)}>
                    <h2 className="oc-title">Carga</h2>
                    <div className="order-tab-panel">
                        {o.items.length === 0 ? (
                            <p className="order-tab-empty">Nenhum item informado.</p>
                        ) : (
                            o.items.map((item, i) => (
                                <Row key={i} label={item.name}>
                                    {item.quantity}
                                </Row>
                            ))
                        )}
                        <Row label="Prova de entrega">
                            {o.podValue
                                ? `Registrada em ${formatDateTime(o.podAt)}`
                                : o.podRequired
                                  ? "Exigida, ainda não registrada"
                                  : "Não exigida"}
                        </Row>
                        {o.podValue && <p className="order-tab-note">{o.podValue}</p>}
                        {o.reason && (o.status === "CANCELLED" || o.status === "FAILED") && (
                            <Row label="Motivo">{o.reason}</Row>
                        )}
                        {o.notes && <p className="order-tab-note">Observação: {o.notes}</p>}
                    </div>
                </Glass>
            </div>
        </div>
    );
}
