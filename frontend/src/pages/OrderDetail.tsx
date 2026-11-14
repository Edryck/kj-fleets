import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    Ban,
    Check,
    Copy,
    Loader2,
    TriangleAlert,
    UserRoundPen,
    XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type {
    Driver,
    OrderDetail as Order,
    OrderRoute,
    Page,
    TrackingEntry,
    Vehicle,
} from "../api/types";
import { useSession } from "../auth/session";
import { useTopic, type LocationEvent } from "../realtime/useTopic";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatDateTime, formatKm } from "../components/format";
import MapView, { stopMarkers, type MapMarker } from "../components/MapView";
import { ConfirmDialog, Modal } from "../components/overlays";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import {
    canAssign,
    canCancel,
    canFail,
    isActive,
    nextAction,
    TIMELINE_LABEL,
} from "./orderActions";
import { NotFound } from "./SystemPages";

type Dialog = "assign" | "pod" | "fail" | "cancel" | null;

interface Nearest {
    driver: Driver;
    distanceKm: number;
}

function AssignModal({
    order,
    busy,
    onSubmit,
    onClose,
}: {
    order: Order;
    busy: boolean;
    onSubmit: (driverId: string, vehicleId?: string) => void;
    onClose: () => void;
}) {
    const [driverId, setDriverId] = useState(order.driver?.publicId ?? "");
    const [vehicleId, setVehicleId] = useState("");
    const { lat, lng } = order.pickup;
    const drivers = useQuery({
        queryKey: ["drivers", "all"],
        queryFn: () => request<Page<Driver>>("GET", "/drivers", undefined, { limit: 100 }),
    });
    const vehicles = useQuery({
        queryKey: ["vehicles", "all"],
        queryFn: () => request<Page<Vehicle>>("GET", "/vehicles", undefined, { limit: 100 }),
    });
    const nearest = useQuery({
        queryKey: ["drivers", "nearest", lat, lng],
        queryFn: () =>
            request<Nearest[]>("GET", "/drivers/nearest", undefined, {
                lat: lat!,
                lng: lng!,
                limit: 5,
            }),
        enabled: lat != null && lng != null,
    });
    const available = drivers.data?.items.filter((d) => d.status === "AVAILABLE") ?? [];
    const freeVehicles = vehicles.data?.items.filter((v) => v.status === "AVAILABLE") ?? [];

    return (
        <Modal
            title={order.driver ? "Trocar motorista" : "Atribuir motorista"}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Voltar
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!driverId || busy}
                        onClick={() => onSubmit(driverId, vehicleId || undefined)}
                    >
                        {busy && <Loader2 size={16} className="spin" aria-hidden="true" />}
                        Atribuir
                    </button>
                </>
            }
        >
            {nearest.data && nearest.data.length > 0 && (
                <div className="field">
                    <span className="caption">Mais próximos da retirada</span>
                    <ul className="nearest">
                        {nearest.data.map(({ driver, distanceKm }) => (
                            <li key={driver.publicId}>
                                <button
                                    type="button"
                                    aria-pressed={driverId === driver.publicId}
                                    onClick={() => setDriverId(driver.publicId)}
                                >
                                    <span>{driver.name}</span>
                                    <span className="data">{formatKm(distanceKm)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="field">
                <label htmlFor="assign-driver">Motorista</label>
                <select
                    id="assign-driver"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                >
                    <option value="">Escolha um motorista</option>
                    {available.map((d) => (
                        <option key={d.publicId} value={d.publicId}>
                            {d.name}
                        </option>
                    ))}
                </select>
                {drivers.isSuccess && available.length === 0 && (
                    <p className="field-help">Nenhum motorista disponível agora.</p>
                )}
            </div>
            <div className="field">
                <label htmlFor="assign-vehicle">Veículo (opcional)</label>
                <select
                    id="assign-vehicle"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                >
                    <option value="">Usar o veículo do motorista</option>
                    {freeVehicles.map((v) => (
                        <option key={v.publicId} value={v.publicId}>
                            {v.plate}
                        </option>
                    ))}
                </select>
            </div>
        </Modal>
    );
}

function PodModal({
    busy,
    onSubmit,
    onClose,
}: {
    busy: boolean;
    onSubmit: (value: string) => void;
    onClose: () => void;
}) {
    const [value, setValue] = useState("");
    return (
        <Modal
            title="Registrar prova de entrega"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Voltar
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!value.trim() || busy}
                        onClick={() => onSubmit(value.trim())}
                    >
                        {busy && <Loader2 size={16} className="spin" aria-hidden="true" />}
                        Registrar
                    </button>
                </>
            }
        >
            <div className="field">
                <label htmlFor="pod-value">Prova de entrega</label>
                <input
                    id="pod-value"
                    value={value}
                    maxLength={255}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Nome de quem recebeu, código ou observação"
                />
                <p className="field-help">{value.length}/255</p>
            </div>
        </Modal>
    );
}

export default function OrderDetail() {
    const { id = "" } = useParams();
    const client = useQueryClient();
    const session = useSession();
    const isStaff = session?.role !== "CUSTOMER";
    const canAct = session?.role === "ADMIN" || session?.role === "DISPATCHER";
    const [dialog, setDialog] = useState<Dialog>(null);
    const [copied, setCopied] = useState(false);

    const order = useQuery({
        queryKey: ["order", id],
        queryFn: () => request<Order>("GET", `/orders/${id}`),
    });
    const tracking = useQuery({
        queryKey: ["order", id, "tracking"],
        queryFn: () => request<TrackingEntry[]>("GET", `/orders/${id}/tracking`),
    });
    const route = useQuery({
        queryKey: ["order", id, "route"],
        queryFn: () =>
            request<OrderRoute>("GET", `/orders/${id}/route`).catch((e: ApiError) => {
                if (e.code === "ROUTE_NOT_FOUND") return null;
                throw e;
            }),
        enabled: isStaff,
    });
    const driverId = order.data?.driver?.publicId;
    const driver = useQuery({
        queryKey: ["drivers", driverId],
        queryFn: () => request<Driver>("GET", `/drivers/${driverId}`),
        enabled: isStaff && !!driverId,
    });

    // status, ETA e paradas chegam por aqui para todos os perfis (cliente dono incluso)
    useTopic<unknown>(`/topic/orders/${id}`, () =>
        client.invalidateQueries({ queryKey: ["order", id] }),
    );
    // a posição do motorista só circula para a equipe
    useTopic<LocationEvent>(isStaff && driverId ? "/topic/fleet/locations" : null, (e) => {
        if (e.driverId !== driverId) return;
        client.setQueryData<Driver>(["drivers", driverId], (d) =>
            d
                ? {
                      ...d,
                      status: e.status,
                      ...(e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng } : {}),
                  }
                : d,
        );
    });

    const refresh = () => {
        void client.invalidateQueries({ queryKey: ["order", id] });
        void client.invalidateQueries({ queryKey: ["orders"] });
    };

    const act = useMutation({
        mutationFn: ({
            path,
            body,
        }: {
            path: string;
            body?: unknown;
            done?: string;
            reopenPod?: boolean;
        }) => request<unknown>("POST", `/orders/${id}/${path}`, body ?? {}),
        onSuccess: (_data, vars) => {
            if (vars.done) toast.success(vars.done);
            setDialog(null);
            refresh();
        },
        onError: (e: ApiError, vars) => {
            toast.error(messageFor(e.code, e.message));
            // transição inválida: o pedido mudou por fora, recarrega
            if (e.code === "ORDER_INVALID_TRANSITION") {
                setDialog(null);
                refresh();
            }
            if (e.code === "ORDER_POD_REQUIRED" && vars.reopenPod) setDialog("pod");
        },
    });

    const markers = useMemo<MapMarker[]>(() => {
        const o = order.data;
        if (!o) return [];
        const r = route.data;
        const list: MapMarker[] = [];
        if (r) {
            list.push(...stopMarkers(r.stops));
        } else {
            const points: [string, MapMarker["kind"], string, (typeof o)["pickup"]][] = [
                ["pickup", "pickup", "R", o.pickup],
                ...o.waypoints.map((w, i): [string, MapMarker["kind"], string, typeof w] => [
                    `w${i}`,
                    "waypoint",
                    String(i + 1),
                    w,
                ]),
                ["dropoff", "dropoff", "E", o.dropoff],
            ];
            for (const [mid, kind, label, p] of points) {
                if (p.lat != null && p.lng != null)
                    list.push({ id: mid, kind, label, lat: p.lat, lng: p.lng, title: p.name });
            }
        }
        const d = driver.data;
        if (d?.lat != null && d.lng != null) {
            list.push({
                id: "driver",
                kind: "driver",
                lat: d.lat,
                lng: d.lng,
                title: `Motorista: ${d.name}`,
            });
        }
        return list;
    }, [order.data, route.data, driver.data]);

    if (order.isError) {
        const error = order.error as ApiError;
        if (error.status === 404 || error.code === "NOT_FOUND") return <NotFound />;
        return (
            <ErrorState
                message={messageFor(error.code, error.message)}
                onRetry={() => order.refetch()}
            />
        );
    }
    if (!order.data) {
        return (
            <div className="stack">
                <Skeleton height={36} width={320} />
                <Skeleton height={220} />
                <Skeleton height={220} />
            </div>
        );
    }

    const o = order.data;
    const next = nextAction(o);
    const stopsRows = route.data?.stops ?? null;
    const placeAddress = new Map(
        [o.pickup, ...o.waypoints, o.dropoff].map((p) => [p.publicId, p.address]),
    );
    const busy = act.isPending;
    const run = (vars: Parameters<typeof act.mutate>[0]) => act.mutate(vars);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(
                `${window.location.origin}/track/${o.trackingNumber}`,
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Não foi possível copiar o link.");
        }
    };

    return (
        <div className="stack">
            <Link to="/orders" className="back-link">
                <ArrowLeft size={16} aria-hidden="true" />
                Pedidos
            </Link>

            <header className="page-head order-head">
                <div>
                    <div className="order-title">
                        <h1 className="data">{o.trackingNumber}</h1>
                        <StatusBadge kind="order" value={o.status} />
                    </div>
                    <p className="page-sub">
                        Criado em {formatDateTime(o.createdAt)}
                        {o.dispatchedAt && <> · despachado em {formatDateTime(o.dispatchedAt)}</>}
                        {o.finishedAt && <> · finalizado em {formatDateTime(o.finishedAt)}</>}
                    </p>
                    <p className="caption data">{o.publicId}</p>
                </div>
                <div className="head-actions">
                    <button type="button" className="btn btn-secondary" onClick={copyLink}>
                        {copied ? (
                            <Check size={16} aria-hidden="true" />
                        ) : (
                            <Copy size={16} aria-hidden="true" />
                        )}
                        {copied ? "Link copiado" : "Copiar link público"}
                    </button>
                    {canAct && (
                        <>
                            {canAssign(o.status) && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setDialog("assign")}
                                >
                                    <UserRoundPen size={16} aria-hidden="true" />
                                    {o.driver ? "Trocar motorista" : "Atribuir motorista"}
                                </button>
                            )}
                            {o.status === "IN_PROGRESS" && !o.podValue && next?.kind !== "pod" && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setDialog("pod")}
                                >
                                    Registrar prova de entrega
                                </button>
                            )}
                            {canFail(o.status) && (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-danger-ghost"
                                    onClick={() => setDialog("fail")}
                                >
                                    <XCircle size={16} aria-hidden="true" />
                                    Falhou
                                </button>
                            )}
                            {canCancel(o.status) && (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-danger-ghost"
                                    onClick={() => setDialog("cancel")}
                                >
                                    <Ban size={16} aria-hidden="true" />
                                    Cancelar
                                </button>
                            )}
                            {next && (
                                <button
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
                                    {busy && (
                                        <Loader2 size={16} className="spin" aria-hidden="true" />
                                    )}
                                    {next.label}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {o.status === "CREATED" && canAct && !next && (
                <p className="notice notice-warning">
                    <TriangleAlert size={14} aria-hidden="true" /> Atribua motorista e veículo para
                    poder despachar.
                </p>
            )}

            <div className="order-grid">
                <div className="stack">
                    <section className="card">
                        <h2>Envolvidos</h2>
                        <dl className="dl">
                            <div>
                                <dt>Cliente</dt>
                                <dd>{o.customer?.name ?? "—"}</dd>
                            </div>
                            <div>
                                <dt>Motorista</dt>
                                <dd>
                                    {o.driver ? (
                                        isStaff ? (
                                            <Link to={`/drivers/${o.driver.publicId}`}>
                                                {o.driver.name}
                                            </Link>
                                        ) : (
                                            o.driver.name
                                        )
                                    ) : (
                                        "—"
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Veículo</dt>
                                <dd className={o.vehicle ? "data" : undefined}>
                                    {o.vehicle?.plate ?? "—"}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section className="card">
                        <h2>Paradas</h2>
                        <div className="table-scroll">
                            <table className="table table-compact">
                                <thead>
                                    <tr>
                                        <th scope="col">#</th>
                                        <th scope="col">Tipo</th>
                                        <th scope="col">Local</th>
                                        {stopsRows && (
                                            <th scope="col" className="num">
                                                Perna
                                            </th>
                                        )}
                                        {stopsRows && <th scope="col">Visitada em</th>}
                                        {stopsRows && (
                                            <th scope="col" className="num">
                                                Raio
                                            </th>
                                        )}
                                        {canAct && stopsRows && (
                                            <th scope="col">
                                                <span className="sr-only">Ação</span>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(
                                        stopsRows ?? [
                                            {
                                                seq: 0,
                                                type: "PICKUP" as const,
                                                placeId: o.pickup.publicId,
                                                name: o.pickup.name,
                                            },
                                            ...o.waypoints.map((w, i) => ({
                                                seq: i + 1,
                                                type: "WAYPOINT" as const,
                                                placeId: w.publicId,
                                                name: w.name,
                                            })),
                                            {
                                                seq: o.waypoints.length + 1,
                                                type: "DROPOFF" as const,
                                                placeId: o.dropoff.publicId,
                                                name: o.dropoff.name,
                                            },
                                        ]
                                    ).map((s) => {
                                        const full = "legKm" in s ? s : null;
                                        return (
                                            <tr key={s.seq}>
                                                <td className="data">{s.seq}</td>
                                                <td>
                                                    <StatusBadge kind="stop" value={s.type} />
                                                </td>
                                                <td>
                                                    {s.name}
                                                    {s.placeId && placeAddress.get(s.placeId) && (
                                                        <div className="caption">
                                                            {placeAddress.get(s.placeId)}
                                                        </div>
                                                    )}
                                                </td>
                                                {full && (
                                                    <td className="num">{formatKm(full.legKm)}</td>
                                                )}
                                                {full && <td>{formatDateTime(full.visitedAt)}</td>}
                                                {full && (
                                                    <td className="num data">
                                                        {full.distanceM == null
                                                            ? "—"
                                                            : `${Math.round(full.distanceM)} m`}
                                                    </td>
                                                )}
                                                {canAct && full && (
                                                    <td>
                                                        {s.type === "WAYPOINT" &&
                                                            !full.visitedAt &&
                                                            isActive(o.status) && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-sm"
                                                                    disabled={busy}
                                                                    onClick={() =>
                                                                        run({
                                                                            path: `stops/${s.seq}/complete`,
                                                                            done: `Parada ${s.seq} concluída.`,
                                                                        })
                                                                    }
                                                                >
                                                                    Concluir
                                                                </button>
                                                            )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="card">
                        <h2>Carga</h2>
                        {o.items.length === 0 ? (
                            <p className="field-help">Nenhum item informado.</p>
                        ) : (
                            <ul className="items-list">
                                {o.items.map((item, i) => (
                                    <li key={i}>
                                        <span>{item.name}</span>
                                        <span className="data">x{item.quantity}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <dl className="dl dl-gap">
                            {o.notes && (
                                <div>
                                    <dt>Observações</dt>
                                    <dd>{o.notes}</dd>
                                </div>
                            )}
                            {o.meta &&
                                Object.entries(o.meta).map(([k, v]) => (
                                    <div key={k}>
                                        <dt className="data">{k}</dt>
                                        <dd>{typeof v === "string" ? v : JSON.stringify(v)}</dd>
                                    </div>
                                ))}
                            <div>
                                <dt>Prova de entrega</dt>
                                <dd>
                                    {o.podValue ? (
                                        <>
                                            Registrada em {formatDateTime(o.podAt)}
                                            <div className="caption">{o.podValue}</div>
                                        </>
                                    ) : o.podRequired ? (
                                        "Exigida, ainda não registrada"
                                    ) : (
                                        "Não exigida"
                                    )}
                                </dd>
                            </div>
                            {o.reason && (o.status === "CANCELLED" || o.status === "FAILED") && (
                                <div>
                                    <dt>Motivo</dt>
                                    <dd>{o.reason}</dd>
                                </div>
                            )}
                        </dl>
                    </section>
                </div>

                <div className="stack">
                    {isStaff && (
                        <section className="card map-card">
                            <h2>Mapa</h2>
                            {markers.length > 0 ? (
                                <MapView markers={markers} line />
                            ) : (
                                <EmptyState title="Sem pontos com coordenadas" />
                            )}
                            {driverId && driver.data && driver.data.lat == null && (
                                <p className="field-help">Motorista sem posição.</p>
                            )}
                        </section>
                    )}

                    {/* bloco da rota (Task 5) entra aqui */}

                    <section className="card">
                        <h2>Linha do tempo</h2>
                        {tracking.isError ? (
                            <ErrorState
                                message="Não foi possível carregar o histórico."
                                onRetry={() => tracking.refetch()}
                            />
                        ) : !tracking.data ? (
                            <Skeleton height={80} />
                        ) : (
                            <ol className="timeline">
                                {[...tracking.data].reverse().map((t, i) => (
                                    <li
                                        key={`${t.at}-${i}`}
                                        className={`tl-${t.status === "CANCELLED" || t.status === "FAILED" ? "bad" : "ok"}`}
                                    >
                                        <div className="tl-head">
                                            <strong>{TIMELINE_LABEL[t.code] ?? t.code}</strong>
                                            <span className="caption">{formatDateTime(t.at)}</span>
                                        </div>
                                        {t.details && <div className="tl-details">{t.details}</div>}
                                        {t.lat != null && t.lng != null && (
                                            <div className="caption data">
                                                {t.lat.toFixed(5)}, {t.lng.toFixed(5)}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            </div>

            {dialog === "assign" && (
                <AssignModal
                    order={o}
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onSubmit={(driverId, vehicleId) =>
                        run({
                            path: "assign",
                            body: { driverId, vehicleId },
                            done: "Motorista atribuído.",
                        })
                    }
                />
            )}
            {dialog === "pod" && (
                <PodModal
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onSubmit={(value) =>
                        run({ path: "pod", body: { value }, done: "Prova de entrega registrada." })
                    }
                />
            )}
            {dialog === "fail" && (
                <ConfirmDialog
                    title="Marcar como falhou"
                    description="Descreva o que aconteceu. O motivo fica no histórico do pedido."
                    confirmLabel="Marcar como falhou"
                    destructive
                    askReason
                    reasonRequired
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onConfirm={(reason) =>
                        run({
                            path: "activity",
                            body: { code: "FAILED", reason },
                            done: "Pedido marcado como falhou.",
                        })
                    }
                />
            )}
            {dialog === "cancel" && (
                <ConfirmDialog
                    title="Cancelar pedido"
                    description={`O pedido ${o.trackingNumber} será cancelado e o motorista liberado. Isso não pode ser desfeito.`}
                    confirmLabel="Cancelar pedido"
                    destructive
                    askReason
                    reasonRequired
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onConfirm={(reason) =>
                        run({ path: "cancel", body: { reason }, done: "Pedido cancelado." })
                    }
                />
            )}
        </div>
    );
}
