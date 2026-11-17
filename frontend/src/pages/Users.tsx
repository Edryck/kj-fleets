import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RotateCcw, UserX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Page, Role, UserAccount } from "../api/types";
import { useMe } from "../auth/session";
import DataTable, { type Column } from "../components/DataTable";
import { ConfirmDialog } from "../components/overlays";
import { toast } from "../components/Toasts";
import { useTitleBlock } from "../layout/titleBlockContext";
import Avatar from "../patterns/Avatar";
import { SidePanel, SidePanelLayout } from "../patterns/SidePanel";
import { ROLE_LABEL } from "../routes";
import PersonHead from "./people/PersonHead";

const MANAGED_ROLES: Role[] = ["ADMIN", "DISPATCHER", "FLEET_MANAGER"];
const ROLE_ORDER: Role[] = ["ADMIN", "DISPATCHER", "FLEET_MANAGER", "DRIVER", "CUSTOMER"];
const ROLE_COUNT: Record<Role, [string, string]> = {
    ADMIN: ["administrador", "administradores"],
    DISPATCHER: ["despachante", "despachantes"],
    FLEET_MANAGER: ["gestor de frota", "gestores de frota"],
    DRIVER: ["motorista", "motoristas"],
    CUSTOMER: ["cliente", "clientes"],
};

interface FormValues {
    username: string;
    password: string;
    role: Role;
}

type Panel = { mode: "detail"; id: string } | { mode: "new" } | null;

function useInvalidateUsers() {
    const client = useQueryClient();
    return () => void client.invalidateQueries({ queryKey: ["users"] });
}

function RolePill({ role }: { role: Role }) {
    return (
        <span className="role-pill" data-role={role}>
            {ROLE_LABEL[role]}
        </span>
    );
}

function StatusPill({ active }: { active: boolean }) {
    return active ? (
        <span className="badge badge-success">Ativo</span>
    ) : (
        <span className="badge badge-offline">Inativo</span>
    );
}

