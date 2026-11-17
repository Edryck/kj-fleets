import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Customer, Driver, OrderStatus, OrderSummary, Page } from "../api/types";
import { useSession } from "../auth/session";
import { useTopics } from "../realtime/useTopic";
import DataTable, { type Column } from "../components/DataTable";
import { formatDateTime } from "../components/format";
import StatusBadge, { badgeEntry } from "../components/StatusBadge";
import Glass from "../glass/Glass";
import { useTotals } from "../hooks/useTotals";
import { useCountUp } from "../motion/useCountUp";
import { useTitleBlock } from "../layout/titleBlockContext";
import MiniRoute from "../patterns/MiniRoute";
import { SidePanelLayout } from "../patterns/SidePanel";
import OrderPreview from "./order/OrderPreview";

const STATUSES: [OrderStatus, string][] = [
    ["CREATED", "Criado"],
    ["DISPATCHED", "Despachado"],
    ["DRIVER_ENROUTE", "A caminho"],
    ["ARRIVED", "Chegou"],
    ["IN_PROGRESS", "Em andamento"],
    ["COMPLETED", "Concluído"],
    ["CANCELLED", "Cancelado"],
    ["FAILED", "Falhou"],
];

const STATUS_VALUES = STATUSES.map(([value]) => value);

const SORTS: Record<string, { label: string; sort: string; dir: string }> = {
    newest: { label: "Mais recentes", sort: "createdAt", dir: "desc" },
    oldest: { label: "Mais antigos", sort: "createdAt", dir: "asc" },
    statusAsc: { label: "Status (A-Z)", sort: "status", dir: "asc" },
    statusDesc: { label: "Status (Z-A)", sort: "status", dir: "desc" },
};

