import { useQueries, useQuery } from "@tanstack/react-query";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { FleetDetail, FleetSummary, Page } from "../api/types";
import { useSession } from "../auth/session";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { PAGE_SIZES, Pager } from "../components/DataTable";
import { ConfirmDialog } from "../components/overlays";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import { SidePanel, SidePanelLayout } from "../patterns/SidePanel";
import {
    AvatarStack,
    FleetEditor,
    FleetStatusBar,
    MemberList,
    useDeleteFleet,
} from "./fleets/fleetParts";

type Panel = { mode: "members" | "edit"; id: string } | { mode: "new" } | null;

const driverLabel = (n: number) => (n === 1 ? "motorista" : "motoristas");

function FleetCard({
    fleet,
    detail,
    selected,
    index,
    onSelect,
}: {
    fleet: FleetSummary;
    detail: FleetDetail | undefined;
    selected: boolean;
    index: number;
    onSelect: () => void;
}) {
    return (
        <Glass
            as="article"
            className={`fleet-card${selected ? " is-selected" : ""}`}
            style={{ "--i": Math.min(index, 12) } as CSSProperties}
        >
            <h2 className="fleet-card-name">
                <button type="button" aria-pressed={selected} onClick={onSelect}>
                    {fleet.name}
                </button>
            </h2>
            <span className="fleet-count">
                <b>{fleet.driverCount}</b> {driverLabel(fleet.driverCount)}
            </span>
            {detail ? (
                <>
                    <FleetStatusBar drivers={detail.drivers} />
                    <AvatarStack drivers={detail.drivers} />
                </>
            ) : (
                <div className="fleet-card-loading" aria-hidden="true">
                    <Skeleton height={8} />
                    <Skeleton height={30} width="45%" />
                </div>
            )}
        </Glass>
    );
}

function MembersPanel({
    fleet,
    detail,
    canWrite,
    onEdit,
    onRemove,
    onClose,
}: {
    fleet: FleetSummary;
    detail: FleetDetail | undefined;
    canWrite: boolean;
    onEdit: () => void;
    onRemove: () => void;
    onClose: () => void;
}) {
    const footer = (
        <>
            <Link className="btn btn-secondary" to={`/fleets/${fleet.publicId}`}>
                Abrir frota
            </Link>
            {canWrite && (
                <>
                    <button type="button" className="btn btn-ghost" onClick={onEdit}>
                        <Pencil size={16} aria-hidden="true" />
                        Editar
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-danger-ghost"
                        onClick={onRemove}
                    >
                        <Trash2 size={16} aria-hidden="true" />
                        Excluir
                    </button>
                </>
            )}
        </>
    );
    return (
        <SidePanel title={fleet.name} onClose={onClose} footer={footer} className="fleet-panel">
            <span className="fleet-count is-panel">
                <b>{fleet.driverCount}</b> {driverLabel(fleet.driverCount)}
            </span>
            {detail ? (
                <>
                    <FleetStatusBar drivers={detail.drivers} />
                    <MemberList drivers={detail.drivers} />
                </>
            ) : (
                <Skeleton height={160} />
            )}
        </SidePanel>
    );
}

export default function Fleets() {
    const session = useSession();
    const canWrite = session?.role === "ADMIN" || session?.role === "FLEET_MANAGER";
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [panel, setPanel] = useState<Panel>(null);
    const [removing, setRemoving] = useState<FleetSummary | null>(null);
    const remove = useDeleteFleet();

    const fleets = useQuery({
        queryKey: ["fleets", limit, offset],
        queryFn: () => request<Page<FleetSummary>>("GET", "/fleets", undefined, { limit, offset }),
        placeholderData: (previous) => previous,
    });
    const items = fleets.data?.items;
    const details = useQueries({
        queries: (items ?? []).map((f) => ({
            queryKey: ["fleet", f.publicId],
            queryFn: () => request<FleetDetail>("GET", `/fleets/${f.publicId}`),
            staleTime: 30_000,
        })),
    });
    const detailOf = (id: string) =>
        details[items?.findIndex((f) => f.publicId === id) ?? -1]?.data;

    const add = canWrite ? (
        <button type="button" className="btn btn-primary" onClick={() => setPanel({ mode: "new" })}>
            <Plus size={18} aria-hidden="true" />
            Nova frota
        </button>
    ) : undefined;
    const total = fleets.data?.total;

    useTitleBlock({
        title: "Frotas",
        meta: total == null ? undefined : `${total} ${total === 1 ? "frota" : "frotas"}`,
        actions: add,
    });

    const selectedId = panel && panel.mode !== "new" ? panel.id : null;
    const selected = selectedId ? items?.find((f) => f.publicId === selectedId) : undefined;
    const closePanel = () => setPanel(null);

    let panelNode: ReactNode = null;
    if (panel?.mode === "new") {
        panelNode = <FleetEditor fleetId={null} onClose={closePanel} />;
    } else if (panel && selected) {
        const toMembers = () => setPanel({ mode: "members", id: selected.publicId });
        panelNode =
            panel.mode === "edit" ? (
                <FleetEditor
                    key={selected.publicId}
                    fleetId={selected.publicId}
                    onClose={toMembers}
                />
            ) : (
                <MembersPanel
                    fleet={selected}
                    detail={detailOf(selected.publicId)}
                    canWrite={canWrite}
                    onEdit={() => setPanel({ mode: "edit", id: selected.publicId })}
                    onRemove={() => setRemoving(selected)}
                    onClose={closePanel}
                />
            );
    }

    let body: ReactNode;
    if (fleets.isError) {
        const e = fleets.error as ApiError;
        body = (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => fleets.refetch()} />
        );
    } else if (!items) {
        body = (
            <div className="fleet-grid" aria-busy="true">
                {Array.from({ length: 4 }, (_, i) => (
                    <Glass key={i} className="fleet-card is-loading">
                        <Skeleton height={20} width="50%" />
                        <Skeleton height={40} width="35%" />
                        <Skeleton height={8} />
                    </Glass>
                ))}
            </div>
        );
    } else if (items.length === 0) {
        body = (
            <EmptyState
                icon={Layers}
                title="Nenhuma frota"
                description="Agrupe motoristas para filtrar o dashboard."
                action={add}
            />
        );
    } else {
        body = (
            <>
                <div className="fleet-grid">
                    {items.map((f, i) => (
                        <FleetCard
                            key={f.publicId}
                            fleet={f}
                            detail={details[i]?.data}
                            index={i}
                            selected={f.publicId === selectedId}
                            onSelect={() =>
                                setPanel(
                                    f.publicId === selectedId
                                        ? null
                                        : { mode: "members", id: f.publicId },
                                )
                            }
                        />
                    ))}
                </div>
                {(fleets.data?.total ?? 0) > PAGE_SIZES[0] && (
                    <Glass className="garage-pager">
                        <Pager
                            total={fleets.data?.total ?? 0}
                            limit={limit}
                            offset={offset}
                            onPage={(o, l) => {
                                setOffset(o);
                                setLimit(l);
                            }}
                        />
                    </Glass>
                )}
            </>
        );
    }

    return (
        <SidePanelLayout open={panelNode != null} panel={panelNode}>
            <div className="fleets">{body}</div>
            {removing && (
                <ConfirmDialog
                    title="Excluir frota"
                    description={`${removing.name} some da lista. Os motoristas continuam cadastrados, só saem desta frota.`}
                    confirmLabel="Excluir frota"
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
