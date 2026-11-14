import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Customer, Page } from "../api/types";
import DataTable, { type Column } from "../components/DataTable";
import { ErrorState, Skeleton } from "../components/blocks";
import { Drawer } from "../components/overlays";

// só leitura: o cliente nasce no próprio cadastro (S02), a equipe não cria nem edita
function CustomerDrawer({ customerId, onClose }: { customerId: string; onClose: () => void }) {
    const customer = useQuery({
        queryKey: ["customer", customerId],
        queryFn: () => request<Customer>("GET", `/customers/${customerId}`),
    });

    return (
        <Drawer
            title="Cliente"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Fechar
                    </button>
                    <Link to={`/orders?customerId=${customerId}`} className="btn btn-primary">
                        Ver pedidos
                    </Link>
                </>
            }
        >
            {customer.isError ? (
                <ErrorState
                    message={messageFor(
                        (customer.error as ApiError).code,
                        (customer.error as ApiError).message,
                    )}
                    onRetry={() => customer.refetch()}
                />
            ) : !customer.data ? (
                <Skeleton height={120} />
            ) : (
                <dl className="dl">
                    <div>
                        <dt>Nome</dt>
                        <dd>{customer.data.name}</dd>
                    </div>
                    <div>
                        <dt>E-mail</dt>
                        <dd className="data">{customer.data.email ?? "—"}</dd>
                    </div>
                    <div>
                        <dt>Telefone</dt>
                        <dd>{customer.data.phone ?? "—"}</dd>
                    </div>
                </dl>
            )}
        </Drawer>
    );
}

export default function Customers() {
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setQ(search.trim());
            setOffset(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const customers = useQuery({
        queryKey: ["customers", q, limit, offset],
        queryFn: () =>
            request<Page<Customer>>("GET", "/customers", undefined, { q, limit, offset }),
        placeholderData: (previous) => previous,
    });

    const columns: Column<Customer>[] = [
        {
            header: "Nome",
            render: (c) => (
                <button
                    type="button"
                    className="table-link table-link-button"
                    onClick={() => setOpenId(c.publicId)}
                >
                    {c.name}
                </button>
            ),
        },
        { header: "E-mail", render: (c) => <span className="data">{c.email ?? "—"}</span> },
        { header: "Telefone", render: (c) => c.phone ?? "—" },
        {
            header: "Ações",
            align: "right",
            render: (c) => (
                <Link to={`/orders?customerId=${c.publicId}`} className="btn btn-ghost btn-sm">
                    Ver pedidos
                </Link>
            ),
        },
    ];

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Clientes</h1>
                    <p className="page-sub">
                        Quem já se cadastrou para pedir entregas. Só consulta.
                    </p>
                </div>
            </header>

            <section className="filters" aria-label="Filtros">
                <div className="filters-row">
                    <label className="search-field">
                        <Search size={16} aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nome ou e-mail"
                            aria-label="Buscar clientes"
                        />
                    </label>
                </div>
            </section>

            <DataTable
                columns={columns}
                rows={customers.data?.items}
                rowKey={(c) => c.publicId}
                total={customers.data?.total ?? 0}
                limit={limit}
                offset={offset}
                onPage={(o, l) => {
                    setOffset(o);
                    setLimit(l);
                }}
                loading={customers.isLoading}
                error={
                    customers.isError
                        ? messageFor(
                              (customers.error as ApiError).code,
                              (customers.error as ApiError).message,
                          )
                        : undefined
                }
                onRetry={() => customers.refetch()}
                emptyTitle={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            />

            {openId && <CustomerDrawer customerId={openId} onClose={() => setOpenId(null)} />}
        </div>
    );
}
