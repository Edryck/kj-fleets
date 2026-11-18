import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Driver, Page } from "../api/types";
import { useSession } from "../auth/session";
import CatalogFilters from "../components/CatalogFilters";
import DataTable, { type Column } from "../components/DataTable";
import { formatAgo } from "../components/format";
import { ConfirmDialog } from "../components/overlays";
import StatusBadge from "../components/StatusBadge";
import { useTotal, useTotals } from "../hooks/useTotals";
import { useTitleBlock } from "../layout/titleBlockContext";
import Avatar from "../patterns/Avatar";
import { SidePanelLayout } from "../patterns/SidePanel";
import { useTopic, type LocationEvent } from "../realtime/useTopic";
import { vehicleName } from "../vehicles/catalog";
import VehicleShot from "../vehicles/VehicleShot";
import DriverForm from "./drivers/DriverForm";
import DriverPanel from "./drivers/DriverPanel";
import { useDriverActions } from "./drivers/useDriverActions";

const STATUSES: [string, string][] = [
    ["AVAILABLE", "Disponível"],
    ["BUSY", "Ocupado"],
    ["OFFLINE", "Offline"],
];
const TOTAL_KEYS = ["AVAILABLE", "BUSY", "OFFLINE"] as const;

type Panel = { mode: "detail" | "edit"; id: string } | { mode: "new" } | null;

function VehicleCell({ vehicle }: { vehicle: Driver["vehicle"] }) {
    if (!vehicle) return <span className="team-muted">Sem veículo</span>;
    const name = vehicleName(vehicle);
    const type = vehicle.type.trim();
    const named = Boolean(vehicle.brand?.trim() || vehicle.model?.trim());
    return (
        <div className="team-vehicle">
            <VehicleShot
                vehicle={vehicle}
                view="side"
                alt={`${name} ${vehicle.plate}`}
                fallback={<span className="team-vehicle-none" aria-hidden="true" />}
            />
            <span className="team-vehicle-text">
                <span className="data">{vehicle.plate}</span>
                <small>{named ? name : type}</small>
            </span>
        </div>
    );
}

