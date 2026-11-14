import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Driver, DriversPerformance, OrderSummary, Page } from "../api/types";
import { useSession } from "../auth/session";
import DataTable, { type Column } from "../components/DataTable";
import { ErrorState, Skeleton } from "../components/blocks";
import {
    formatAgo,
    formatDateTime,
    formatMinutes,
    formatPercent,
    formatRate,
} from "../components/format";
import MapView from "../components/MapView";
import PeriodSelect, { usePeriod } from "../components/PeriodSelect";
import { ConfirmDialog } from "../components/overlays";
import StatusBadge from "../components/StatusBadge";
import { useTopic, type LocationEvent } from "../realtime/useTopic";
import { DriverDrawer, useDriverActions } from "./Drivers";

type Tab = "active" | "history";

// active=false no backend devolve também CREATED; o histórico é só o que já terminou
const OPEN_STATUSES = ["CREATED", "DISPATCHED", "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS"];
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

function DriverOrders({ driverId }: { driverId: string }) {
    const [tab, setTab] = useState<Tab>("active");
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const orders = useQuery({
        queryKey: ["orders", "driver", driverId, tab, limit, offset],
        queryFn: () =>
            request<Page<OrderSummary>>("GET", "/orders", undefined, {
                driverId,
                status: tab === "active" ? OPEN_STATUSES : TERMINAL_STATUSES,
                limit,
                offset,
            }),
        placeholderData: (previous) => previous,
    });

    const columns: Column<OrderSummary>[] = [
        {
            header: "Código",
            render: (o) => (
                <Link to={`/orders/${o.publicId}`} className="data table-link">
                    {o.trackingNumber}
                </Link>
            ),
        },
        { header: "Status", render: (o) => <StatusBadge kind="order" value={o.status} /> },
        { header: "Origem e destino", render: (o) => `${o.pickupName} → ${o.dropoffName}` },
        { header: "Criado em", render: (o) => formatDateTime(o.createdAt) },
    ];

    return (
        <section className="card">
            <div className="card-head">
                <h2>Pedidos</h2>
                <div className="segmented" role="group" aria-label="Pedidos do motorista">
                    <button
                        type="button"
                        aria-pressed={tab === "active"}
                        onClick={() => {
                            setTab("active");
                            setOffset(0);
                        }}
                    >
                        Ativos
                    </button>
                    <button
                        type="button"
                        aria-pressed={tab === "history"}
                        onClick={() => {
                            setTab("history");
                            setOffset(0);
                        }}
                    >
                        Histórico
                    </button>
                </div>
            </div>
            <DataTable
                columns={columns}
                rows={orders.data?.items}
                rowKey={(o) => o.publicId}
                total={orders.data?.total ?? 0}
                limit={limit}
                offset={offset}
                onPage={(o, l) => {
                    setOffset(o);
                    setLimit(l);
                }}
                loading={orders.isLoading}
                error={
                    orders.isError
                        ? messageFor(
                              (orders.error as ApiError).code,
                              (orders.error as ApiError).message,
                          )
                        : undefined
                }
                onRetry={() => orders.refetch()}
                emptyTitle={tab === "active" ? "Nenhum pedido ativo" : "Nenhum pedido encerrado"}
            />
        </section>
    );
}

function DriverPerformance({ driverId }: { driverId: string }) {
    const [period] = usePeriod();
    const performance = useQuery({
        // chave própria: a lista de motoristas faz setQueriesData em ["drivers"] com outro formato
        queryKey: ["performance", "drivers", period],
        queryFn: () =>
            request<DriversPerformance>("GET", "/dashboard/drivers/performance", undefined, {
                period,
            }),
    });
    const row = performance.data?.drivers.find((d) => d.driverId === driverId);

    return (
        <section className="card">
            <div className="card-head">
                <h2>Desempenho</h2>
                <PeriodSelect />
            </div>
            {performance.isLoading ? (
                <Skeleton height={64} />
            ) : !row ? (
                <p className="caption">Sem pedidos no período.</p>
            ) : (
                <dl className="dl catalog-kpis">
                    <div>
                        <dt>Concluídos</dt>
                        <dd>{row.completed}</dd>
                    </div>
                    <div>
                        <dt>Falhas</dt>
                        <dd>{row.failed}</dd>
                    </div>
                    <div>
                        <dt>Taxa de sucesso</dt>
                        <dd>
                            {formatRate(row.successRate.rate)}{" "}
                            <span className="caption">({row.successRate.n} pedidos)</span>
                        </dd>
                    </div>
                    <div>
                        <dt>Até a retirada</dt>
                        <dd>{formatMinutes(row.avgDispatchToArrivedMinutes)}</dd>
                    </div>
                    <div>
                        <dt>Ocupação</dt>
                        <dd>{formatPercent(row.busyPct)}</dd>
                    </div>
                </dl>
            )}
        </section>
    );
}