const startOfDay = (date: string) => new Date(`${date}T00:00:00`).toISOString();
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`).toISOString();

function StatusCount({ value }: { value: number | undefined }) {
    const text = useCountUp(value, { delay: 120 });
    return (
        <>
            <b className="status-strip-count" aria-hidden="true">
                {value == null ? "—" : text}
            </b>
            {value != null && <span className="sr-only">{value}</span>}
        </>
    );
}

export default function OrdersList() {
    const session = useSession();
    const isStaff = session?.role !== "CUSTOMER";
    const canCreate = session?.role !== "FLEET_MANAGER";
    const [params, setParams] = useSearchParams();

    const statuses = params.getAll("status");
    const active = params.get("active") === "true";
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    const driverId = params.get("driverId") ?? "";
    const customerId = params.get("customerId") ?? "";
    const q = params.get("q") ?? "";
    const sortKey =
        params.get("sortBy") && SORTS[params.get("sortBy")!] ? params.get("sortBy")! : "newest";
    const limit = Number(params.get("limit")) || 20;
    const offset = Number(params.get("offset")) || 0;
    const hasFilters = Boolean(
        statuses.length || active || from || to || driverId || customerId || q,
    );

    function update(changes: Record<string, string | string[] | null>) {
        setParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const [key, value] of Object.entries(changes)) {
                    next.delete(key);
                    for (const v of Array.isArray(value) ? value : value ? [value] : [])
                        next.append(key, v);
                }
                if (!("offset" in changes)) next.delete("offset");
                return next;
            },
            { replace: true },
        );
    }

    const [search, setSearch] = useState(q);
    useEffect(() => setSearch(q), [q]);
    useEffect(() => {
        if (search === q) return;
        const timer = setTimeout(() => update({ q: search.trim() || null }), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- update só mexe na URL
    }, [search]);

    const orders = useQuery({
        queryKey: ["orders", params.toString()],
        queryFn: () =>
            request<Page<OrderSummary>>("GET", "/orders", undefined, {
                status: statuses,
                active: active || undefined,
                from: from ? startOfDay(from) : undefined,
                to: to ? endOfDay(to) : undefined,
                driverId: isStaff ? driverId : undefined,
                customerId: isStaff ? customerId : undefined,
                q,
                sort: SORTS[sortKey].sort,
                dir: SORTS[sortKey].dir,
                limit,
                offset,
            }),
        placeholderData: (previous) => previous,
    });
    const queryClient = useQueryClient();
    useTopics<unknown>(
        isStaff ? [] : (orders.data?.items.map((o) => `/topic/orders/${o.publicId}`) ?? []),
        () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
    );
    const drivers = useQuery({
        queryKey: ["drivers", "all"],
        queryFn: () => request<Page<Driver>>("GET", "/drivers", undefined, { limit: 100 }),
        enabled: isStaff,
    });
    const customers = useQuery({
        queryKey: ["customers", "all"],
        queryFn: () => request<Page<Customer>>("GET", "/customers", undefined, { limit: 100 }),
        enabled: isStaff,
    });

    const scope = Object.fromEntries(
        Object.entries({
            active: active || undefined,
            from: from ? startOfDay(from) : undefined,
            to: to ? endOfDay(to) : undefined,
            driverId: isStaff && driverId ? driverId : undefined,
            customerId: isStaff && customerId ? customerId : undefined,
            q: q || undefined,
        }).filter((entry): entry is [string, string | true] => entry[1] !== undefined),
    );
    const totals = useTotals("/orders", "status", STATUS_VALUES, scope);
    const [selected, setSelected] = useState<OrderSummary | null>(null);
    const toggle = (o: OrderSummary) =>
        setSelected((current) => (current?.publicId === o.publicId ? null : o));

    const columns: Column<OrderSummary>[] = [
        {
            header: "Código",
            render: (o) => (
                <Link
                    to={`/orders/${o.publicId}`}
                    className="data table-link"
                    onClick={(e) => e.stopPropagation()}
                >
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
        { header: "Motorista", render: (o) => o.driver?.name ?? "—" },
        ...(isStaff
            ? [
                  {
                      header: "Veículo",
                      render: (o: OrderSummary) =>
                          o.vehicle ? <span className="data">{o.vehicle.plate}</span> : "—",
                  },
                  { header: "Cliente", render: (o: OrderSummary) => o.customer?.name ?? "—" },
              ]
            : []),
        { header: "Criado em", render: (o) => formatDateTime(o.createdAt) },
        {
            header: "Finalizado em",
            render: (o) => (o.finishedAt ? formatDateTime(o.finishedAt) : "—"),
        },
    ];

    const newOrder = canCreate && (
        <Link className="btn btn-primary" to="/orders/new">
            <Plus size={18} aria-hidden="true" />
            Novo pedido
        </Link>
    );
    const total = orders.data?.total;

    useTitleBlock({
        meta: total == null ? undefined : `${total} ${total === 1 ? "pedido" : "pedidos"}`,
        actions: newOrder || undefined,
    });

    const clearFilters = () => setParams({}, { replace: true });

    return (
        <SidePanelLayout
            open={selected !== null}
            panel={
                selected && (
                    <OrderPreview
                        key={selected.publicId}
                        id={selected.publicId}
                        trackingNumber={selected.trackingNumber}
                        isStaff={isStaff}
                        onClose={() => setSelected(null)}
                    />
                )
            }
        >
            <div className="orders-desk">
                <Glass as="section" className="filter-bar orders-filters" aria-label="Filtros">
                    <div className="status-strip" role="group" aria-label="Status">
                        {STATUSES.map(([value, label]) => {
                            const on = statuses.includes(value);
                            const count = totals[value];
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className={`tone-${badgeEntry("order", value).tone}`}
                                    aria-pressed={on}
                                    onClick={() =>
                                        update({
                                            status: on
                                                ? statuses.filter((s) => s !== value)
                                                : [...statuses, value],
                                        })
                                    }
                                >
                                    <span className="status-strip-label">
                                        <i aria-hidden="true" />
                                        {label}
                                    </span>
                                    <StatusCount value={count} />
                                </button>
                            );
                        })}
                    </div>
                    <div className="filter-bar-row">
                        <label className="search-field">
                            <Search size={16} aria-hidden="true" />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por código, origem ou destino"
                                aria-label="Buscar pedidos"
                            />
                        </label>

                        <label className="filter-toggle">
                            <input
                                type="checkbox"
                                className="check"
                                checked={active}
                                onChange={(e) =>
                                    update({ active: e.target.checked ? "true" : null })
                                }
                            />
                            Só ativos
                        </label>
                        <label className="filter-field">
                            <span>De</span>
                            <input
                                type="date"
                                value={from}
                                max={to || undefined}
                                onChange={(e) => update({ from: e.target.value || null })}
                            />
                        </label>
                        <label className="filter-field">
                            <span>Até</span>
                            <input
                                type="date"
                                value={to}
                                min={from || undefined}
                                onChange={(e) => update({ to: e.target.value || null })}
                            />
                        </label>
                        {isStaff && (
                            <>
                                <label className="filter-field">
                                    <span>Motorista</span>
                                    <select
                                        value={driverId}
                                        onChange={(e) =>
                                            update({ driverId: e.target.value || null })
                                        }
                                    >
                                        <option value="">Todos</option>
                                        {drivers.data?.items.map((d) => (
                                            <option key={d.publicId} value={d.publicId}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="filter-field">
                                    <span>Cliente</span>
                                    <select
                                        value={customerId}
                                        onChange={(e) =>
                                            update({ customerId: e.target.value || null })
                                        }
                                    >
                                        <option value="">Todos</option>
                                        {customers.data?.items.map((c) => (
                                            <option key={c.publicId} value={c.publicId}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </>
                        )}
                        <label className="filter-field">
                            <span>Ordenar por</span>
                            <select
                                value={sortKey}
                                onChange={(e) => update({ sortBy: e.target.value })}
                            >
                                {Object.entries(SORTS).map(([key, sort]) => (
                                    <option key={key} value={key}>
                                        {sort.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {hasFilters && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={clearFilters}
                            >
                                <X size={14} aria-hidden="true" />
                                Limpar filtros
                            </button>
                        )}
                    </div>
                </Glass>
                <DataTable
                    columns={columns}
                    rows={orders.data?.items}
                    rowKey={(o) => o.publicId}
                    total={orders.data?.total ?? 0}
                    limit={limit}
                    offset={offset}
                    onPage={(nextOffset, nextLimit) =>
                        update({ offset: String(nextOffset), limit: String(nextLimit) })
                    }
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
                    onRowClick={toggle}
                    selectedKey={selected?.publicId ?? null}
                    emptyTitle={
                        hasFilters ? "Nenhum pedido com esses filtros" : "Nenhum pedido ainda"
                    }
                    emptyAction={
                        hasFilters ? (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={clearFilters}
                            >
                                Limpar filtros
                            </button>
                        ) : (
                            newOrder || undefined
                        )
                    }
                />
            </div>
        </SidePanelLayout>
    );
}
