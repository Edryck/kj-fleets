import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Customer, Page } from "../api/types";
import { ErrorState, Skeleton } from "../components/blocks";
import DataTable, { type Column } from "../components/DataTable";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import Avatar from "../patterns/Avatar";
import HeroNumber from "../patterns/HeroNumber";
import { SidePanel, SidePanelLayout } from "../patterns/SidePanel";
import PersonHead from "./people/PersonHead";

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="rowline dp-row">
            <span>{label}</span>
            <b>{children}</b>
        </div>
    );
}

function CustomerPanel({ summary, onClose }: { summary: Customer; onClose: () => void }) {
    const customer = useQuery({
        queryKey: ["customer", summary.publicId],
        queryFn: () => request<Customer>("GET", `/customers/${summary.publicId}`),
    });
    const c = customer.data;

    return (
        <SidePanel
            title={summary.name}
            onClose={onClose}
            className="person-panel has-hero"
            footer={
                <Link to={`/orders?customerId=${summary.publicId}`} className="btn btn-primary">
                    Ver pedidos
                </Link>
            }
        >
            <PersonHead
                name={c?.name ?? summary.name}
                role="CUSTOMER"
                note="Cadastro feito pelo próprio cliente"
            />
            {customer.isError ? (
                <ErrorState
                    message={messageFor(
                        (customer.error as ApiError).code,
                        (customer.error as ApiError).message,
                    )}
                    onRetry={() => customer.refetch()}
                />
            ) : !c ? (
                <Skeleton height={96} />
            ) : (
                <div className="dp-rows">
                    <Row label="E-mail">
                        <span className="data">{c.email ?? "—"}</span>
                    </Row>
                    <Row label="Telefone">{c.phone ?? "—"}</Row>
                </div>
            )}
        </SidePanel>
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

    useTitleBlock({ title: "Clientes", meta: "Só consulta" });

    const items = customers.data?.items;
    const total = customers.data?.total;
    const open = openId ? items?.find((c) => c.publicId === openId) : undefined;

    const columns: Column<Customer>[] = [
        {
            header: "Cliente",
            render: (c) => (
                <div className="team-person">
                    <Avatar name={c.name} role="CUSTOMER" size="sm" />
                    <span className="team-person-text">
                        <b>{c.name}</b>
                    </span>
                </div>
            ),
        },
        { header: "E-mail", render: (c) => <span className="data">{c.email ?? "—"}</span> },
        { header: "Telefone", render: (c) => c.phone ?? "—" },
    ];

    const heroLabel = q
        ? total === 1
            ? "cliente encontrado"
            : "clientes encontrados"
        : total === 1
          ? "cliente cadastrado"
          : "clientes cadastrados";

    return (
        <SidePanelLayout
            open={open != null}
            panel={
                open && (
                    <CustomerPanel
                        key={open.publicId}
                        summary={open}
                        onClose={() => setOpenId(null)}
                    />
                )
            }
        >
            <div className="people">
                <Glass as="section" className="people-head" aria-label="Filtros">
                    <HeroNumber size="large" label={heroLabel} value={total ?? null} />
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
                </Glass>
                <DataTable
                    columns={columns}
                    rows={items}
                    rowKey={(c) => c.publicId}
                    total={total ?? 0}
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
                    onRowClick={(c) => setOpenId(c.publicId === openId ? null : c.publicId)}
                    selectedKey={openId}
                    emptyTitle={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                />
            </div>
        </SidePanelLayout>
    );
}
