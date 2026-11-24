import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowUpRight,
    Check,
    CheckCircle2,
    Clock,
    Loader2,
    Send,
    TriangleAlert,
    XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type {
    AssignmentAlgorithm,
    DispatchQueue,
    Driver,
    InProgressItem,
    OrderDetail,
    Page,
    PlanResponse,
    QueueItem,
    Vehicle,
} from "../api/types";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatKm, formatMinutes } from "../components/format";
import { ConfirmDialog } from "../components/overlays";
import { toast } from "../components/Toasts";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import type { Padding } from "../map/camera";
import { useMapScene } from "../map/useMapScene";
import MiniRoute from "../patterns/MiniRoute";
import { dispatchScene, type DispatchDriver } from "./dispatchScene";
import { comparePlans } from "./planComparison";
import { useQueueOrders } from "./useQueueOrders";

const ALGORITHMS: [AssignmentAlgorithm, string][] = [
    ["HUNGARIAN", "Melhor combinação (húngaro)"],
    ["GREEDY", "Mais rápido (guloso)"],
];

type Tab = "unassigned" | "assigned" | "inProgress";

const TABS: [Tab, string][] = [
    ["unassigned", "Sem motorista"],
    ["assigned", "Atribuídos"],
    ["inProgress", "Em andamento"],
];

type RowState = { state: "running" | "ok" | "error"; message?: string };

function scenePadding(): Padding {
    const width = typeof window === "undefined" ? 1440 : window.innerWidth;
    const height = typeof window === "undefined" ? 900 : window.innerHeight;
    if (width < 768) return { top: 330, bottom: Math.round(height * 0.36), left: 30, right: 30 };
    if (width < 1280) return { top: 150, bottom: 230, left: 460, right: 60 };
    return { top: 120, bottom: 210, left: 580, right: 90 };
}

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

