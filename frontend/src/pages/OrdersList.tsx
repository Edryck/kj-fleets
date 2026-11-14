import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Customer, Driver, OrderStatus, OrderSummary, Page } from "../api/types";
import { useSession } from "../auth/session";
import DataTable, { type Column } from "../components/DataTable";
import { formatDateTime } from "../components/format";
import StatusBadge from "../components/StatusBadge";

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

const SORTS: Record<string, { label: string; sort: string; dir: string }> = {
    newest: { label: "Mais recentes", sort: "createdAt", dir: "desc" },
    oldest: { label: "Mais antigos", sort: "createdAt", dir: "asc" },
    statusAsc: { label: "Status (A-Z)", sort: "status", dir: "asc" },
    statusDesc: { label: "Status (Z-A)", sort: "status", dir: "desc" },
};

// o input de data dá YYYY-MM-DD no fuso do navegador; a API quer Instant UTC
const startOfDay = (date: string) => new Date(`${date}T00:00:00`).toISOString();
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`).toISOString();

export default function OrdersList() {
    const navigate = useNavigate();
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

    // busca com debounce de 300 ms; o campo tem estado próprio para não travar a digitação
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
                <div className="route-cell">
                    <span>
                        {o.pickupName} <span className="caption">para</span> {o.dropoffName}
                    </span>
                    {o.waypointCount > 0 && (
                        <span className="caption">
                            {o.waypointCount} {o.waypointCount === 1 ? "parada" : "paradas"}
                        </span>
                    )}
                </div>
            ),
        },
        { header: "Motorista", render: (o) => o.driver?.name ?? "—" },
        {
            header: "Veículo",
            render: (o) => (o.vehicle ? <span className="data">{o.vehicle.plate}</span> : "—"),
        },
        ...(isStaff
            ? [{ header: "Cliente", render: (o: OrderSummary) => o.customer?.name ?? "—" }]
            : []),
        { header: "Criado em", render: (o) => formatDateTime(o.createdAt) },
    ];

    const newOrder = canCreate && (
        <Link className="btn btn-primary" to="/orders/new">
            <Plus size={18} aria-hidden="true" />
            Novo pedido
        </Link>
    );

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Pedidos</h1>
                    <p className="page-sub">
                        {isStaff
                            ? "Acompanhe cada pedido, da criação à entrega."
                            : "Acompanhe os seus pedidos."}
                    </p>
                </div>
                {newOrder}
            </header>

            <section className="filters" aria-label="Filtros">
                <div className="filters-row">
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
                    <label className="inline-field caption">
                        Ordenar por
                        <select
                            value={sortKey}
                            onChange={(e) => update({ sortBy: e.target.value })}
                        >
                            {Object.entries(SORTS).map(([key, s]) => (
                                <option key={key} value={key}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="chips" role="group" aria-label="Status">
                    {STATUSES.map(([value, label]) => {
                        const on = statuses.includes(value);
                        return (
                            <button
                                key={value}
                                type="button"
                                className="chip"
                                aria-pressed={on}
                                onClick={() =>
                                    update({
                                        status: on
                                            ? statuses.filter((s) => s !== value)
                                            : [...statuses, value],
                                    })
                                }
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
                <div className="filters-row">
                    <label className="inline-field">
                        <input
                            type="checkbox"
                            className="check"
                            checked={active}
                            onChange={(e) => update({ active: e.target.checked ? "true" : null })}
                        />
                        Só ativos
                    </label>
                    <label className="inline-field caption">
                        De
                        <input
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(e) => update({ from: e.target.value || null })}
                        />
                    </label>
                    <label className="inline-field caption">
                        Até
                        <input
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(e) => update({ to: e.target.value || null })}
                        />
                    </label>
                    {isStaff && (
                        <>
                            <label className="inline-field caption">
                                Motorista
                                <select
                                    value={driverId}
                                    onChange={(e) => update({ driverId: e.target.value || null })}
                                >
                                    <option value="">Todos</option>
                                    {drivers.data?.items.map((d) => (
                                        <option key={d.publicId} value={d.publicId}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="inline-field caption">
                                Cliente
                                <select
                                    value={customerId}
                                    onChange={(e) => update({ customerId: e.target.value || null })}
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
                    {hasFilters && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setParams({}, { replace: true })}
                        >
                            <X size={14} aria-hidden="true" />
                            Limpar filtros
                        </button>
                    )}
                </div>
            </section>

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
                onRowClick={(o) => navigate(`/orders/${o.publicId}`)}
                emptyTitle={hasFilters ? "Nenhum pedido com esses filtros" : "Nenhum pedido ainda"}
                emptyAction={
                    hasFilters ? (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setParams({}, { replace: true })}
                        >
                            Limpar filtros
                        </button>
                    ) : (
                        newOrder || undefined
                    )
                }
            />
        </div>
    );
}
