import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Page, Vehicle, VehicleStatus } from "../api/types";
import { useSession } from "../auth/session";
import CatalogFilters from "../components/CatalogFilters";
import DataTable, { type Column } from "../components/DataTable";
import { ConfirmDialog, Drawer } from "../components/overlays";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import { useTopic, type OrderEvent } from "../realtime/useTopic";

const STATUSES: [string, string][] = [
    ["AVAILABLE", "Disponível"],
    ["IN_USE", "Em uso"],
    ["MAINTENANCE", "Manutenção"],
];

interface FormValues {
    plate: string;
    type: string;
    status: VehicleStatus;
}

function VehicleDrawer({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) {
    const client = useQueryClient();
    const form = useForm<FormValues>({
        defaultValues: {
            plate: vehicle?.plate ?? "",
            type: vehicle?.type ?? "",
            status: vehicle?.status === "IN_USE" ? "AVAILABLE" : (vehicle?.status ?? "AVAILABLE"),
        },
    });
    const { register, handleSubmit, setError, formState } = form;
    // em uso o status é automático (pelo despacho); manual daria 400
    const inUse = vehicle?.status === "IN_USE";

    const save = useMutation({
        mutationFn: (body: object) =>
            vehicle
                ? request<Vehicle>("PUT", `/vehicles/${vehicle.publicId}`, body)
                : request<Vehicle>("POST", "/vehicles", body),
        onSuccess: () => {
            toast.success(vehicle ? "Veículo atualizado." : "Veículo cadastrado.");
            void client.invalidateQueries({ queryKey: ["vehicles"] });
            void client.invalidateQueries({ queryKey: ["drivers"] });
            onClose();
        },
        onError: (e: ApiError) => {
            const message = messageFor(e.code, e.message);
            if (e.code === "PLATE_TAKEN") setError("plate", { message });
            else setError("root", { message });
        },
    });

    return (
        <Drawer
            title={vehicle ? "Editar veículo" : "Novo veículo"}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="vehicle-form"
                        className="btn btn-primary"
                        disabled={save.isPending}
                    >
                        {save.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        {vehicle ? "Salvar veículo" : "Cadastrar veículo"}
                    </button>
                </>
            }
        >
            <form
                id="vehicle-form"
                className="stack"
                noValidate
                onSubmit={handleSubmit((v) =>
                    save.mutate({
                        plate: v.plate.trim(),
                        type: v.type.trim(),
                        status: inUse ? undefined : v.status,
                    }),
                )}
            >
                {formState.errors.root && (
                    <p className="notice notice-danger" role="alert">
                        {formState.errors.root.message}
                    </p>
                )}
                <div className="field">
                    <label htmlFor="vehicle-plate">Placa</label>
                    <input
                        id="vehicle-plate"
                        className="data"
                        aria-invalid={!!formState.errors.plate}
                        {...register("plate", {
                            validate: (v) => v.trim() !== "" || "Informe a placa",
                        })}
                    />
                    {formState.errors.plate && (
                        <p className="field-error">{formState.errors.plate.message}</p>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="vehicle-type">Tipo</label>
                    <input
                        id="vehicle-type"
                        aria-invalid={!!formState.errors.type}
                        {...register("type", {
                            validate: (v) => v.trim() !== "" || "Informe o tipo",
                        })}
                    />
                    {formState.errors.type ? (
                        <p className="field-error">{formState.errors.type.message}</p>
                    ) : (
                        <p className="field-help">Texto livre, por exemplo Van ou Moto.</p>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="vehicle-status">Status</label>
                    <select id="vehicle-status" disabled={inUse} {...register("status")}>
                        {inUse && (
                            <option value="IN_USE" disabled>
                                Em uso
                            </option>
                        )}
                        <option value="AVAILABLE">Disponível</option>
                        <option value="MAINTENANCE">Manutenção</option>
                    </select>
                    {inUse && (
                        <p className="field-help">
                            Em uso: o status volta sozinho ao fim do pedido.
                        </p>
                    )}
                </div>
            </form>
        </Drawer>
    );
}

export default function Vehicles() {
    const client = useQueryClient();
    const session = useSession();
    const canWrite = session?.role === "ADMIN" || session?.role === "FLEET_MANAGER";
    const [q, setQ] = useState("");
    const [status, setStatus] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
    const [removing, setRemoving] = useState<Vehicle | null>(null);
    const filtered = Boolean(q || status);

    const changeQuery = useCallback((value: string) => {
        setQ(value);
        setOffset(0);
    }, []);

    const vehicles = useQuery({
        queryKey: ["vehicles", q, status, includeInactive, limit, offset],
        queryFn: () =>
            request<Page<Vehicle>>("GET", "/vehicles", undefined, {
                q,
                status,
                includeInactive: includeInactive || undefined,
                limit,
                offset,
            }),
        placeholderData: (previous) => previous,
    });

    // não há tópico de veículo: pedidos mudam o status automático (em uso), então refaz a lista
    useTopic<OrderEvent>("/topic/orders", () => {
        void client.invalidateQueries({ queryKey: ["vehicles"] });
    });

    const remove = useMutation({
        mutationFn: (vehicle: Vehicle) => request<void>("DELETE", `/vehicles/${vehicle.publicId}`),
        onSuccess: () => {
            toast.success("Veículo excluído.");
            void client.invalidateQueries({ queryKey: ["vehicles"] });
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });
    const reactivate = useMutation({
        mutationFn: (vehicle: Vehicle) =>
            request<Vehicle>("POST", `/vehicles/${vehicle.publicId}/reactivate`),
        onSuccess: () => {
            toast.success("Veículo reativado.");
            void client.invalidateQueries({ queryKey: ["vehicles"] });
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });

    const add = (
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden="true" />
            Novo veículo
        </button>
    );

    const columns: Column<Vehicle>[] = [
        {
            header: "Placa",
            render: (v) => (
                <div className="route-cell">
                    <span className="data">{v.plate}</span>
                    {!v.active && <span className="badge badge-neutral">Inativo</span>}
                </div>
            ),
        },
        { header: "Tipo", render: (v) => v.type },
        { header: "Status", render: (v) => <StatusBadge kind="vehicle" value={v.status} /> },
        { header: "Motorista", render: (v) => v.driverName ?? "—" },
        {
            header: "Ações",
            align: "right",
            render: (v) =>
                canWrite ? (
                    <div className="row-actions">
                        {v.active ? (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    aria-label={`Editar ${v.plate}`}
                                    onClick={() => setEditing(v)}
                                >
                                    <Pencil size={16} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    aria-label={`Excluir ${v.plate}`}
                                    onClick={() => setRemoving(v)}
                                >
                                    <Trash2 size={16} aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={reactivate.isPending}
                                onClick={() => reactivate.mutate(v)}
                            >
                                <RotateCcw size={14} aria-hidden="true" />
                                Reativar
                            </button>
                        )}
                    </div>
                ) : null,
        },
    ];

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Veículos</h1>
                    <p className="page-sub">Frota disponível, em uso e em manutenção.</p>
                </div>
                {canWrite && add}
            </header>

            <CatalogFilters
                searchLabel="Buscar veículos"
                placeholder="Buscar por placa ou tipo"
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
            />

            <DataTable
                columns={columns}
                rows={vehicles.data?.items}
                rowKey={(v) => v.publicId}
                total={vehicles.data?.total ?? 0}
                limit={limit}
                offset={offset}
                onPage={(o, l) => {
                    setOffset(o);
                    setLimit(l);
                }}
                loading={vehicles.isLoading}
                error={
                    vehicles.isError
                        ? messageFor(
                              (vehicles.error as ApiError).code,
                              (vehicles.error as ApiError).message,
                          )
                        : undefined
                }
                onRetry={() => vehicles.refetch()}
                emptyTitle={filtered ? "Nenhum veículo com esses filtros" : "Nenhum veículo"}
                emptyAction={!filtered && canWrite ? add : undefined}
            />

            {editing && (
                <VehicleDrawer
                    vehicle={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
            {removing && (
                <ConfirmDialog
                    title="Excluir veículo"
                    description={`${removing.plate} sai da lista e deixa de ser oferecido no despacho.`}
                    confirmLabel="Excluir veículo"
                    destructive
                    busy={remove.isPending}
                    onClose={() => setRemoving(null)}
                    onConfirm={() =>
                        remove.mutate(removing, { onSettled: () => setRemoving(null) })
                    }
                />
            )}
        </div>
    );
}
