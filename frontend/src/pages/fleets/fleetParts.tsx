import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { messageFor } from "../../api/errors";
import { ApiError, request } from "../../api/http";
import type { Driver, DriverStatus, FleetDetail, FleetSummary, Page } from "../../api/types";
import { ErrorState, Skeleton } from "../../components/blocks";
import StatusBadge from "../../components/StatusBadge";
import { toast } from "../../components/Toasts";
import Avatar from "../../patterns/Avatar";
import { SidePanel } from "../../patterns/SidePanel";

const STACK_LIMIT = 5;

export function statusCounts(drivers: Driver[]): Record<DriverStatus, number> {
    const counts: Record<DriverStatus, number> = { AVAILABLE: 0, BUSY: 0, OFFLINE: 0 };
    for (const d of drivers) counts[d.status] += 1;
    return counts;
}

export function statusLabel(counts: Record<DriverStatus, number>): string {
    const busy = counts.BUSY === 1 ? "1 ocupado" : `${counts.BUSY} ocupados`;
    const available = counts.AVAILABLE === 1 ? "1 disponível" : `${counts.AVAILABLE} disponíveis`;
    return `${available}, ${busy}, ${counts.OFFLINE} offline`;
}

export function FleetStatusBar({ drivers }: { drivers: Driver[] }) {
    const counts = statusCounts(drivers);
    const total = drivers.length;
    return (
        <div className="fleet-bar" role="img" aria-label={statusLabel(counts)}>
            {total > 0 &&
                (["AVAILABLE", "BUSY", "OFFLINE"] as const).map(
                    (s) =>
                        counts[s] > 0 && (
                            <i
                                key={s}
                                className="motion-grow"
                                data-status={s}
                                style={{ flexGrow: counts[s] }}
                            />
                        ),
                )}
        </div>
    );
}

export function AvatarStack({ drivers }: { drivers: Driver[] }) {
    const shown = drivers.slice(0, STACK_LIMIT);
    const rest = drivers.length - shown.length;
    return (
        <div className="avatar-stack">
            {shown.map((d) => (
                <Avatar key={d.publicId} name={d.name} role="DRIVER" size="sm" />
            ))}
            {rest > 0 && <span className="avatar is-sm avatar-more">+{rest}</span>}
        </div>
    );
}

export function MemberList({ drivers }: { drivers: Driver[] }) {
    if (drivers.length === 0) return <p className="fleet-empty">Nenhum motorista nesta frota.</p>;
    return (
        <ul className="member-list" aria-label="Membros da frota">
            {drivers.map((d) => (
                <li key={d.publicId}>
                    <Avatar name={d.name} role="DRIVER" size="sm" />
                    <span className="member-text">
                        <Link to={`/drivers/${d.publicId}`}>{d.name}</Link>
                        <small className="data">{d.vehicle?.plate ?? "Sem veículo"}</small>
                    </span>
                    <StatusBadge kind="driver" value={d.status} />
                </li>
            ))}
        </ul>
    );
}

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

function FleetForm({
    fleet,
    onClose,
    onSaved = onClose,
}: {
    fleet: FleetDetail | null;
    onClose: () => void;
    onSaved?: () => void;
}) {
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
            onSaved();
        },
        onError: (e: ApiError) => setError("root", { message: messageFor(e.code, e.message) }),
    });

    return (
        <SidePanel
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
        </SidePanel>
    );
}

export function FleetEditor({
    fleetId,
    onClose,
    onSaved,
}: {
    fleetId: string | null;
    onClose: () => void;
    onSaved?: () => void;
}) {
    const detail = useQuery({
        queryKey: ["fleet", fleetId],
        queryFn: () => request<FleetDetail>("GET", `/fleets/${fleetId}`),
        enabled: fleetId !== null,
    });

    if (fleetId && detail.isError) {
        const e = detail.error as ApiError;
        return (
            <SidePanel title="Editar frota" onClose={onClose}>
                <ErrorState
                    message={messageFor(e.code, e.message)}
                    onRetry={() => detail.refetch()}
                />
            </SidePanel>
        );
    }
    if (fleetId && !detail.data) {
        return (
            <SidePanel title="Editar frota" onClose={onClose}>
                <Skeleton height={200} />
            </SidePanel>
        );
    }
    return <FleetForm fleet={detail.data ?? null} onClose={onClose} onSaved={onSaved} />;
}
