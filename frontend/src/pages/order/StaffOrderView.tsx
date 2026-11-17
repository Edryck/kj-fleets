import {
    ArrowLeft,
    Ban,
    Check,
    Copy,
    Loader2,
    Navigation,
    TriangleAlert,
    UserRoundPen,
    XCircle,
} from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Driver, OrderDetail as Order } from "../../api/types";
import { ErrorState, Skeleton } from "../../components/blocks";
import { formatAgo, formatDateTime } from "../../components/format";
import Glass from "../../glass/Glass";
import { useTitleBlock } from "../../layout/titleBlockContext";
import { setFollowState, useFollowState } from "../../map/sceneStore";
import { useMapScene } from "../../map/useMapScene";
import StopTimeline, {
    timelineFromOrder,
    timelineFromRoute,
    type TimelineStop,
} from "../../patterns/StopTimeline";
import VehicleCard from "../../patterns/VehicleCard";
import {
    TIMELINE_LABEL,
    canAssign,
    canCancel,
    canFail,
    isActive,
    nextAction,
} from "../orderActions";
import RouteBlock from "../RouteBlock";
import { BigStatus } from "./OrderPreview";
import { orderScene } from "./orderScene";
import { usePanelPadding } from "./usePanelPadding";
import { STOP_COMPLETABLE, useCopyTrackingLink, type OrderDetailState } from "./useOrderDetail";

type Tab = "cargo" | "events" | "customer";

const TABS: [Tab, string][] = [
    ["cargo", "Carga"],
    ["events", "Linha do tempo"],
    ["customer", "Cliente"],
];

function signalText(driver: Driver | null): string | null {
    if (!driver) return null;
    if (driver.lat == null || driver.lng == null) return "sem posição";
    return driver.lastSeenAt ? `sinal ${formatAgo(driver.lastSeenAt)}` : null;
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="rowline order-row">
            <span>{label}</span>
            <b>{children}</b>
        </div>
    );
}

function CargoTab({ order: o }: { order: Order }) {
    return (
        <>
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
                      ? "Exigida"
                      : "Não exigida"}
            </Row>
            {o.podValue && <p className="order-tab-note">{o.podValue}</p>}
            {o.meta &&
                Object.entries(o.meta).map(([k, v]) => (
                    <Row key={k} label={<span className="data">{k}</span>}>
                        {typeof v === "string" ? v : JSON.stringify(v)}
                    </Row>
                ))}
            {o.reason && (o.status === "CANCELLED" || o.status === "FAILED") && (
                <Row label="Motivo">{o.reason}</Row>
            )}
            {o.notes && <p className="order-tab-note">Observação: {o.notes}</p>}
        </>
    );
}

function EventsTab({ state }: { state: OrderDetailState }) {
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
                    {t.details && <p className="order-tab-note">{t.details}</p>}
                    {t.lat != null && t.lng != null && (
                        <p className="order-tab-note data">
                            {t.lat.toFixed(5)}, {t.lng.toFixed(5)}
                        </p>
                    )}
                </li>
            ))}
        </ol>
    );
}

function CustomerTab({ order: o }: { order: Order }) {
    const { copied, copy } = useCopyTrackingLink(o.trackingNumber);
    return (
        <>
            <Row label="Cliente">{o.customer?.name ?? "—"}</Row>
            <Row label="Identificador">
                <span className="data">{o.publicId}</span>
            </Row>
            <button type="button" className="btn btn-secondary btn-sm order-copy" onClick={copy}>
                {copied ? (
                    <Check size={14} aria-hidden="true" />
                ) : (
                    <Copy size={14} aria-hidden="true" />
                )}
                {copied ? "Link copiado" : "Copiar link público"}
            </button>
        </>
    );
}

function OrderTabs({ state, order }: { state: OrderDetailState; order: Order }) {
    const [tab, setTab] = useState<Tab>("cargo");
    const baseId = useId();
    const move = (event: KeyboardEvent<HTMLButtonElement>) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const index = TABS.findIndex(([value]) => value === tab);
        const [next] = TABS[(index + step + TABS.length) % TABS.length];
        setTab(next);
        document.getElementById(`${baseId}-${next}`)?.focus();
    };
    return (
        <Glass as="section" className="order-tabs" aria-label="Detalhes do pedido">
            <div
                className="segmented order-tabs-list"
                role="tablist"
                aria-label="Detalhes do pedido"
            >
                {TABS.map(([value, text]) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        id={`${baseId}-${value}`}
                        aria-selected={tab === value}
                        aria-controls={`${baseId}-panel`}
                        tabIndex={tab === value ? 0 : -1}
                        onClick={() => setTab(value)}
                        onKeyDown={move}
                    >
                        {text}
                    </button>
                ))}
            </div>
            <div
                className="order-tab-panel"
                role="tabpanel"
                id={`${baseId}-panel`}
                aria-labelledby={`${baseId}-${tab}`}
            >
                {tab === "cargo" && <CargoTab order={order} />}
                {tab === "events" && <EventsTab state={state} />}
                {tab === "customer" && <CustomerTab order={order} />}
            </div>
        </Glass>
    );
}

