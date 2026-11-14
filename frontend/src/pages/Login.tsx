import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/http";
import { messageFor } from "../api/errors";
import { consumeExpiredNotice, login, useSession } from "../auth/session";
import Wordmark from "../components/Wordmark";

interface Values {
    username: string;
    password: string;
}

// next só vale como caminho interno; "//host" abriria redirecionamento externo
function safeNext(next: string | null): string {
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function AuthBrandPanel() {
    return (
        <div className="brand-panel" aria-hidden="true">
            <svg className="brand-route" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
                <path d="M-20 620 C 120 560, 160 420, 300 440 S 480 300, 640 180" />
                <path d="M-20 700 C 140 650, 200 520, 340 540 S 500 420, 640 300" />
                <path d="M-20 780 C 160 740, 240 620, 380 640 S 520 540, 640 420" />
            </svg>
            <div className="brand-copy">
                <Wordmark size="lg" />
                <p className="brand-tagline">Soluções em frota e logística</p>
            </div>
        </div>
    );
}

export default function Login() {
    const session = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();
    const [showPassword, setShowPassword] = useState(false);
    const [expired] = useState(consumeExpiredNotice);
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
        <div className="auth-split">
            <AuthBrandPanel />
            <section className="auth-form-side">
                <div className="auth-form">
                    <div className="auth-mobile-brand">
                        <Wordmark />
                    </div>
                    <h1>Acesse sua conta</h1>
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
                </div>
            </section>
        </div>
    );
}

type DevLogin = { label: string; username: string; password: string };

// atalho só de desenvolvimento: lê os logins de frontend/.env.local (fora do Git) e some no build
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
