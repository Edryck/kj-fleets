import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Driver, DriversPerformance, OrderSummary, Page } from "../api/types";
import { useSession } from "../auth/session";
import { ErrorState, Skeleton } from "../components/blocks";
import DataTable, { type Column } from "../components/DataTable";
import { formatDateTime } from "../components/format";
import { ConfirmDialog } from "../components/overlays";
import PeriodSelect, { usePeriod } from "../components/PeriodSelect";
import StatusBadge, { badgeEntry } from "../components/StatusBadge";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import Avatar from "../patterns/Avatar";
import HeroNumber from "../patterns/HeroNumber";
import MiniRoute from "../patterns/MiniRoute";
import { SidePanelLayout } from "../patterns/SidePanel";
import VehicleCard from "../patterns/VehicleCard";
import { useTopic, type LocationEvent } from "../realtime/useTopic";
import DriverForm from "./drivers/DriverForm";
import { DriverPosition, lastSignal } from "./drivers/DriverPanel";
import { useDriverActions } from "./drivers/useDriverActions";

type Tab = "active" | "history";

const OPEN_STATUSES = ["CREATED", "DISPATCHED", "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS"];
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="rowline dp-row">
            <span>{label}</span>
            <b>{children}</b>
        </div>
    );
}

function DriverStatus({ driver }: { driver: Driver }) {
    const { label, tone } = badgeEntry("driver", driver.status);
    return (
        <div className={`big-status tone-${tone}${driver.status === "BUSY" ? " is-live" : ""}`}>
            <span className="big-status-dot" aria-hidden="true" />
            <b>{label}</b>
        </div>
    );
}

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
        {
            header: "Origem e destino",
            render: (o) => (
                <MiniRoute
                    pickup={o.pickupName}
                    dropoff={o.dropoffName}
                    waypoints={o.waypointCount}
                />
            ),
        },
        { header: "Criado em", render: (o) => formatDateTime(o.createdAt) },
    ];

    return (
        <Glass as="section" className="dp-card dp-orders" style={rise(4)}>
            <div className="dp-card-head">
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
        </Glass>
    );
}

function DriverPerformance({ driverId }: { driverId: string }) {
    const [period] = usePeriod();
    const performance = useQuery({
        queryKey: ["performance", "drivers", period],
        queryFn: () =>
            request<DriversPerformance>("GET", "/dashboard/drivers/performance", undefined, {
                period,
            }),
    });
    const row = performance.data?.drivers.find((d) => d.driverId === driverId);

    return (
        <Glass as="section" className="dp-card" style={rise(3)}>
            <div className="dp-card-head">
                <h2>Desempenho</h2>
                <PeriodSelect />
            </div>
            {performance.isLoading ? (
                <Skeleton height={96} />
            ) : performance.isError ? (
                <ErrorState
                    message="Não foi possível carregar o desempenho."
                    onRetry={() => performance.refetch()}
                />
            ) : !row ? (
                <p className="dp-empty">Sem pedidos no período.</p>
            ) : (
                <div className="dp-stats">
                    <HeroNumber size="stat" label="Concluídos" value={row.completed} />
                    <HeroNumber size="stat" label="Falhas" value={row.failed} />
                    <HeroNumber
                        size="stat"
                        label="Taxa de sucesso"
                        value={row.successRate.rate == null ? null : row.successRate.rate * 100}
                        decimals={1}
                        unit="%"
                        caption={`${row.successRate.n} pedidos`}
                    />
                    <HeroNumber
                        size="stat"
                        label="Até a retirada"
                        value={row.avgDispatchToArrivedMinutes}
                        unit="min"
                    />
                    <HeroNumber size="stat" label="Ocupação" value={row.busyPct} unit="%" />
                </div>
            )}
        </Glass>
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

    const d = driver.data;

    useTitleBlock({
        title: d?.name ?? "Motorista",
        eyebrow: (
            <Link to="/drivers" className="title-back">
                <ArrowLeft size={14} aria-hidden="true" />
                Motoristas
            </Link>
        ),
        meta: d ? (
            <>
                <span>{lastSignal(d)}</span>
                {!d.active && <span className="badge badge-neutral">Inativo</span>}
            </>
        ) : undefined,
        actions:
            d && canWrite ? (
                d.active ? (
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
                            className="btn btn-secondary btn-danger-ghost"
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
                )
            ) : undefined,
    });

    if (driver.isError) {
        const e = driver.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => driver.refetch()} />
        );
    }
    if (!d) {
        return (
            <div className="driver-profile" aria-busy="true">
                <div className="dp-col">
                    <Skeleton height={220} />
                    <Skeleton height={180} />
                </div>
                <div className="dp-col">
                    <Skeleton height={320} />
                </div>
            </div>
        );
    }

    return (
        <SidePanelLayout
            open={editing}
            panel={editing && <DriverForm driver={d} onClose={() => setEditing(false)} />}
        >
            <div className="driver-profile">
                <div className="dp-col">
                    <Glass as="section" className="dp-card dp-hero" style={rise(0)}>
                        <Avatar name={d.name} size="lg" />
                        <DriverStatus driver={d} />
                    </Glass>
                    <VehicleCard plate={d.vehicle?.plate ?? null} type={d.vehicle?.type} />
                    <Glass as="section" className="dp-card" style={rise(2)}>
                        <h2>Dados</h2>
                        <div className="dp-rows">
                            <Row label="Usuário">{d.username}</Row>
                            <Row label="Telefone">{d.phone ?? "—"}</Row>
                            <Row label="CNH">{d.licenseNumber ?? "—"}</Row>
                            <Row label="Frotas">
                                {d.fleets.length === 0 ? (
                                    "Nenhuma frota ativa"
                                ) : (
                                    <span className="dp-links">
                                        {d.fleets.map((f) => (
                                            <Link key={f.publicId} to={`/fleets/${f.publicId}`}>
                                                {f.name}
                                            </Link>
                                        ))}
                                    </span>
                                )}
                            </Row>
                        </div>
                    </Glass>
                </div>
                <div className="dp-col">
                    <DriverPosition driver={d} className="dp-position" />
                    {canSeePerformance && <DriverPerformance driverId={d.publicId} />}
                    <DriverOrders driverId={d.publicId} />
                </div>
            </div>
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
        </SidePanelLayout>
    );
}
