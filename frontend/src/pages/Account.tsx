import { Loader2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { ChangePasswordRequest } from "../api/types";
import { useMe } from "../auth/session";
import { ErrorState, Skeleton } from "../components/blocks";
import { toast } from "../components/Toasts";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import Avatar from "../patterns/Avatar";
import RoleFigure from "../people/RoleFigure";
import { ROLE_LABEL } from "../routes";

interface Values extends ChangePasswordRequest {
    confirmPassword: string;
}

export default function Account() {
    const me = useMe();
    const {
        register,
        handleSubmit,
        getValues,
        reset,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<Values>();

    const onSubmit = async ({ currentPassword, newPassword }: Values) => {
        try {
            await request<void>("PUT", "/me/password", { currentPassword, newPassword });
            reset();
            toast.success("Senha alterada.");
        } catch (e) {
            const error = e as ApiError;
            if (error.code === "VALIDATION_ERROR" && /atual/i.test(error.message)) {
                setError("currentPassword", { message: "Senha atual incorreta" });
            } else {
                setError("root", { message: messageFor(error.code, error.message) });
            }
        }
    };

    useTitleBlock({ title: "Minha conta" });

    const rows: [string, string | null | undefined, boolean?][] = me.data
        ? [
              ["Usuário", me.data.username, true],
              ["E-mail", me.data.email],
              ["Telefone", me.data.phone],
              ["ID", me.data.publicId, true],
          ]
        : [];

    return (
        <div className="account">
            <Glass
                as="section"
                className="account-card account-who"
                aria-labelledby="account-title"
            >
                {me.isError ? (
                    <ErrorState
                        message={(me.error as ApiError).message || "Tente de novo em instantes."}
                        onRetry={() => me.refetch()}
                    />
                ) : !me.data ? (
                    <div className="stack-sm" aria-busy="true">
                        <Skeleton height={88} />
                        <Skeleton height={20} />
                        <Skeleton height={20} />
                    </div>
                ) : (
                    <>
                        <div className="account-head">
                            <Avatar
                                name={me.data.name ?? me.data.username}
                                role={me.data.role}
                                size="lg"
                                className="avatar-lg"
                            />
                            <div className="account-name">
                                <h2 id="account-title">{me.data.name ?? me.data.username}</h2>
                                <span className="role-pill" data-role={me.data.role}>
                                    {ROLE_LABEL[me.data.role]}
                                </span>
                            </div>
                            <RoleFigure
                                role={me.data.role}
                                name={me.data.name ?? me.data.username}
                                variant="full"
                                className="account-figure"
                            />
                        </div>
                        <h3 className="account-section">Seus dados</h3>
                        <dl className="account-rows">
                            {rows
                                .filter(([, value]) => value)
                                .map(([label, value, mono]) => (
                                    <div key={label}>
                                        <dt>{label}</dt>
                                        <dd className={mono ? "data" : undefined}>{value}</dd>
                                    </div>
                                ))}
                        </dl>
                    </>
                )}
            </Glass>

            <Glass
                as="section"
                className="account-card account-password"
                aria-labelledby="password-title"
                style={{ "--i": 1 } as CSSProperties}
            >
                <h2 id="password-title">Trocar senha</h2>
                <p className="field-help">As sessões já abertas continuam válidas até expirarem.</p>
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <div className="field">
                        <label htmlFor="currentPassword">Senha atual</label>
                        <input
                            id="currentPassword"
                            type="password"
                            autoComplete="current-password"
                            aria-invalid={!!errors.currentPassword}
                            {...register("currentPassword", { required: "Informe a senha atual" })}
                        />
                        {errors.currentPassword && (
                            <p className="field-error">{errors.currentPassword.message}</p>
                        )}
                    </div>
                    <div className="field">
                        <label htmlFor="newPassword">Nova senha</label>
                        <input
                            id="newPassword"
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={!!errors.newPassword}
                            {...register("newPassword", {
                                required: "Informe a nova senha",
                                minLength: {
                                    value: 8,
                                    message: "A senha precisa ter pelo menos 8 caracteres",
                                },
                            })}
                        />
                        <p className="field-help">Mínimo de 8 caracteres.</p>
                        {errors.newPassword && (
                            <p className="field-error">{errors.newPassword.message}</p>
                        )}
                    </div>
                    <div className="field">
                        <label htmlFor="confirmPassword">Confirmar nova senha</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={!!errors.confirmPassword}
                            {...register("confirmPassword", {
                                validate: (v) =>
                                    v === getValues("newPassword") || "As senhas não coincidem",
                            })}
                        />
                        {errors.confirmPassword && (
                            <p className="field-error">{errors.confirmPassword.message}</p>
                        )}
                    </div>
                    {errors.root && (
                        <p className="notice notice-danger" role="alert">
                            {errors.root.message}
                        </p>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 size={16} className="spin" aria-hidden="true" />}
                        Salvar nova senha
                    </button>
                </form>
            </Glass>
        </div>
    );
}
