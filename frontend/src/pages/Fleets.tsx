import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Driver, FleetDetail, FleetSummary, Page } from "../api/types";
import { useSession } from "../auth/session";
import DataTable, { type Column } from "../components/DataTable";
import { ErrorState, Skeleton } from "../components/blocks";
import { ConfirmDialog, Drawer } from "../components/overlays";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";

export function useInvalidateFleets() {
    const client = useQueryClient();
    return () => {
        void client.invalidateQueries({ queryKey: ["fleets"] });
        void client.invalidateQueries({ queryKey: ["fleet"] });
        void client.invalidateQueries({ queryKey: ["drivers"] });
    };
}

export function useDeleteFleet(onDeleted?: () => void) {
    const invalidate = useInvalidateFleets();
    return useMutation({
        mutationFn: (fleet: FleetSummary) => request<void>("DELETE", `/fleets/${fleet.publicId}`),
        onSuccess: () => {
            toast.success("Frota excluída.");
            invalidate();
            onDeleted?.();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });
}

// todos os motoristas (inclusive inativos, para não sumirem da frota) marcados ou não
export function DriverChecklist({
    selected,
    onChange,
}: {
    selected: string[];
    onChange: (ids: string[]) => void;
}) {
    const PAGE = 100;
    const drivers = useInfiniteQuery({
        queryKey: ["drivers", "fleet-options"],
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            request<Page<Driver>>("GET", "/drivers", undefined, {
                includeInactive: true,
                limit: PAGE,
                offset: pageParam,
            }),
        // a API limita a página em 100, então busca o resto sob demanda
        getNextPageParam: (last, all) => {
            const loaded = all.length * PAGE;
            return loaded < last.total ? loaded : undefined;
        },
    });
    const items = drivers.data?.pages.flatMap((p) => p.items) ?? [];

    if (drivers.isLoading) return <Skeleton height={120} />;
    if (drivers.isError) {
        const e = drivers.error as ApiError;
        return (
            <ErrorState message={messageFor(e.code, e.message)} onRetry={() => drivers.refetch()} />
        );
    }
    if (!items.length) {
        return <p className="caption">Nenhum motorista cadastrado ainda.</p>;
    }

    const toggle = (id: string, on: boolean) =>
        onChange(on ? [...selected, id] : selected.filter((x) => x !== id));

    return (
        <ul className="checklist" aria-label="Motoristas da frota">
            {items.map((d) => (
                <li key={d.publicId}>
                    <label className="checklist-row">
                        <input
                            type="checkbox"
                            className="check"
                            checked={selected.includes(d.publicId)}
                            onChange={(e) => toggle(d.publicId, e.target.checked)}
                        />
                        <span className="checklist-name">{d.name}</span>
                        <span className="caption data">{d.username}</span>
                        <StatusBadge kind="driver" value={d.status} />
                        {!d.active && <span className="badge badge-neutral">Inativo</span>}
                    </label>
                </li>
            ))}
            {drivers.hasNextPage && (
                <li>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={drivers.isFetchingNextPage}
                        onClick={() => void drivers.fetchNextPage()}
                    >
                        Carregar mais motoristas
                    </button>
                </li>
            )}
        </ul>
    );
}

function FleetForm({ fleet, onClose }: { fleet: FleetDetail | null; onClose: () => void }) {
    const invalidate = useInvalidateFleets();
    const [driverIds, setDriverIds] = useState<string[]>(
        () => fleet?.drivers.map((d) => d.publicId) ?? [],
    );
    const form = useForm<{ name: string }>({ defaultValues: { name: fleet?.name ?? "" } });
    const { register, handleSubmit, setError, formState } = form;

    const save = useMutation({
        mutationFn: (body: { name: string; driverIds: string[] }) =>
            fleet
                ? request<FleetDetail>("PUT", `/fleets/${fleet.publicId}`, body)
                : request<FleetDetail>("POST", "/fleets", body),
        onSuccess: () => {
            toast.success(fleet ? "Frota atualizada." : "Frota criada.");
            invalidate();
            onClose();
        },
        onError: (e: ApiError) => setError("root", { message: messageFor(e.code, e.message) }),
    });

    return (
        <Drawer
            title={fleet ? "Editar frota" : "Nova frota"}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="fleet-form"
                        className="btn btn-primary"
                        disabled={save.isPending}
                    >
                        {save.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        {fleet ? "Salvar frota" : "Criar frota"}
                    </button>
                </>
            }
        >
            <form
                id="fleet-form"
                className="stack"
                noValidate
                onSubmit={handleSubmit((v) => save.mutate({ name: v.name.trim(), driverIds }))}
            >
                {formState.errors.root && (
                    <p className="notice notice-danger" role="alert">
                        {formState.errors.root.message}
                    </p>
                )}
                <div className="field">
                    <label htmlFor="fleet-name">Nome</label>
                    <input
                        id="fleet-name"
                        placeholder="Ex.: Turno da manhã"
                        aria-invalid={!!formState.errors.name}
                        {...register("name", {
                            validate: (v) => v.trim() !== "" || "Informe o nome da frota",
                        })}
                    />
                    {formState.errors.name && (
                        <p className="field-error">{formState.errors.name.message}</p>
                    )}
                </div>
                <div className="field">
                    <span className="field-label">Motoristas</span>
                    <DriverChecklist selected={driverIds} onChange={setDriverIds} />
                </div>
            </form>
        </Drawer>
    );
}

// a lista de frotas abre o drawer com o detalhe (motoristas atuais) já carregado
export function FleetDrawer({ fleetId, onClose }: { fleetId: string | null; onClose: () => void }) {
    const detail = useQuery({
        queryKey: ["fleet", fleetId],
        queryFn: () => request<FleetDetail>("GET", `/fleets/${fleetId}`),
        enabled: fleetId !== null,
    });

    if (fleetId && detail.isError) {
        const e = detail.error as ApiError;
        return (
            <Drawer title="Editar frota" onClose={onClose}>
                <ErrorState
                    message={messageFor(e.code, e.message)}
                    onRetry={() => detail.refetch()}
                />
            </Drawer>
        );
    }
    if (fleetId && !detail.data) {
        return (
            <Drawer title="Editar frota" onClose={onClose}>
                <Skeleton height={200} />
            </Drawer>
        );
    }
    return <FleetForm fleet={detail.data ?? null} onClose={onClose} />;
}

export default function Fleets() {
    const session = useSession();
    const canWrite = session?.role === "ADMIN" || session?.role === "FLEET_MANAGER";
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    // "new" abre o drawer vazio; um id abre a edição
    const [editing, setEditing] = useState<string | "new" | null>(null);
    const [removing, setRemoving] = useState<FleetSummary | null>(null);
    const remove = useDeleteFleet();

    const fleets = useQuery({
        queryKey: ["fleets", limit, offset],
        queryFn: () => request<Page<FleetSummary>>("GET", "/fleets", undefined, { limit, offset }),
        placeholderData: (previous) => previous,
    });

    const add = (
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden="true" />
            Nova frota
        </button>
    );

    const columns: Column<FleetSummary>[] = [
        {
            header: "Nome",
            render: (f) => (
                <Link to={`/fleets/${f.publicId}`} className="table-link">
                    {f.name}
                </Link>
            ),
        },
        { header: "Motoristas", align: "right", render: (f) => f.driverCount },
        ...(canWrite
            ? [
                  {
                      header: "Ações",
                      align: "right" as const,
                      render: (f: FleetSummary) => (
                          <div className="row-actions">
                              <button
                                  type="button"
                                  className="btn btn-ghost btn-icon"
                                  aria-label={`Editar ${f.name}`}
                                  onClick={() => setEditing(f.publicId)}
                              >
                                  <Pencil size={16} aria-hidden="true" />
                              </button>
                              <button
                                  type="button"
                                  className="btn btn-ghost btn-icon"
                                  aria-label={`Excluir ${f.name}`}
                                  onClick={() => setRemoving(f)}
                              >
                                  <Trash2 size={16} aria-hidden="true" />
                              </button>
                          </div>
                      ),
                  },
              ]
            : []),
    ];

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Frotas</h1>
                    <p className="page-sub">Grupos de motoristas. Filtram o dashboard de gestão.</p>
                </div>
                {canWrite && add}
            </header>

            <DataTable
                columns={columns}
                rows={fleets.data?.items}
                rowKey={(f) => f.publicId}
                total={fleets.data?.total ?? 0}
                limit={limit}
                offset={offset}
                onPage={(o, l) => {
                    setOffset(o);
                    setLimit(l);
                }}
                loading={fleets.isLoading}
                error={
                    fleets.isError
                        ? messageFor(
                              (fleets.error as ApiError).code,
                              (fleets.error as ApiError).message,
                          )
                        : undefined
                }
                onRetry={() => fleets.refetch()}
                emptyTitle="Nenhuma frota. Agrupe motoristas para filtrar o dashboard"
                emptyAction={canWrite ? add : undefined}
            />

            {editing && (
                <FleetDrawer
                    fleetId={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
            {removing && (
                <ConfirmDialog
                    title="Excluir frota"
                    description={`${removing.name} some da lista. Os motoristas continuam cadastrados, só saem desta frota.`}
                    confirmLabel="Excluir frota"
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