export default function Dispatch() {
    const client = useQueryClient();
    const [tab, setTab] = useState<Tab>("unassigned");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [focused, setFocused] = useState<string | null>(null);
    const [algorithm, setAlgorithm] = useState<AssignmentAlgorithm>("HUNGARIAN");
    const [plan, setPlan] = useState<PlanResponse | null>(null);
    const [planError, setPlanError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [rows, setRows] = useState<Record<string, RowState>>({});
    const [dispatching, setDispatching] = useState(false);
    const [padding] = useState(scenePadding);
    const listRef = useRef<HTMLDivElement>(null);

    const queue = useQuery({
        queryKey: ["dashboard", "dispatch", "queue"],
        queryFn: () => request<DispatchQueue>("GET", "/dashboard/dispatch/queue"),
    });
    const drivers = useQuery({
        queryKey: ["drivers", "all"],
        queryFn: () => request<Page<Driver>>("GET", "/drivers", undefined, { limit: 100 }),
    });
    const vehicles = useQuery({
        queryKey: ["vehicles", "all"],
        queryFn: () => request<Page<Vehicle>>("GET", "/vehicles", undefined, { limit: 100 }),
    });
    const details = useQueueOrders(queue.data);

    const driverName = useMemo(
        () => new Map(drivers.data?.items.map((d) => [d.publicId, d.name])),
        [drivers.data],
    );
    const plate = useMemo(
        () => new Map(vehicles.data?.items.map((v) => [v.publicId, v.plate])),
        [vehicles.data],
    );
    const detailById = useMemo(
        () => new Map(details.orders.map((o) => [o.publicId, o])),
        [details.orders],
    );
    const tracking = useRef(new Map<string, string>());
    for (const o of [
        ...(queue.data?.unassigned.items ?? []),
        ...(queue.data?.assignedNotDispatched.items ?? []),
    ]) {
        tracking.current.set(o.orderId, o.trackingNumber);
    }
    const label = (orderId: string) => tracking.current.get(orderId) ?? orderId;

    const unassigned = queue.data?.unassigned.items ?? [];
    const assigned = queue.data?.assignedNotDispatched.items ?? [];
    const inProgress = queue.data?.inProgress.items ?? [];
    const staleIds = useMemo(
        () => new Map(queue.data?.stale?.items.map((s) => [s.orderId, s.minutesInStage])),
        [queue.data],
    );
    const ids = useMemo(() => [...selected], [selected]);
    const freeDrivers = drivers.data?.items.filter((d) => d.status === "AVAILABLE").length;
    const freeVehicles = vehicles.data?.items.filter((v) => v.status === "AVAILABLE").length;

    const run = useMutation({
        mutationFn: (apply: boolean) =>
            request<PlanResponse>("POST", "/dispatch/plan", {
                algorithm,
                orderIds: ids.length > 0 ? ids : undefined,
                apply,
            }),
        onSuccess: (data) => {
            setPlan(data);
            setPlanError(null);
            setRows({});
            setConfirming(false);
            if (data.applied) {
                toast.success("Plano aplicado. Falta despachar.");
                void client.invalidateQueries({ queryKey: ["dashboard"] });
                void client.invalidateQueries({ queryKey: ["orders"] });
            }
        },
        onError: (e: ApiError, apply) => {
            setConfirming(false);
            const base = messageFor(e.code, e.message);
            setPlanError(apply ? `${base} Nenhuma atribuição foi gravada.` : base);
        },
    });

    const dispatchAll = async () => {
        if (!plan) return;
        setDispatching(true);
        for (const a of plan.assignments) {
            if (rows[a.orderId]?.state === "ok") continue;
            setRows((r) => ({ ...r, [a.orderId]: { state: "running" } }));
            try {
                await request<unknown>("POST", `/orders/${a.orderId}/dispatch`, {});
                setRows((r) => ({ ...r, [a.orderId]: { state: "ok" } }));
            } catch (e) {
                const err = e as ApiError;
                setRows((r) => ({
                    ...r,
                    [a.orderId]: { state: "error", message: messageFor(err.code, err.message) },
                }));
            }
        }
        setDispatching(false);
        void client.invalidateQueries({ queryKey: ["dashboard"] });
        void client.invalidateQueries({ queryKey: ["orders"] });
    };

    const toggle = (id: string) => {
        setSelected((s) => {
            const next = new Set(s);
            if (!next.delete(id)) next.add(id);
            return next;
        });
        setPlan(null);
    };

    const selectAll = () => {
        setSelected(
            selected.size === unassigned.length
                ? new Set()
                : new Set(unassigned.map((o) => o.orderId)),
        );
        setPlan(null);
    };

    const focusOrder = (id: string) => {
        setFocused((current) => (current === id ? null : id));
        const card = listRef.current?.querySelector<HTMLElement>(`[data-order="${id}"]`);
        card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    const sceneOrders = useMemo(() => {
        const visible = new Set(
            (tab === "unassigned" ? unassigned : tab === "assigned" ? assigned : []).map(
                (o) => o.orderId,
            ),
        );
        plan?.assignments.forEach((a) => visible.add(a.orderId));
        return details.orders.filter((o) => visible.has(o.publicId));
    }, [tab, unassigned, assigned, plan, details.orders]);

    const sceneDrivers = useMemo<DispatchDriver[]>(
        () =>
            (drivers.data?.items ?? []).map((d) => ({
                id: d.publicId,
                name: d.name,
                status: d.status,
                lat: d.lat,
                lng: d.lng,
            })),
        [drivers.data],
    );

    const scene = useMemo(
        () =>
            dispatchScene({
                orders: sceneOrders,
                staleIds,
                drivers: sceneDrivers,
                selectedOrderId: focused,
                plan,
                selection: selected,
                padding,
            }),
        [sceneOrders, staleIds, sceneDrivers, focused, plan, selected, padding],
    );

    useMapScene(
        queue.isSuccess
            ? {
                  ...scene,
                  onMarkerClick: (id) => {
                      if (detailById.has(id)) focusOrder(id);
                  },
              }
            : null,
    );

    useTitleBlock({
        title: "Central de despacho",
        meta: queue.data ? (
            <>
                <span>{queue.data.unassigned.total} sem motorista</span>
                <span>{queue.data.assignedNotDispatched.total} atribuídos</span>
                <span>{queue.data.inProgress.total} em andamento</span>
            </>
        ) : undefined,
    });

    const comparison = plan ? comparePlans(plan.comparison) : null;
    const maxKm = plan ? Math.max(...Object.values(plan.comparison), 0) : 0;
    const dispatched = plan
        ? plan.assignments.filter((a) => rows[a.orderId]?.state === "ok").length
        : 0;
    const pending = plan ? plan.assignments.length - dispatched : 0;
    const noDriver = plan && plan.assignments.length === 0 && plan.unassigned.length > 0;
    const canApply = Boolean(plan && !plan.applied && plan.assignments.length > 0);
    const canDispatch = Boolean(plan?.applied && plan.assignments.length > 0 && pending > 0);

    if (queue.isError) {
        const e = queue.error as ApiError;
        return (
            <div className="dispatch">
                <Glass className="disp-floating">
                    <ErrorState
                        message={messageFor(e.code, e.message)}
                        onRetry={() => queue.refetch()}
                    />
                </Glass>
            </div>
        );
    }

    const totals: Record<Tab, number | undefined> = {
        unassigned: queue.data?.unassigned.total,
        assigned: queue.data?.assignedNotDispatched.total,
        inProgress: queue.data?.inProgress.total,
    };

    return (
        <div className="dispatch">
            <div className="disp-dots" aria-hidden="true" />

            <div className="disp-command-wrap">
                <Glass className="disp-command" role="toolbar" aria-label="Plano de despacho">
                    <span className="micro">Algoritmo</span>
                    <div className="segmented" role="group" aria-label="Algoritmo de atribuição">
                        {ALGORITHMS.map(([value, text]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={algorithm === value}
                                onClick={() => {
                                    setAlgorithm(value);
                                    setPlan(null);
                                }}
                            >
                                {text}
                            </button>
                        ))}
                    </div>
                    <span className="disp-free">
                        <span>
                            <b>{freeDrivers ?? "—"}</b> motoristas livres
                        </span>
                        <span>
                            <b>{freeVehicles ?? "—"}</b> veículos livres
                        </span>
                    </span>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={run.isPending || unassigned.length === 0}
                        onClick={() => run.mutate(false)}
                    >
                        {run.isPending && !confirming && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        Calcular plano
                    </button>
                </Glass>
            </div>

            <Glass as="section" className="disp-queue" aria-label="Fila de pedidos">
                <div className="segmented disp-tabs" role="tablist" aria-label="Etapas da fila">
                    {TABS.map(([value, text]) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            id={`disp-tab-${value}`}
                            aria-selected={tab === value}
                            aria-controls="disp-panel"
                            onClick={() => setTab(value)}
                        >
                            {text}
                            <span className="disp-tab-num">{totals[value] ?? "—"}</span>
                        </button>
                    ))}
                </div>

                <div
                    className="disp-list"
                    id="disp-panel"
                    role="tabpanel"
                    aria-labelledby={`disp-tab-${tab}`}
                    ref={listRef}
                >
                    {!queue.data ? (
                        <>
                            <Skeleton height={96} />
                            <Skeleton height={96} />
                            <Skeleton height={96} />
                        </>
                    ) : tab === "unassigned" ? (
                        unassigned.length === 0 ? (
                            <EmptyState
                                title="Nada para despachar"
                                description="Todos os pedidos já têm motorista."
                                action={
                                    <Link className="btn btn-secondary" to="/orders/new">
                                        Novo pedido
                                    </Link>
                                }
                            />
                        ) : (
                            <>
                                <div className="disp-list-head">
                                    <span className="caption">
                                        {selected.size > 0
                                            ? `${selected.size} de ${unassigned.length} selecionados`
                                            : "Sem seleção, o plano considera todos"}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={selectAll}
                                    >
                                        {selected.size === unassigned.length
                                            ? "Limpar seleção"
                                            : "Selecionar todos"}
                                    </button>
                                </div>
                                {unassigned.map((o) => (
                                    <OrderCard
                                        key={o.orderId}
                                        item={o}
                                        detail={detailById.get(o.orderId)}
                                        stale={staleIds.has(o.orderId)}
                                        focused={focused === o.orderId}
                                        onFocus={() => focusOrder(o.orderId)}
                                        checked={selected.has(o.orderId)}
                                        onCheck={() => toggle(o.orderId)}
                                    />
                                ))}
                                <More
                                    shown={unassigned.length}
                                    total={queue.data.unassigned.total}
                                />
                            </>
                        )
                    ) : tab === "assigned" ? (
                        assigned.length === 0 ? (
                            <p className="disp-none">Nenhum pedido atribuído esperando despacho.</p>
                        ) : (
                            <>
                                {assigned.map((o) => (
                                    <OrderCard
                                        key={o.orderId}
                                        item={o}
                                        detail={detailById.get(o.orderId)}
                                        stale={staleIds.has(o.orderId)}
                                        focused={focused === o.orderId}
                                        onFocus={() => focusOrder(o.orderId)}
                                    />
                                ))}
                                <More
                                    shown={assigned.length}
                                    total={queue.data.assignedNotDispatched.total}
                                />
                            </>
                        )
                    ) : inProgress.length === 0 ? (
                        <p className="disp-none">Nenhum pedido em andamento.</p>
                    ) : (
                        <>
                            {inProgress.map((o) => (
                                <ProgressCard key={o.orderId} item={o} />
                            ))}
                            <More shown={inProgress.length} total={queue.data.inProgress.total} />
                        </>
                    )}
                </div>
            </Glass>

            <Glass as="section" className="disp-tray" aria-label="Plano">
                <div className="disp-sel">
                    <span className="micro">Seleção</span>
                    <span className="disp-sel-num">
                        {selected.size > 0 ? selected.size : (queue.data?.unassigned.total ?? 0)}
                        <small>{selected.size > 0 ? "pedidos" : "pedidos · todos"}</small>
                    </span>
                </div>

                <div className="disp-plan" aria-live="polite">
                    {planError && (
                        <p className="notice notice-danger" role="alert">
                            {planError}
                        </p>
                    )}
                    {!plan && !planError && (
                        <p className="disp-hint">
                            Calcular não grava nada: mostra quem leva cada pedido e compara os
                            algoritmos. Só “Aplicar plano” grava as atribuições.
                        </p>
                    )}
                    {plan && (
                        <>
                            <div className="disp-plan-head">
                                <span
                                    className={`badge ${plan.applied ? "badge-success" : "badge-info"}`}
                                >
                                    {plan.applied ? (
                                        <CheckCircle2 size={14} aria-hidden="true" />
                                    ) : (
                                        <TriangleAlert size={14} aria-hidden="true" />
                                    )}
                                    {plan.applied ? "Aplicado" : "Simulado, nada foi gravado"}
                                </span>
                                <span className="disp-total">Total {formatKm(plan.totalKm)}</span>
                                {!noDriver && comparison?.summary && (
                                    <span className="caption">{comparison.summary}</span>
                                )}
                            </div>
                            {noDriver ? (
                                <p className="notice notice-warning">
                                    Nenhum motorista elegível: é preciso estar Disponível, com
                                    posição recente e um veículo livre.{" "}
                                    <Link to="/map">Ver mapa ao vivo</Link>
                                </p>
                            ) : (
                                <>
                                    <div className="disp-compare">
                                        {ALGORITHMS.map(([value, text]) => {
                                            const km = plan.comparison[value];
                                            if (km == null) return null;
                                            return (
                                                <div key={value} className="disp-compare-row">
                                                    <span>{text}</span>
                                                    <span className="disp-track" aria-hidden="true">
                                                        <i
                                                            className={
                                                                value === "GREEDY" ? "is-alt" : ""
                                                            }
                                                            style={{
                                                                width: `${maxKm > 0 ? (km / maxKm) * 100 : 0}%`,
                                                            }}
                                                        />
                                                    </span>
                                                    <b>{formatKm(km)}</b>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <ul className="disp-assign">
                                        {plan.assignments.map((a) => (
                                            <li key={a.orderId}>
                                                <code>{label(a.orderId)}</code>→{" "}
                                                {firstName(
                                                    driverName.get(a.driverId) ?? a.driverId,
                                                )}{" "}
                                                ·{" "}
                                                <code>{plate.get(a.vehicleId) ?? a.vehicleId}</code>{" "}
                                                · {formatKm(a.km)}
                                                {plan.applied && (
                                                    <DispatchCell row={rows[a.orderId]} />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                    {plan.unassigned.length > 0 && (
                                        <p className="notice notice-warning">
                                            <TriangleAlert size={14} aria-hidden="true" /> Sem par:{" "}
                                            <span className="data">
                                                {plan.unassigned.map(label).join(", ")}
                                            </span>
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="disp-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!canApply}
                        onClick={() => setConfirming(true)}
                    >
                        {plan?.applied ? "Plano aplicado" : "Aplicar plano"}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!canDispatch || dispatching}
                        onClick={() => void dispatchAll()}
                    >
                        {dispatching ? (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        ) : (
                            <Send size={16} aria-hidden="true" />
                        )}
                        {dispatched > 0 ? "Despachar pendentes" : "Despachar todos"}
                    </button>
                    {plan?.applied && dispatched > 0 && (
                        <span className="caption">
                            {dispatched} de {plan.assignments.length} despachados
                        </span>
                    )}
                </div>
            </Glass>

            {confirming && (
                <ConfirmDialog
                    title="Aplicar plano"
                    description={`As ${plan?.assignments.length ?? 0} atribuições serão gravadas de uma vez (ou nenhuma, se alguma falhar). Isso só atribui: os pedidos continuam sem despacho até você usar "Despachar todos".`}
                    confirmLabel="Aplicar plano"
                    busy={run.isPending}
                    onClose={() => setConfirming(false)}
                    onConfirm={() => run.mutate(true)}
                />
            )}
        </div>
    );
}

function OrderCard({
    item,
    detail,
    stale,
    focused,
    onFocus,
    checked,
    onCheck,
}: {
    item: QueueItem;
    detail: OrderDetail | undefined;
    stale: boolean;
    focused: boolean;
    onFocus: () => void;
    checked?: boolean;
    onCheck?: () => void;
}) {
    const selectable = onCheck !== undefined;
    return (
        <article
            className={`ocard${checked ? " is-checked" : ""}${focused ? " is-focused" : ""}`}
            data-order={item.orderId}
        >
            {selectable && (
                <label className="ocard-check">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={onCheck}
                        aria-label={`Selecionar ${item.trackingNumber}`}
                    />
                    <span className="ocard-box" aria-hidden="true">
                        {checked && <Check size={14} strokeWidth={3} />}
                    </span>
                </label>
            )}
            <button
                type="button"
                className="ocard-body"
                aria-pressed={focused}
                aria-label={`Ver ${item.trackingNumber} no mapa`}
                onClick={onFocus}
            >
                <span className="ocard-head">
                    <span className="ocard-code">{item.trackingNumber}</span>
                    <span className={`ocard-age${stale ? " is-stale" : ""}`}>
                        {stale ? (
                            <TriangleAlert size={13} aria-hidden="true" />
                        ) : (
                            <Clock size={13} aria-hidden="true" />
                        )}
                        {stale
                            ? `Parado · ${item.minutesInStage} min`
                            : `${item.minutesInStage} min`}
                    </span>
                </span>
                <MiniRoute
                    pickup={item.pickupName}
                    dropoff={item.dropoffName}
                    waypoints={detail?.waypoints.length ?? 0}
                />
            </button>
            <Link
                className="ocard-open"
                to={`/orders/${item.orderId}`}
                aria-label={`Abrir pedido ${item.trackingNumber}`}
            >
                <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
        </article>
    );
}

function ProgressCard({ item }: { item: InProgressItem }) {
    return (
        <article className="ocard is-progress">
            <div className="ocard-body">
                <span className="ocard-head">
                    <Link className="ocard-driver" to={`/orders/${item.orderId}`}>
                        {item.driverName ?? "Sem motorista"}
                    </Link>
                    {item.etaMinutes != null && (
                        <span className="ocard-age">
                            <Clock size={13} aria-hidden="true" />
                            ETA {formatMinutes(item.etaMinutes)}
                        </span>
                    )}
                </span>
                <span className="ocard-steps">
                    <span className="ocard-bar" aria-hidden="true">
                        <i
                            style={{
                                width: `${item.stopsTotal > 0 ? (item.stopsDone / item.stopsTotal) * 100 : 0}%`,
                            }}
                        />
                    </span>
                    <span className="caption">
                        {item.stopsDone}/{item.stopsTotal} paradas
                    </span>
                </span>
            </div>
        </article>
    );
}

function More({ shown, total }: { shown: number; total: number }) {
    if (total <= shown) return null;
    return (
        <p className="disp-none">
            Mostrando {shown} de {total}.
        </p>
    );
}

function DispatchCell({ row }: { row: RowState | undefined }) {
    if (!row) return <span className="disp-row-state">Pendente</span>;
    if (row.state === "running")
        return (
            <span className="disp-row-state">
                <Loader2 size={13} className="spin" aria-hidden="true" /> Despachando
            </span>
        );
    if (row.state === "ok")
        return (
            <span className="disp-row-state is-ok">
                <CheckCircle2 size={13} aria-hidden="true" />
                Despachado
            </span>
        );
    return (
        <span className="disp-row-state is-error" title={row.message}>
            <XCircle size={13} aria-hidden="true" />
            {row.message}
        </span>
    );
}