function NewUserForm({ onClose }: { onClose: () => void }) {
    const invalidate = useInvalidateUsers();
    const form = useForm<FormValues>({
        defaultValues: { username: "", password: "", role: "DISPATCHER" },
    });
    const { register, handleSubmit, setError, formState } = form;

    const create = useMutation({
        mutationFn: (v: FormValues) =>
            request<UserAccount>("POST", "/users", {
                username: v.username.trim(),
                password: v.password,
                role: v.role,
            }),
        onSuccess: () => {
            toast.success("Usuário criado.");
            invalidate();
            onClose();
        },
        onError: (e: ApiError) => {
            const message = messageFor(e.code, e.message);
            if (e.code === "USERNAME_TAKEN") setError("username", { message });
            else setError("root", { message });
        },
    });

    return (
        <SidePanel
            title="Novo usuário"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="user-form"
                        className="btn btn-primary"
                        disabled={create.isPending}
                    >
                        {create.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        Criar usuário
                    </button>
                </>
            }
        >
            <form
                id="user-form"
                className="stack"
                noValidate
                onSubmit={handleSubmit((v) => create.mutate(v))}
            >
                {formState.errors.root && (
                    <p className="notice notice-danger" role="alert">
                        {formState.errors.root.message}
                    </p>
                )}
                <div className="field">
                    <label htmlFor="user-username">Usuário</label>
                    <input
                        id="user-username"
                        className="data"
                        aria-invalid={!!formState.errors.username}
                        {...register("username", {
                            validate: (v) => v.trim() !== "" || "Informe o usuário",
                        })}
                    />
                    {formState.errors.username && (
                        <p className="field-error">{formState.errors.username.message}</p>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="user-password">Senha</label>
                    <input
                        id="user-password"
                        type="password"
                        autoComplete="new-password"
                        aria-invalid={!!formState.errors.password}
                        {...register("password", {
                            validate: (v) =>
                                v.length >= 8 || "A senha precisa ter pelo menos 8 caracteres",
                        })}
                    />
                    {formState.errors.password ? (
                        <p className="field-error">{formState.errors.password.message}</p>
                    ) : (
                        <p className="field-help">Mínimo de 8 caracteres.</p>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="user-role">Perfil</label>
                    <select id="user-role" {...register("role")}>
                        {MANAGED_ROLES.map((r) => (
                            <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                            </option>
                        ))}
                    </select>
                </div>
            </form>
        </SidePanel>
    );
}

function RoleField({ user }: { user: UserAccount }) {
    const invalidate = useInvalidateUsers();
    const [role, setRole] = useState<Role>(user.role);

    const save = useMutation({
        mutationFn: () => request<UserAccount>("PUT", `/users/${user.publicId}`, { role }),
        onSuccess: () => {
            toast.success("Perfil atualizado.");
            invalidate();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });

    return (
        <form
            className="person-role"
            onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
            }}
        >
            <div className="field">
                <label htmlFor="role-select">Perfil</label>
                <select
                    id="role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                >
                    {MANAGED_ROLES.map((r) => (
                        <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                        </option>
                    ))}
                </select>
            </div>
            <button
                type="submit"
                className="btn btn-secondary"
                disabled={save.isPending || role === user.role}
            >
                {save.isPending && <Loader2 size={16} className="spin" aria-hidden="true" />}
                Salvar perfil
            </button>
        </form>
    );
}

function UserPanel({
    user,
    note,
    manageable,
    onDeactivate,
    onReactivate,
    onClose,
}: {
    user: UserAccount;
    note: string | null;
    manageable: boolean;
    onDeactivate: () => void;
    onReactivate: () => void;
    onClose: () => void;
}) {
    let footer: ReactNode;
    if (manageable) {
        footer = user.active ? (
            <button
                type="button"
                className="btn btn-ghost btn-danger-ghost"
                aria-label={`Desativar ${user.username}`}
                onClick={onDeactivate}
            >
                <UserX size={16} aria-hidden="true" />
                Desativar
            </button>
        ) : (
            <button
                type="button"
                className="btn btn-primary"
                aria-label={`Reativar ${user.username}`}
                onClick={onReactivate}
            >
                <RotateCcw size={16} aria-hidden="true" />
                Reativar
            </button>
        );
    }

    return (
        <SidePanel
            title={user.username}
            onClose={onClose}
            footer={footer}
            className="person-panel has-hero"
        >
            <PersonHead
                name={user.username}
                mono
                meta={
                    <>
                        <RolePill role={user.role} />
                        <StatusPill active={user.active} />
                    </>
                }
                note={note}
            />
            {manageable && user.active ? (
                <RoleField key={`${user.publicId}:${user.role}`} user={user} />
            ) : (
                <p className="person-note">
                    {!manageable
                        ? note === "Você"
                            ? "Seu próprio acesso não é alterado por aqui."
                            : "Motoristas e clientes são geridos nos próprios cadastros."
                        : "Reative o acesso para alterar o perfil."}
                </p>
            )}
        </SidePanel>
    );
}

export default function Users() {
    const me = useMe();
    const invalidate = useInvalidateUsers();
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [panel, setPanel] = useState<Panel>(null);
    const [deactivating, setDeactivating] = useState<UserAccount | null>(null);
    const [reactivating, setReactivating] = useState<UserAccount | null>(null);

    const users = useQuery({
        queryKey: ["users", limit, offset],
        queryFn: () => request<Page<UserAccount>>("GET", "/users", undefined, { limit, offset }),
        placeholderData: (previous) => previous,
    });

    const toggle = useMutation({
        mutationFn: ({
            user,
            action,
        }: {
            user: UserAccount;
            action: "deactivate" | "reactivate";
        }) => request<UserAccount>("POST", `/users/${user.publicId}/${action}`),
        onSuccess: (_, { user, action }) => {
            toast.success(
                action === "deactivate"
                    ? `${user.username} desativado.`
                    : `${user.username} reativado.`,
            );
            invalidate();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });

    const items = users.data?.items;
    const total = users.data?.total;
    const noteFor = (u: UserAccount) =>
        u.username === me.data?.username
            ? "Você"
            : !MANAGED_ROLES.includes(u.role)
              ? "Gerido pelo próprio cadastro"
              : null;
    const canManage = (u: UserAccount) =>
        u.username !== me.data?.username && MANAGED_ROLES.includes(u.role);

    useTitleBlock({
        title: "Usuários",
        meta: total == null ? undefined : `${total} ${total === 1 ? "usuário" : "usuários"}`,
        actions: (
            <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPanel({ mode: "new" })}
            >
                <Plus size={18} aria-hidden="true" />
                Novo usuário
            </button>
        ),
    });

    const counted = items && total != null && total <= items.length;
    const counts = counted
        ? ROLE_ORDER.map((role) => [role, items.filter((u) => u.role === role).length] as const)
        : [];

    const selectedId = panel?.mode === "detail" ? panel.id : null;
    const selected = selectedId ? items?.find((u) => u.publicId === selectedId) : undefined;
    const closePanel = () => setPanel(null);

    let panelNode: ReactNode = null;
    if (panel?.mode === "new") {
        panelNode = <NewUserForm onClose={closePanel} />;
    } else if (selected) {
        panelNode = (
            <UserPanel
                user={selected}
                note={noteFor(selected)}
                manageable={canManage(selected)}
                onDeactivate={() => setDeactivating(selected)}
                onReactivate={() => setReactivating(selected)}
                onClose={closePanel}
            />
        );
    }

    const columns: Column<UserAccount>[] = [
        {
            header: "Usuário",
            render: (u) => {
                const note = noteFor(u);
                return (
                    <div className="team-person">
                        <Avatar name={u.username} size="sm" />
                        <span className="team-person-text">
                            <b className="data">{u.username}</b>
                            {note && <small>{note}</small>}
                        </span>
                    </div>
                );
            },
        },
        { header: "Perfil", render: (u) => <RolePill role={u.role} /> },
        { header: "Situação", render: (u) => <StatusPill active={u.active} /> },
    ];

    return (
        <SidePanelLayout open={panelNode != null} panel={panelNode}>
            <div className="people">
                {counted && (
                    <ul className="role-counts" aria-label="Usuários por perfil">
                        {counts
                            .filter(([, n]) => n > 0)
                            .map(([role, n]) => (
                                <li key={role} className="role-pill" data-role={role}>
                                    {`${n} ${ROLE_COUNT[role][n === 1 ? 0 : 1]}`}
                                </li>
                            ))}
                    </ul>
                )}
                <DataTable
                    columns={columns}
                    rows={items}
                    rowKey={(u) => u.publicId}
                    total={total ?? 0}
                    limit={limit}
                    offset={offset}
                    onPage={(o, l) => {
                        setOffset(o);
                        setLimit(l);
                    }}
                    loading={users.isLoading}
                    error={
                        users.isError
                            ? messageFor(
                                  (users.error as ApiError).code,
                                  (users.error as ApiError).message,
                              )
                            : undefined
                    }
                    onRetry={() => users.refetch()}
                    onRowClick={(u) =>
                        setPanel(
                            u.publicId === selectedId ? null : { mode: "detail", id: u.publicId },
                        )
                    }
                    selectedKey={selectedId}
                    emptyTitle="Nenhum usuário cadastrado"
                />
            </div>
            {deactivating && (
                <ConfirmDialog
                    title="Desativar usuário"
                    description={`${deactivating.username} perde o acesso à área da equipe. Dá para reativar depois.`}
                    confirmLabel="Desativar usuário"
                    destructive
                    busy={toggle.isPending}
                    onClose={() => setDeactivating(null)}
                    onConfirm={() =>
                        toggle.mutate(
                            { user: deactivating, action: "deactivate" },
                            { onSettled: () => setDeactivating(null) },
                        )
                    }
                />
            )}
            {reactivating && (
                <ConfirmDialog
                    title="Reativar usuário"
                    description={`${reactivating.username} volta a acessar a área da equipe com o perfil ${ROLE_LABEL[reactivating.role]}.`}
                    confirmLabel="Reativar usuário"
                    busy={toggle.isPending}
                    onClose={() => setReactivating(null)}
                    onConfirm={() =>
                        toggle.mutate(
                            { user: reactivating, action: "reactivate" },
                            { onSettled: () => setReactivating(null) },
                        )
                    }
                />
            )}
        </SidePanelLayout>
    );
}
