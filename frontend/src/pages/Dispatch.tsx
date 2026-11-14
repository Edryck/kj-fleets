import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send, TriangleAlert, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type {
    AssignmentAlgorithm,
    DispatchQueue,
    Driver,
    Page,
    PlanResponse,
    Vehicle,
} from "../api/types";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatKm } from "../components/format";
import { ConfirmDialog } from "../components/overlays";
import { toast } from "../components/Toasts";
import { comparePlans } from "./planComparison";

const ALGORITHMS: [AssignmentAlgorithm, string][] = [
    ["HUNGARIAN", "Húngaro"],
    ["GREEDY", "Guloso"],
];

type RowState = { state: "running" | "ok" | "error"; message?: string };

export default function Dispatch() {
    const client = useQueryClient();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [algorithm, setAlgorithm] = useState<AssignmentAlgorithm>("HUNGARIAN");
    const [plan, setPlan] = useState<PlanResponse | null>(null);
    const [planError, setPlanError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [rows, setRows] = useState<Record<string, RowState>>({});
    const [dispatching, setDispatching] = useState(false);

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

    const driverName = useMemo(
        () => new Map(drivers.data?.items.map((d) => [d.publicId, d.name])),
        [drivers.data],
    );
    const plate = useMemo(
        () => new Map(vehicles.data?.items.map((v) => [v.publicId, v.plate])),
        [vehicles.data],
    );
    // guarda os códigos já vistos: depois de aplicar/despachar o pedido sai da fila
    const tracking = useRef(new Map<string, string>());
    for (const o of [
        ...(queue.data?.unassigned.items ?? []),
        ...(queue.data?.assignedNotDispatched.items ?? []),
    ]) {
        tracking.current.set(o.orderId, o.trackingNumber);
    }
    const label = (orderId: string) => tracking.current.get(orderId) ?? orderId;

    const unassigned = queue.data?.unassigned.items ?? [];
    const ids = useMemo(() => [...selected], [selected]);

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

    const comparison = plan ? comparePlans(plan.comparison) : null;
    const maxKm = plan ? Math.max(...Object.values(plan.comparison), 0) : 0;
    const dispatched = plan
        ? plan.assignments.filter((a) => rows[a.orderId]?.state === "ok").length
        : 0;
    const pending = plan ? plan.assignments.length - dispatched : 0;
    const noDriver = plan && plan.assignments.length === 0 && plan.unassigned.length > 0;

    if (queue.isError) {
        const e = queue.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => queue.refetch()} />
        );
    }

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Despacho em lote</h1>
                    <p className="page-sub">
                        Simular não altera nenhum pedido. Só “Aplicar plano” grava as atribuições.
                    </p>
                </div>
            </header>

            <div className="dispatch-grid">
                <section className="card">
                    <div className="card-head">
                        <h2>Sem motorista</h2>
                        <span className="caption">
                            {queue.data ? queue.data.unassigned.total : "—"} na fila
                        </span>
                    </div>
                    {!queue.data ? (
                        <Skeleton height={160} />
                    ) : unassigned.length === 0 ? (
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
                            <div className="table-scroll">
                                <table className="table table-compact">
                                    <thead>
                                        <tr>
                                            <th scope="col">
                                                <input
                                                    type="checkbox"
                                                    className="check"
                                                    aria-label="Selecionar todos"
                                                    checked={selected.size === unassigned.length}
                                                    onChange={(e) => {
                                                        setSelected(
                                                            e.target.checked
                                                                ? new Set(
                                                                      unassigned.map(
                                                                          (o) => o.orderId,
                                                                      ),
                                                                  )
                                                                : new Set(),
                                                        );
                                                        setPlan(null);
                                                    }}
                                                />
                                            </th>
                                            <th scope="col">Pedido</th>
                                            <th scope="col">Trajeto</th>
                                            <th scope="col" className="num">
                                                Esperando
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unassigned.map((o) => (
                                            <tr key={o.orderId}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        className="check"
                                                        aria-label={`Selecionar ${o.trackingNumber}`}
                                                        checked={selected.has(o.orderId)}
                                                        onChange={() => toggle(o.orderId)}
                                                    />
                                                </td>
                                                <td>
                                                    <Link
                                                        className="table-link data"
                                                        to={`/orders/${o.orderId}`}
                                                    >
                                                        {o.trackingNumber}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <div className="route-cell">
                                                        <span>{o.pickupName}</span>
                                                        <span className="caption">
                                                            para {o.dropoffName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="num">{o.minutesInStage} min</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {queue.data.unassigned.total > unassigned.length && (
                                <p className="field-help">
                                    Mostrando {unassigned.length} de {queue.data.unassigned.total}.
                                </p>
                            )}
                        </>
                    )}
                </section>

                <section className="card planner">
                    <h2>Plano</h2>
                    <div className="planner-controls">
                        <div
                            className="segmented"
                            role="group"
                            aria-label="Algoritmo de atribuição"
                        >
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
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={run.isPending || unassigned.length === 0}
                            onClick={() => run.mutate(false)}
                        >
                            {run.isPending && !confirming && (
                                <Loader2 size={16} className="spin" aria-hidden="true" />
                            )}
                            Simular plano
                        </button>
                    </div>
                    <p className="field-help">
                        {selected.size > 0
                            ? `${selected.size} pedido(s) selecionado(s).`
                            : "Sem seleção, o plano considera todos os pedidos sem motorista."}
                    </p>

                    {planError && (
                        <p className="notice notice-danger" role="alert">
                            {planError}
                        </p>
                    )}

                    {plan && (
                        <div className="plan-result">
                            <div className="plan-head">
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
                                <strong className="plan-total">{formatKm(plan.totalKm)}</strong>
                            </div>

                            {noDriver ? (
                                <div className="notice notice-warning">
                                    Nenhum motorista elegível: é preciso estar Disponível, com
                                    posição recente e um veículo livre.{" "}
                                    <Link to="/map">Ver mapa ao vivo</Link>
                                </div>
                            ) : (
                                <>
                                    <div className="table-scroll">
                                        <table className="table table-compact">
                                            <thead>
                                                <tr>
                                                    <th scope="col">Pedido</th>
                                                    <th scope="col">Motorista</th>
                                                    <th scope="col">Veículo</th>
                                                    <th scope="col" className="num">
                                                        Distância
                                                    </th>
                                                    {plan.applied && <th scope="col">Despacho</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plan.assignments.map((a) => {
                                                    const row = rows[a.orderId];
                                                    return (
                                                        <tr key={a.orderId}>
                                                            <td className="data">
                                                                {label(a.orderId)}
                                                            </td>
                                                            <td>
                                                                {driverName.get(a.driverId) ??
                                                                    a.driverId}
                                                            </td>
                                                            <td className="data">
                                                                {plate.get(a.vehicleId) ??
                                                                    a.vehicleId}
                                                            </td>
                                                            <td className="num">
                                                                {formatKm(a.km)}
                                                            </td>
                                                            {plan.applied && (
                                                                <td>
                                                                    <DispatchCell row={row} />
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
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

                            {!noDriver && comparison?.summary && (
                                <div className="compare">
                                    <p className="compare-summary">{comparison.summary}</p>
                                    {ALGORITHMS.map(([value, text]) => {
                                        const km = plan.comparison[value];
                                        if (km == null) return null;
                                        return (
                                            <div key={value} className="compare-row">
                                                <span>{text}</span>
                                                <span className="compare-track" aria-hidden="true">
                                                    <span
                                                        className={`compare-bar compare-${value.toLowerCase()}`}
                                                        style={{
                                                            width: `${maxKm > 0 ? (km / maxKm) * 100 : 0}%`,
                                                        }}
                                                    />
                                                </span>
                                                <span className="data">{formatKm(km)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="plan-actions">
                                {!plan.applied && plan.assignments.length > 0 && (
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => setConfirming(true)}
                                    >
                                        Aplicar plano
                                    </button>
                                )}
                                {plan.applied && plan.assignments.length > 0 && pending > 0 && (
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        disabled={dispatching}
                                        onClick={() => void dispatchAll()}
                                    >
                                        {dispatching ? (
                                            <Loader2
                                                size={16}
                                                className="spin"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <Send size={16} aria-hidden="true" />
                                        )}
                                        {dispatched > 0 ? "Despachar pendentes" : "Despachar todos"}
                                    </button>
                                )}
                                {plan.applied && dispatched > 0 && (
                                    <span className="caption">
                                        {dispatched} de {plan.assignments.length} despachados
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {queue.data &&
                (queue.data.assignedNotDispatched.total > 0 || queue.data.inProgress.total > 0) && (
                    <section className="card">
                        <h2>Já em movimento</h2>
                        <div className="queue-columns">
                            <div>
                                <h3>
                                    Atribuídos, sem despacho (
                                    {queue.data.assignedNotDispatched.total})
                                </h3>
                                <ul className="plain-list">
                                    {queue.data.assignedNotDispatched.total === 0 && (
                                        <li className="caption">Nenhum</li>
                                    )}
                                    {queue.data.assignedNotDispatched.items.map((o) => (
                                        <li key={o.orderId}>
                                            <Link className="data" to={`/orders/${o.orderId}`}>
                                                {o.trackingNumber}
                                            </Link>
                                            <span className="caption">
                                                {o.pickupName} para {o.dropoffName}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h3>Em andamento ({queue.data.inProgress.total})</h3>
                                <ul className="plain-list">
                                    {queue.data.inProgress.total === 0 && (
                                        <li className="caption">Nenhum</li>
                                    )}
                                    {queue.data.inProgress.items.map((o) => (
                                        <li key={o.orderId}>
                                            <Link to={`/orders/${o.orderId}`}>
                                                {o.driverName ?? "Sem motorista"}
                                            </Link>
                                            <span className="caption">
                                                {o.stopsDone}/{o.stopsTotal} paradas
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                )}

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

function DispatchCell({ row }: { row: RowState | undefined }) {
    if (!row) return <span className="caption">Pendente</span>;
    if (row.state === "running")
        return (
            <span className="caption">
                <Loader2 size={14} className="spin" aria-hidden="true" /> Despachando
            </span>
        );
    if (row.state === "ok")
        return (
            <span className="badge badge-success">
                <CheckCircle2 size={14} aria-hidden="true" />
                Despachado
            </span>
        );
    return (
        <span className="badge badge-danger" title={row.message}>
            <XCircle size={14} aria-hidden="true" />
            {row.message}
        </span>
    );
}