export default function DriverDetail() {
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const client = useQueryClient();
    const session = useSession();
    const canWrite = session?.role === "ADMIN" || session?.role === "FLEET_MANAGER";
    const canSeePerformance = canWrite;
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const { remove, reactivate } = useDriverActions(() => navigate("/drivers"));

    const driver = useQuery({
        queryKey: ["driver", id],
        queryFn: () => request<Driver>("GET", `/drivers/${id}`),
    });

    useTopic<LocationEvent>("/topic/fleet/locations", (event) => {
        if (event.driverId !== id) return;
        client.setQueryData<Driver>(
            ["driver", id],
            (old) =>
                old && {
                    ...old,
                    status: event.status,
                    lat: event.lat,
                    lng: event.lng,
                    lastSeenAt: event.at,
                },
        );
    });

    if (driver.isError) {
        const e = driver.error as ApiError;
        return (
            <div className="stack">
                <Link to="/drivers" className="back-link">
                    <ArrowLeft size={16} aria-hidden="true" />
                    Motoristas
                </Link>
                <ErrorState
                    message={messageFor(e.code, e.message)}
                    onRetry={() => driver.refetch()}
                />
            </div>
        );
    }
    if (driver.isLoading || !driver.data) return <Skeleton height={240} />;

    const d = driver.data;
    const hasPosition = d.lat != null && d.lng != null;

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <Link to="/drivers" className="back-link">
                        <ArrowLeft size={16} aria-hidden="true" />
                        Motoristas
                    </Link>
                    <h1>{d.name}</h1>
                    <p className="page-sub">
                        <StatusBadge kind="driver" value={d.status} />{" "}
                        {!d.active && <span className="badge badge-neutral">Inativo</span>}
                    </p>
                </div>
                {canWrite && (
                    <div className="head-actions">
                        {d.active ? (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setEditing(true)}
                                >
                                    <Pencil size={16} aria-hidden="true" />
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger-ghost"
                                    onClick={() => setRemoving(true)}
                                >
                                    <Trash2 size={16} aria-hidden="true" />
                                    Excluir
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={reactivate.isPending}
                                onClick={() => reactivate.mutate(d)}
                            >
                                <RotateCcw size={16} aria-hidden="true" />
                                Reativar
                            </button>
                        )}
                    </div>
                )}
            </header>

            <div className="catalog-grid">
                <section className="card">
                    <h2>Dados</h2>
                    <dl className="dl">
                        <div>
                            <dt>Usuário</dt>
                            <dd className="data">{d.username}</dd>
                        </div>
                        <div>
                            <dt>Telefone</dt>
                            <dd>{d.phone ?? "—"}</dd>
                        </div>
                        <div>
                            <dt>CNH</dt>
                            <dd className="data">{d.licenseNumber ?? "—"}</dd>
                        </div>
                        <div>
                            <dt>Frotas</dt>
                            <dd>
                                {d.fleets.length === 0 ? (
                                    "Nenhuma frota ativa"
                                ) : (
                                    <ul className="plain-list">
                                        {d.fleets.map((f) => (
                                            <li key={f.publicId}>
                                                <Link to={`/fleets/${f.publicId}`}>{f.name}</Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </dd>
                        </div>
                    </dl>
                </section>

                <section className="card">
                    <h2>Veículo</h2>
                    {d.vehicle ? (
                        <dl className="dl">
                            <div>
                                <dt>Placa</dt>
                                <dd className="data">{d.vehicle.plate}</dd>
                            </div>
                            <div>
                                <dt>Tipo</dt>
                                <dd>{d.vehicle.type}</dd>
                            </div>
                        </dl>
                    ) : (
                        <p className="caption">Nenhum veículo vinculado.</p>
                    )}
                </section>

                <section className="card">
                    <h2>Última posição</h2>
                    <p className="caption">
                        {d.lastSeenAt ? `Visto ${formatAgo(d.lastSeenAt)}` : "Nunca enviou posição"}
                    </p>
                    {hasPosition ? (
                        <>
                            <p className="data">
                                {d.lat!.toFixed(5)}, {d.lng!.toFixed(5)}
                            </p>
                            <MapView
                                markers={[
                                    {
                                        id: d.publicId,
                                        kind: "driver",
                                        lat: d.lat!,
                                        lng: d.lng!,
                                        status: d.status,
                                        title: d.name,
                                        selected: true,
                                    },
                                ]}
                            />
                        </>
                    ) : null}
                </section>

                {canSeePerformance && <DriverPerformance driverId={d.publicId} />}
            </div>

            <DriverOrders driverId={d.publicId} />

            {editing && <DriverDrawer driver={d} onClose={() => setEditing(false)} />}
            {removing && (
                <ConfirmDialog
                    title="Excluir motorista"
                    description={`${d.name} sai da lista e deixa de receber pedidos. Pedidos criados que ainda não foram despachados ficam sem motorista.`}
                    confirmLabel="Excluir motorista"
                    destructive
                    busy={remove.isPending}
                    onClose={() => setRemoving(false)}
                    onConfirm={() => remove.mutate(d, { onSettled: () => setRemoving(false) })}
                />
            )}
        </div>
    );
}
