import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, LayoutDashboard, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { FleetDetail as FleetDetailData, FleetSummary } from "../api/types";
import { useSession } from "../auth/session";
import { ErrorState, Skeleton } from "../components/blocks";
import { ConfirmDialog } from "../components/overlays";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import { DriverChecklist, FleetDrawer, useDeleteFleet, useInvalidateFleets } from "./Fleets";

export default function FleetDetail() {
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const session = useSession();
    const canManage = session?.role === "ADMIN" || session?.role === "FLEET_MANAGER";
    const invalidate = useInvalidateFleets();
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const remove = useDeleteFleet(() => navigate("/fleets"));

    const fleet = useQuery({
        queryKey: ["fleet", id],
        queryFn: () => request<FleetDetailData>("GET", `/fleets/${id}`),
    });

    // a seleção começa com os motoristas atuais; o salvar manda a lista inteira (PUT)
    const [selected, setSelected] = useState<string[] | null>(null);
    const current = fleet.data?.drivers.map((d) => d.publicId) ?? [];
    const driverIds = selected ?? current;
    const dirty =
        selected !== null &&
        (selected.length !== current.length || selected.some((x) => !current.includes(x)));

    const saveDrivers = useMutation({
        mutationFn: (ids: string[]) =>
            request<FleetDetailData>("PUT", `/fleets/${id}`, {
                name: fleet.data?.name,
                driverIds: ids,
            }),
        onSuccess: () => {
            toast.success("Motoristas da frota atualizados.");
            setSelected(null);
            invalidate();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });

    if (fleet.isError) {
        const e = fleet.error as ApiError;
        return (
            <div className="stack">
                <Link to="/fleets" className="back-link">
                    <ArrowLeft size={16} aria-hidden="true" />
                    Frotas
                </Link>
                <ErrorState
                    message={messageFor(e.code, e.message)}
                    onRetry={() => fleet.refetch()}
                />
            </div>
        );
    }
    if (fleet.isLoading || !fleet.data) return <Skeleton height={240} />;

    const f = fleet.data;
    const summary: FleetSummary = {
        publicId: f.publicId,
        name: f.name,
        driverCount: f.drivers.length,
    };

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <Link to="/fleets" className="back-link">
                        <ArrowLeft size={16} aria-hidden="true" />
                        Frotas
                    </Link>
                    <h1>{f.name}</h1>
                    <p className="page-sub">
                        {f.drivers.length === 1 ? "1 motorista" : `${f.drivers.length} motoristas`}
                    </p>
                </div>
                {canManage && (
                    <div className="head-actions">
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
                            className="btn btn-danger-ghost"
                            onClick={() => setRemoving(true)}
                        >
                            <Trash2 size={16} aria-hidden="true" />
                            Excluir
                        </button>
                    </div>
                )}
            </header>

            <section className="card">
                <div className="card-head">
                    <h2>Motoristas</h2>
                    {canManage && dirty && (
                        <div className="head-actions">
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setSelected(null)}
                            >
                                Desfazer
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={saveDrivers.isPending}
                                onClick={() => saveDrivers.mutate(driverIds)}
                            >
                                {saveDrivers.isPending && (
                                    <Loader2 size={14} className="spin" aria-hidden="true" />
                                )}
                                Salvar motoristas
                            </button>
                        </div>
                    )}
                </div>
                {canManage ? (
                    <DriverChecklist selected={driverIds} onChange={setSelected} />
                ) : f.drivers.length === 0 ? (
                    <p className="caption">Nenhum motorista nesta frota.</p>
                ) : (
                    <div className="table-scroll">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Status</th>
                                    <th>Veículo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {f.drivers.map((d) => (
                                    <tr key={d.publicId}>
                                        <td>
                                            <Link
                                                to={`/drivers/${d.publicId}`}
                                                className="table-link"
                                            >
                                                {d.name}
                                            </Link>
                                        </td>
                                        <td>
                                            <StatusBadge kind="driver" value={d.status} />
                                        </td>
                                        <td className="data">{d.vehicle?.plate ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {editing && <FleetDrawer fleetId={f.publicId} onClose={() => setEditing(false)} />}
            {removing && (
                <ConfirmDialog
                    title="Excluir frota"
                    description={`${summary.name} some da lista. Os motoristas continuam cadastrados, só saem desta frota.`}
                    confirmLabel="Excluir frota"
                    destructive
                    busy={remove.isPending}
                    onClose={() => setRemoving(false)}
                    onConfirm={() =>
                        remove.mutate(summary, { onSettled: () => setRemoving(false) })
                    }
                />
            )}
        </div>
    );
}
