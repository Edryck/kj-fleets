import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Driver, DriverStatus, Page, Vehicle } from "../api/types";
import { useSession } from "../auth/session";
import CatalogFilters from "../components/CatalogFilters";
import DataTable, { type Column } from "../components/DataTable";
import { formatAgo } from "../components/format";
import { ConfirmDialog, Drawer } from "../components/overlays";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import { useTopic, type LocationEvent } from "../realtime/useTopic";

const STATUSES: [string, string][] = [
    ["AVAILABLE", "Disponível"],
    ["BUSY", "Ocupado"],
    ["OFFLINE", "Offline"],
];

interface FormValues {
    username: string;
    password: string;
    name: string;
    phone: string;
    licenseNumber: string;
    vehicleId: string;
    status: DriverStatus;
}

// lista e detalhe usam as mesmas ações; cada tela decide o que fazer depois de excluir
export function useDriverActions(onRemoved?: () => void) {
    const client = useQueryClient();
    const refresh = () => {
        void client.invalidateQueries({ queryKey: ["drivers"] });
        void client.invalidateQueries({ queryKey: ["driver"] });
    };
    const remove = useMutation({
        mutationFn: (driver: Driver) => request<void>("DELETE", `/drivers/${driver.publicId}`),
        onSuccess: () => {
            toast.success("Motorista excluído.");
            refresh();
            onRemoved?.();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });
    const reactivate = useMutation({
        mutationFn: (driver: Driver) =>
            request<Driver>("POST", `/drivers/${driver.publicId}/reactivate`),
        onSuccess: () => {
            toast.success("Motorista reativado.");
            refresh();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });
    return { remove, reactivate };
}

export function DriverDrawer({ driver, onClose }: { driver: Driver | null; onClose: () => void }) {
    const client = useQueryClient();
    const vehicles = useQuery({
        queryKey: ["vehicles", "options"],
        queryFn: () => request<Page<Vehicle>>("GET", "/vehicles", undefined, { limit: 100 }),
    });
    const form = useForm<FormValues>({
        defaultValues: {
            username: driver?.username ?? "",
            password: "",
            name: driver?.name ?? "",
            phone: driver?.phone ?? "",
            licenseNumber: driver?.licenseNumber ?? "",
            vehicleId: driver?.vehicle?.publicId ?? "",
            status: driver?.status ?? "OFFLINE",
        },
    });
    const { register, handleSubmit, setError, formState } = form;
    const busy = driver?.status === "BUSY";
    const currentVehicle = driver?.vehicle?.publicId;

    // veículo em manutenção ou de outro motorista não pode ser escolhido; o atual continua aparecendo
    const vehicleOptions = (vehicles.data?.items ?? []).filter(
        (v) =>
            v.publicId === currentVehicle ||
            (v.status !== "MAINTENANCE" &&
                (v.driverId === null || v.driverId === driver?.publicId)),
    );

    const save = useMutation({
        mutationFn: (body: object) =>
            driver
                ? request<Driver>("PUT", `/drivers/${driver.publicId}`, body)
                : request<Driver>("POST", "/drivers", body),
        onSuccess: () => {
            toast.success(driver ? "Motorista atualizado." : "Motorista cadastrado.");
            void client.invalidateQueries({ queryKey: ["drivers"] });
            void client.invalidateQueries({ queryKey: ["driver"] });
            void client.invalidateQueries({ queryKey: ["vehicles"] });
            onClose();
        },
        onError: (e: ApiError) => {
            const message = messageFor(e.code, e.message);
            if (e.code === "USERNAME_TAKEN") setError("username", { message });
            else setError("root", { message });
        },
    });

    return (
        <Drawer
            title={driver ? "Editar motorista" : "Novo motorista"}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="driver-form"
                        className="btn btn-primary"
                        disabled={save.isPending}
                    >
                        {save.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        {driver ? "Salvar motorista" : "Cadastrar motorista"}
                    </button>
                </>
            }
        >
            <form
                id="driver-form"
                className="stack"
                noValidate
                onSubmit={handleSubmit((v) => {
                    const common = {
                        name: v.name.trim(),
                        phone: v.phone.trim() || null,
                        licenseNumber: v.licenseNumber.trim() || null,
                        vehicleId: v.vehicleId || null,
                    };
                    // BUSY muda sozinho pelas rotas; mandar o status só daria 409
                    save.mutate(
                        driver
                            ? { ...common, status: busy ? undefined : v.status }
                            : { ...common, username: v.username.trim(), password: v.password },
                    );
                })}
            >
                {formState.errors.root && (
                    <p className="notice notice-danger" role="alert">
                        {formState.errors.root.message}
                    </p>
                )}
                <div className="field-row">
                    <div className="field">
                        <label htmlFor="driver-username">Usuário</label>
                        <input
                            id="driver-username"
                            className="data"
                            disabled={!!driver}
                            aria-invalid={!!formState.errors.username}
                            {...register("username", {
                                validate: (v) => !!driver || v.trim() !== "" || "Informe o usuário",
                            })}
                        />
                        {formState.errors.username ? (
                            <p className="field-error">{formState.errors.username.message}</p>
                        ) : (
                            driver && <p className="field-help">O usuário não pode ser alterado.</p>
                        )}
                    </div>
                    {!driver && (
                        <div className="field">
                            <label htmlFor="driver-password">Senha</label>
                            <input
                                id="driver-password"
                                type="password"
                                autoComplete="new-password"
                                aria-invalid={!!formState.errors.password}
                                {...register("password", {
                                    validate: (v) =>
                                        v.length >= 8 ||
                                        "A senha precisa ter pelo menos 8 caracteres",
                                })}
                            />
                            {formState.errors.password ? (
                                <p className="field-error">{formState.errors.password.message}</p>
                            ) : (
                                <p className="field-help">Mínimo de 8 caracteres.</p>
                            )}
                        </div>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="driver-name">Nome</label>
                    <input
                        id="driver-name"
                        aria-invalid={!!formState.errors.name}
                        {...register("name", {
                            validate: (v) => v.trim() !== "" || "Informe o nome",
                        })}
                    />
                    {formState.errors.name && (
                        <p className="field-error">{formState.errors.name.message}</p>
                    )}
                </div>
                <div className="field-row">
                    <div className="field">
                        <label htmlFor="driver-phone">Telefone</label>
                        <input id="driver-phone" inputMode="tel" {...register("phone")} />
                    </div>
                    <div className="field">
                        <label htmlFor="driver-license">CNH</label>
                        <input
                            id="driver-license"
                            className="data"
                            {...register("licenseNumber")}
                        />
                    </div>
                </div>
                <div className="field">
                    <label htmlFor="driver-vehicle">Veículo</label>
                    <select id="driver-vehicle" {...register("vehicleId")}>
                        <option value="">Sem veículo</option>
                        {vehicleOptions.map((v) => (
                            <option key={v.publicId} value={v.publicId}>
                                {v.plate} · {v.type}
                            </option>
                        ))}
                    </select>
                </div>
                {driver && (
                    <div className="field">
                        <label htmlFor="driver-status">Status</label>
                        <select id="driver-status" disabled={busy} {...register("status")}>
                            {busy && (
                                <option value="BUSY" disabled>
                                    Ocupado
                                </option>
                            )}
                            <option value="AVAILABLE">Disponível</option>
                            <option value="OFFLINE">Offline</option>
                        </select>
                        {busy && (
                            <p className="field-help">
                                Motorista ocupado: o status volta sozinho ao concluir o pedido.
                            </p>
                        )}
                    </div>
                )}
            </form>
        </Drawer>
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
    const [editing, setEditing] = useState<Driver | "new" | null>(null);
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

    // posição nova entra na lista sem refetch
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

    const add = (
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden="true" />
            Novo motorista
        </button>
    );

    const columns: Column<Driver>[] = [
        {
            header: "Nome",
            render: (d) => (
                <div className="route-cell">
                    <Link to={`/drivers/${d.publicId}`} className="table-link">
                        {d.name}
                    </Link>
                    {!d.active && <span className="badge badge-neutral">Inativo</span>}
                </div>
            ),
        },
        { header: "Usuário", render: (d) => <span className="data">{d.username}</span> },
        { header: "Telefone", render: (d) => d.phone ?? "—" },
        {
            header: "CNH",
            render: (d) =>
                d.licenseNumber ? <span className="data">{d.licenseNumber}</span> : "—",
        },
        { header: "Status", render: (d) => <StatusBadge kind="driver" value={d.status} /> },
        {
            header: "Veículo",
            render: (d) =>
                d.vehicle ? (
                    <div className="route-cell">
                        <span className="data">{d.vehicle.plate}</span>
                        <span className="caption">{d.vehicle.type}</span>
                    </div>
                ) : (
                    "—"
                ),
        },
        {
            header: "Última posição",
            render: (d) => (d.lastSeenAt ? formatAgo(d.lastSeenAt) : "Nunca enviou posição"),
        },
        {
            header: "Ações",
            align: "right",
            render: (d) =>
                canWrite ? (
                    <div className="row-actions">
                        {d.active ? (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    aria-label={`Editar ${d.name}`}
                                    onClick={() => setEditing(d)}
                                >
                                    <Pencil size={16} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    aria-label={`Excluir ${d.name}`}
                                    onClick={() => setRemoving(d)}
                                >
                                    <Trash2 size={16} aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={reactivate.isPending}
                                onClick={() => reactivate.mutate(d)}
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
                    <h1>Motoristas</h1>
                    <p className="page-sub">Quem dirige, em qual veículo e com que status.</p>
                </div>
                {canWrite && add}
            </header>

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
            />

            <DataTable
                columns={columns}
                rows={drivers.data?.items}
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
                emptyTitle={
                    filtered
                        ? "Nenhum motorista com esses filtros"
                        : "Nenhum motorista. Cadastre o primeiro"
                }
                emptyAction={!filtered && canWrite ? add : undefined}
            />

            {editing && (
                <DriverDrawer
                    driver={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
            {removing && (
                <ConfirmDialog
                    title="Excluir motorista"
                    description={`${removing.name} sai da lista e deixa de receber pedidos. Pedidos criados que ainda não foram despachados ficam sem motorista.`}
                    confirmLabel="Excluir motorista"
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