export default function Drivers() {
    const client = useQueryClient();
    const session = useSession();
    const canWrite = session?.role === "ADMIN" || session?.role === "FLEET_MANAGER";
    const [q, setQ] = useState("");
    const [status, setStatus] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [panel, setPanel] = useState<Panel>(null);
    const [removing, setRemoving] = useState<Driver | null>(null);
    const { remove, reactivate } = useDriverActions();
    const filtered = Boolean(q || status);

    const changeQuery = useCallback((value: string) => {
        setQ(value);
        setOffset(0);
    }, []);

    const drivers = useQuery({
        queryKey: ["drivers", q, status, includeInactive, limit, offset],
        queryFn: () =>
            request<Page<Driver>>("GET", "/drivers", undefined, {
                q,
                status,
                includeInactive: includeInactive || undefined,
                limit,
                offset,
            }),
        placeholderData: (previous) => previous,
    });
    const totals = useTotals("/drivers", "status", TOTAL_KEYS);
    const all = useTotal("/drivers");

    useTopic<LocationEvent>("/topic/fleet/locations", (event) =>
        client.setQueriesData<Page<Driver>>({ queryKey: ["drivers"] }, (old) =>
            old
                ? {
                      ...old,
                      items: old.items.map((d) =>
                          d.publicId === event.driverId
                              ? {
                                    ...d,
                                    status: event.status,
                                    lat: event.lat,
                                    lng: event.lng,
                                    lastSeenAt: event.at,
                                }
                              : d,
                      ),
                  }
                : old,
        ),
    );

    const add = canWrite ? (
        <button type="button" className="btn btn-primary" onClick={() => setPanel({ mode: "new" })}>
            <Plus size={18} aria-hidden="true" />
            Novo motorista
        </button>
    ) : undefined;

    useTitleBlock({
        title: "Motoristas",
        meta: all != null ? `${all} ${all === 1 ? "motorista" : "motoristas"}` : undefined,
        actions: add,
    });

    const items = drivers.data?.items;
    const selectedId = panel && panel.mode !== "new" ? panel.id : null;
    const selected = selectedId ? items?.find((d) => d.publicId === selectedId) : undefined;
    const closePanel = () => setPanel(null);

    let panelNode: ReactNode = null;
    if (panel?.mode === "new") {
        panelNode = <DriverForm driver={null} onClose={closePanel} />;
    } else if (panel && selected) {
        const toDetail = () => setPanel({ mode: "detail", id: selected.publicId });
        panelNode =
            panel.mode === "edit" ? (
                <DriverForm key={selected.publicId} driver={selected} onClose={toDetail} />
            ) : (
                <DriverPanel
                    driver={selected}
                    canWrite={canWrite}
                    reactivating={reactivate.isPending}
                    onEdit={() => setPanel({ mode: "edit", id: selected.publicId })}
                    onRemove={() => setRemoving(selected)}
                    onReactivate={() => reactivate.mutate(selected)}
                    onClose={closePanel}
                />
            );
    }

    const columns: Column<Driver>[] = [
        {
            header: "Motorista",
            render: (d) => (
                <div className="team-person">
                    <Avatar name={d.name} role="DRIVER" size="sm" />
                    <span className="team-person-text">
                        <b>{d.name}</b>
                        <small className="data">{d.username}</small>
                    </span>
                    {!d.active && <span className="badge badge-neutral">Inativo</span>}
                </div>
            ),
        },
        { header: "Status", render: (d) => <StatusBadge kind="driver" value={d.status} /> },
        { header: "Veículo", render: (d) => <VehicleCell vehicle={d.vehicle} /> },
        {
            header: "Último sinal",
            render: (d) =>
                d.lastSeenAt ? (
                    formatAgo(d.lastSeenAt)
                ) : (
                    <span className="team-muted">Nunca enviou posição</span>
                ),
        },
    ];

    return (
        <SidePanelLayout open={panelNode != null} panel={panelNode}>
            <div className="team">
                <CatalogFilters
                    searchLabel="Buscar motoristas"
                    placeholder="Buscar por nome ou usuário"
                    onQuery={changeQuery}
                    statuses={STATUSES}
                    status={status}
                    onStatus={(value) => {
                        setStatus(value);
                        setOffset(0);
                    }}
                    includeInactive={includeInactive}
                    onIncludeInactive={(on) => {
                        setIncludeInactive(on);
                        setOffset(0);
                    }}
                    counts={totals}
                    total={all}
                />
                <DataTable
                    columns={columns}
                    rows={items}
                    rowKey={(d) => d.publicId}
                    total={drivers.data?.total ?? 0}
                    limit={limit}
                    offset={offset}
                    onPage={(o, l) => {
                        setOffset(o);
                        setLimit(l);
                    }}
                    loading={drivers.isLoading}
                    error={
                        drivers.isError
                            ? messageFor(
                                  (drivers.error as ApiError).code,
                                  (drivers.error as ApiError).message,
                              )
                            : undefined
                    }
                    onRetry={() => drivers.refetch()}
                    onRowClick={(d) =>
                        setPanel(
                            d.publicId === selectedId ? null : { mode: "detail", id: d.publicId },
                        )
                    }
                    selectedKey={selectedId}
                    emptyTitle={
                        filtered ? "Nenhum motorista com esses filtros" : "Nenhum motorista ainda"
                    }
                    emptyAction={!filtered ? add : undefined}
                />
            </div>
            {removing && (
                <ConfirmDialog
                    title="Excluir motorista"
                    description={`${removing.name} sai da lista e deixa de receber pedidos. Pedidos criados que ainda não foram despachados ficam sem motorista.`}
                    confirmLabel="Excluir motorista"
                    destructive
                    busy={remove.isPending}
                    onClose={() => setRemoving(null)}
                    onConfirm={() =>
                        remove.mutate(removing, {
                            onSettled: () => setRemoving(null),
                            onSuccess: () => setPanel(null),
                        })
                    }
                />
            )}
        </SidePanelLayout>
    );
}
