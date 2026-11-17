import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LayoutDashboard, MapPinOff, Pencil, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { FleetDetail as FleetDetailData } from "../api/types";
import { useSession } from "../auth/session";
import { ErrorState, Skeleton } from "../components/blocks";
import type { MapMarker } from "../components/MapView";
import { ConfirmDialog } from "../components/overlays";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import { GlassMapFrame } from "../patterns/GlassMapFrame";
import { SidePanelLayout } from "../patterns/SidePanel";
import { FleetEditor, FleetStatusBar, MemberList, useDeleteFleet } from "./fleets/fleetParts";

export default function FleetDetail() {
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const session = useSession();
    const canManage = session?.role === "ADMIN" || session?.role === "FLEET_MANAGER";
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [focusId, setFocusId] = useState<string | null>(null);
    const remove = useDeleteFleet(() => navigate("/fleets"));

    const fleet = useQuery({
        queryKey: ["fleet", id],
        queryFn: () => request<FleetDetailData>("GET", `/fleets/${id}`),
    });
    const f = fleet.data;
    const count = f?.drivers.length ?? 0;

    useTitleBlock({
        title: f?.name ?? "Frota",
        eyebrow: (
            <Link to="/fleets" className="title-back">
                <ArrowLeft size={14} aria-hidden="true" />
                Frotas
            </Link>
        ),
        meta: f ? <span>{count === 1 ? "1 motorista" : `${count} motoristas`}</span> : undefined,
        actions:
            f && canManage ? (
                <>
                    <Link
                        to={`/dashboard/fleet?fleetId=${f.publicId}`}
                        className="btn btn-secondary"
                    >
                        <LayoutDashboard size={16} aria-hidden="true" />
                        Ver dashboard desta frota
                    </Link>
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
            ) : undefined,
    });

    if (fleet.isError) {
        const e = fleet.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => fleet.refetch()} />
        );
    }
    if (!f) {
        return (
            <div className="fleet-territory" aria-busy="true">
                <Skeleton height={420} />
                <Skeleton height={300} />
            </div>
        );
    }

    const markers: MapMarker[] = f.drivers.flatMap((d) =>
        d.lat == null || d.lng == null
            ? []
            : [
                  {
                      id: d.publicId,
                      kind: "driver" as const,
                      lat: d.lat,
                      lng: d.lng,
                      status: d.status,
                      title: d.name,
                      selected: d.publicId === focusId,
                  },
              ],
    );
    const unlocated = count - markers.length;

    return (
        <SidePanelLayout
            open={editing}
            panel={
                editing && <FleetEditor fleetId={f.publicId} onClose={() => setEditing(false)} />
            }
        >
            <div className="fleet-territory">
                <div className="fleet-map-wrap">
                    {markers.length > 0 ? (
                        <GlassMapFrame
                            className="fleet-map"
                            markers={markers}
                            fit
                            focusId={focusId}
                            onMarkerClick={setFocusId}
                        />
                    ) : (
                        <Glass className="fleet-map is-empty">
                            <MapPinOff size={22} aria-hidden="true" />
                            <span>Nenhum motorista desta frota enviou posição.</span>
                        </Glass>
                    )}
                    {markers.length > 0 && unlocated > 0 && (
                        <p className="fleet-map-note">
                            {unlocated === 1
                                ? "1 motorista sem posição fora do mapa"
                                : `${unlocated} motoristas sem posição fora do mapa`}
                        </p>
                    )}
                </div>
                <Glass as="section" className="fleet-members" style={{ "--i": 1 } as CSSProperties}>
                    <h2>Membros</h2>
                    <FleetStatusBar drivers={f.drivers} />
                    <MemberList drivers={f.drivers} />
                </Glass>
            </div>
            {removing && (
                <ConfirmDialog
                    title="Excluir frota"
                    description={`${f.name} some da lista. Os motoristas continuam cadastrados, só saem desta frota.`}
                    confirmLabel="Excluir frota"
                    destructive
                    busy={remove.isPending}
                    onClose={() => setRemoving(false)}
                    onConfirm={() =>
                        remove.mutate(
                            { publicId: f.publicId, name: f.name, driverCount: count },
                            { onSettled: () => setRemoving(false) },
                        )
                    }
                />
            )}
        </SidePanelLayout>
    );
}
