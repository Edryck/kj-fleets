import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RotateCcw, UserX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Page, Role, UserAccount } from "../api/types";
import { useMe } from "../auth/session";
import DataTable, { type Column } from "../components/DataTable";
import { ConfirmDialog, Drawer, Modal } from "../components/overlays";
import { toast } from "../components/Toasts";
import { ROLE_LABEL } from "../routes";

// motorista e cliente nascem e são geridos nos próprios cadastros
const MANAGED_ROLES: Role[] = ["ADMIN", "DISPATCHER", "FLEET_MANAGER"];

interface FormValues {
    username: string;
    password: string;
    role: Role;
}

function useInvalidateUsers() {
    const client = useQueryClient();
    return () => void client.invalidateQueries({ queryKey: ["users"] });
}

function NewUserDrawer({ onClose }: { onClose: () => void }) {
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
        <Drawer
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
        </Drawer>
    );
}

function RoleModal({ user, onClose }: { user: UserAccount; onClose: () => void }) {
    const invalidate = useInvalidateUsers();
    const [role, setRole] = useState<Role>(user.role);

    const save = useMutation({
        mutationFn: () => request<UserAccount>("PUT", `/users/${user.publicId}`, { role }),
        onSuccess: () => {
            toast.success("Perfil atualizado.");
            invalidate();
            onClose();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });

    return (
        <Modal
            title={`Alterar perfil de ${user.username}`}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Voltar
                    </button>
                    <button
                        type="submit"
                        form="role-form"
                        className="btn btn-primary"
                        disabled={save.isPending || role === user.role}
                    >
                        {save.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        Salvar perfil
                    </button>
                </>
            }
        >
            <form
                id="role-form"
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
            </form>
        </Modal>
    );
}

export default function Users() {
    const me = useMe();
    const invalidate = useInvalidateUsers();
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [creating, setCreating] = useState(false);
    const [changing, setChanging] = useState<UserAccount | null>(null);
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

    const columns: Column<UserAccount>[] = [
        {
            header: "Usuário",
            render: (u) => {
                const note =
                    u.username === me.data?.username
                        ? "Você"
                        : !MANAGED_ROLES.includes(u.role)
                          ? "Gerido pelo próprio cadastro"
                          : null;
                return (
                    <div className="route-cell">
                        <span className="data">{u.username}</span>
                        {note && <span className="caption">{note}</span>}
                    </div>
                );
            },
        },
        {
            header: "Perfil",
            render: (u) => <span className="badge badge-neutral">{ROLE_LABEL[u.role]}</span>,
        },
        {
            header: "Situação",
            render: (u) =>
                u.active ? (
                    <span className="badge badge-success">Ativo</span>
                ) : (
                    <span className="badge badge-offline">Inativo</span>
                ),
        },
        {
            header: "Ações",
            align: "right",
            render: (u) => {
                if (u.username === me.data?.username || !MANAGED_ROLES.includes(u.role)) {
                    return null;
                }
                return (
                    <div className="row-actions">
                        {u.active ? (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    aria-label={`Alterar perfil de ${u.username}`}
                                    onClick={() => setChanging(u)}
                                >
                                    <Pencil size={16} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    aria-label={`Desativar ${u.username}`}
                                    onClick={() => setDeactivating(u)}
                                >
                                    <UserX size={16} aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-label={`Reativar ${u.username}`}
                                onClick={() => setReactivating(u)}
                            >
                                <RotateCcw size={14} aria-hidden="true" />
                                Reativar
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Usuários</h1>
                    <p className="page-sub">
                        Quem acessa a área da equipe e com qual perfil. Motoristas e clientes
                        aparecem aqui só para consulta.
                    </p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                    <Plus size={18} aria-hidden="true" />
                    Novo usuário
                </button>
            </header>

            <DataTable
                columns={columns}
                rows={users.data?.items}
                rowKey={(u) => u.publicId}
                total={users.data?.total ?? 0}
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
                emptyTitle="Nenhum usuário cadastrado"
            />

            {creating && <NewUserDrawer onClose={() => setCreating(false)} />}
            {changing && <RoleModal user={changing} onClose={() => setChanging(null)} />}
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
        </div>
    );
}