function Actions({ state, order: o }: { state: OrderDetailState; order: Order }) {
    const { busy, run, setDialog } = state;
    const next = nextAction(o);
    const buttons: ReactNode[] = [];
    if (next)
        buttons.push(
            <button
                key="next"
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => {
                    if (next.kind === "pod") setDialog("pod");
                    else if (next.kind === "dispatch")
                        run({ path: "dispatch", done: "Pedido despachado." });
                    else
                        run({
                            path: "activity",
                            body: { code: next.code },
                            done: `${next.label}: registrado.`,
                            reopenPod: true,
                        });
                }}
            >
                {busy && <Loader2 size={16} className="spin" aria-hidden="true" />}
                {next.label}
            </button>,
        );
    if (canAssign(o.status))
        buttons.push(
            <button
                key="assign"
                type="button"
                className="btn btn-secondary"
                onClick={() => setDialog("assign")}
            >
                <UserRoundPen size={16} aria-hidden="true" />
                {o.driver ? "Trocar motorista" : "Atribuir motorista"}
            </button>,
        );
    if (o.status === "IN_PROGRESS" && !o.podValue && next?.kind !== "pod")
        buttons.push(
            <button
                key="pod"
                type="button"
                className="btn btn-secondary"
                onClick={() => setDialog("pod")}
            >
                Registrar prova de entrega
            </button>,
        );
    if (canFail(o.status))
        buttons.push(
            <button
                key="fail"
                type="button"
                className="btn btn-secondary btn-danger-ghost"
                onClick={() => setDialog("fail")}
            >
                <XCircle size={16} aria-hidden="true" />
                Falhou
            </button>,
        );
    if (canCancel(o.status))
        buttons.push(
            <button
                key="cancel"
                type="button"
                className="btn btn-secondary btn-danger-ghost"
                onClick={() => setDialog("cancel")}
            >
                <Ban size={16} aria-hidden="true" />
                Cancelar
            </button>,
        );
    return (
        <>
            {o.status === "CREATED" && !next && (
                <p className="notice notice-warning">
                    <TriangleAlert size={14} aria-hidden="true" /> Atribua motorista e veículo para
                    poder despachar.
                </p>
            )}
            {buttons.length > 0 && <div className="order-actions">{buttons}</div>}
        </>
    );
}

export default function StaffOrderView({
    state,
    order: o,
}: {
    state: OrderDetailState;
    order: Order;
}) {
    const { id, canAct, route, driver, vehicle, busy, run } = state;
    const rootRef = useRef<HTMLDivElement>(null);
    const padding = usePanelPadding(rootRef);
    const followState = useFollowState();
    const r = route.data ?? null;
    const d = driver.data ?? null;

    const scene = useMemo(
        () => orderScene({ order: o, route: r, driver: d, following: true, padding }),
        [o, r, d, padding],
    );
    useMapScene(scene);

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
                {o.customer && <span>{o.customer.name}</span>}
                <span>Criado em {formatDateTime(o.createdAt)}</span>
                {o.dispatchedAt && <span>Despachado em {formatDateTime(o.dispatchedAt)}</span>}
                {o.finishedAt && <span>Finalizado em {formatDateTime(o.finishedAt)}</span>}
            </>
        ),
    });

    const stops = r ? timelineFromRoute(r.stops, r.mode) : timelineFromOrder(o);
    const completable = canAct && r != null && STOP_COMPLETABLE.includes(o.status);
    const stopAction = (stop: TimelineStop) =>
        completable && stop.kind === "waypoint" && stop.state !== "done" ? (
            <button
                type="button"
                className="btn btn-secondary btn-sm order-stop-done"
                aria-label={`Concluir parada ${stop.label}`}
                disabled={busy}
                onClick={() =>
                    run({
                        path: `stops/${stop.id}/complete`,
                        done: `Parada ${stop.label} concluída.`,
                    })
                }
            >
                <Check size={14} aria-hidden="true" />
                Concluir
            </button>
        ) : null;

    return (
        <div className="order-staff" ref={rootRef}>
            <div className="order-side">
                <Glass as="section" className="order-left" aria-label="Andamento do pedido">
                    <BigStatus status={o.status} />
                    <div className="order-stops">
                        <span className="micro">Paradas</span>
                        <StopTimeline stops={stops} label="Paradas" action={stopAction} />
                    </div>
                    {canAct && <Actions state={state} order={o} />}
                </Glass>
                <div className="order-right">
                    <VehicleCard
                        plate={o.vehicle?.plate ?? null}
                        type={vehicle.data?.type ?? d?.vehicle?.type}
                        status={vehicle.data?.status}
                        lastSignal={signalText(d)}
                        driver={d ? { name: d.name, status: d.status } : null}
                        driverHref={o.driver ? `/drivers/${o.driver.publicId}` : undefined}
                        loading={o.vehicle != null && vehicle.isLoading}
                    />
                    <OrderTabs state={state} order={o} />
                </div>
            </div>

            {route.isError ? (
                <Glass as="section" className="order-strip is-empty" aria-label="Rota">
                    <ErrorState
                        message="Não foi possível carregar a rota."
                        onRetry={() => route.refetch()}
                    />
                </Glass>
            ) : route.isLoading ? (
                <Glass
                    as="section"
                    className="order-strip is-empty"
                    aria-label="Rota"
                    aria-busy="true"
                >
                    <Skeleton height={56} />
                </Glass>
            ) : (
                <RouteBlock
                    orderId={id}
                    route={r}
                    waypointCount={
                        r
                            ? r.stops.filter((s) => s.type === "WAYPOINT" && !s.visitedAt).length
                            : o.waypoints.length
                    }
                    canRecalculate={canAct && isActive(o.status)}
                />
            )}

            {scene.camera?.follow && followState === "suspended" && (
                <Glass
                    as="button"
                    type="button"
                    press
                    className="follow-btn"
                    onClick={() => setFollowState("following")}
                >
                    <Navigation size={15} aria-hidden="true" />
                    Seguir veículo
                </Glass>
            )}
        </div>
    );
}
