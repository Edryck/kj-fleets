import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/http";
import { messageFor } from "../api/errors";
import { dismissExpiredNotice, login, peekExpiredNotice, useSession } from "../auth/session";
import Wordmark from "../components/Wordmark";
import Glass from "../glass/Glass";
import StaticMapBackdrop from "../map/StaticMapBackdrop";

interface Values {
    username: string;
    password: string;
}

function safeNext(next: string | null): string {
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default function Login() {
    const session = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();
    const [showPassword, setShowPassword] = useState(false);
    const [expired] = useState(peekExpiredNotice);
    useEffect(dismissExpiredNotice, []);
    const registered = (location.state as { registered?: boolean } | null)?.registered;
    const next = safeNext(params.get("next"));
    const {
        register,
        handleSubmit,
        setError,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<Values>();

    if (session) return <Navigate to={next} replace />;

    const onSubmit = async (values: Values) => {
        try {
            await login(values.username.trim(), values.password);
            navigate(next, { replace: true });
        } catch (e) {
            const error = e as ApiError;
            setError("root", {
                message:
                    error.code === "UNAUTHORIZED"
                        ? "Usuário ou senha inválidos"
                        : messageFor(error.code, error.message),
            });
        }
    };

    return (
        <div className="auth">
            <StaticMapBackdrop />
            <main className="auth-main">
                <Glass as="section" className="auth-card" aria-labelledby="auth-title">
                    <div className="auth-brand">
                        <Wordmark size="lg" />
                        <p className="auth-tagline">Soluções em frota e logística</p>
                    </div>
                    <h1 id="auth-title">Acesse sua conta</h1>
                    <p className="auth-lead">Entre para acompanhar operações e pedidos.</p>
                    {registered && (
                        <p className="notice notice-success" role="status">
                            Conta criada. Entre para continuar.
                        </p>
                    )}
                    {expired && (
                        <p className="notice notice-warning" role="status">
                            Sua sessão expirou. Entre novamente para continuar.
                        </p>
                    )}
                    <form onSubmit={handleSubmit(onSubmit)} noValidate>
                        <div className="field">
                            <label htmlFor="username">Usuário</label>
                            <input
                                id="username"
                                autoComplete="username"
                                aria-invalid={!!errors.username}
                                {...register("username", { required: "Informe o usuário" })}
                            />
                            {errors.username && (
                                <p className="field-error">{errors.username.message}</p>
                            )}
                        </div>
                        <div className="field">
                            <label htmlFor="password">Senha</label>
                            <div className="input-affix">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    aria-invalid={!!errors.password}
                                    {...register("password", { required: "Informe a senha" })}
                                />
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => setShowPassword((s) => !s)}
                                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} aria-hidden="true" />
                                    ) : (
                                        <Eye size={18} aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="field-error">{errors.password.message}</p>
                            )}
                        </div>
                        {errors.root && (
                            <p className="notice notice-danger" role="alert">
                                {errors.root.message}
                            </p>
                        )}
                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && (
                                <Loader2 size={16} className="spin" aria-hidden="true" />
                            )}
                            Entrar
                        </button>
                    </form>
                    <DevLogins
                        onPick={(u, p) => {
                            setValue("username", u);
                            setValue("password", p);
                        }}
                    />
                    <p className="auth-links">
                        <Link to="/register">Criar conta</Link>
                        <Link to="/track">Rastrear pedido</Link>
                    </p>
                </Glass>
            </main>
        </div>
    );
}

type DevLogin = { label: string; username: string; password: string };

function DevLogins({ onPick }: { onPick: (username: string, password: string) => void }) {
    if (!import.meta.env.DEV) return null;
    let logins: DevLogin[] = [];
    try {
        logins = JSON.parse(import.meta.env.VITE_DEV_LOGINS ?? "[]") as DevLogin[];
    } catch {
        return null;
    }
    if (logins.length === 0) return null;
    return (
        <div className="dev-logins" aria-label="Logins de teste">
            <p className="dev-logins-title">Logins de teste (só em desenvolvimento)</p>
            <div className="dev-logins-list">
                {logins.map((l) => (
                    <button
                        key={l.username}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onPick(l.username, l.password)}
                    >
                        {l.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
