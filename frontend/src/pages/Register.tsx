import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { RegisterRequest, RegisterResponse } from "../api/types";
import Wordmark from "../components/Wordmark";
import Glass from "../glass/Glass";
import StaticMapBackdrop from "../map/StaticMapBackdrop";

interface Values extends RegisterRequest {
    confirmPassword: string;
}

export default function Register() {
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        getValues,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<Values>();

    const onSubmit = async (values: Values) => {
        const body: RegisterRequest = {
            password: values.password,
            username: values.username.trim(),
            name: values.name.trim(),
            phone: values.phone?.trim() || undefined,
            email: values.email?.trim() || undefined,
        };
        try {
            await request<RegisterResponse>("POST", "/auth/register", body);
            navigate("/login", { replace: true, state: { registered: true } });
        } catch (e) {
            const error = e as ApiError;
            if (error.code === "USERNAME_TAKEN")
                setError("username", { message: messageFor(error.code, error.message) });
            else setError("root", { message: messageFor(error.code, error.message) });
        }
    };

    return (
        <div className="auth">
            <StaticMapBackdrop />
            <main className="auth-main">
                <Glass as="section" className="auth-card" aria-labelledby="auth-title">
                    <div className="auth-brand">
                        <Wordmark size="lg" />
                    </div>
                    <h1 id="auth-title">Criar conta de cliente</h1>
                    <p className="auth-lead">
                        Cadastro para quem faz pedidos de entrega. Equipe e motoristas recebem o
                        acesso de um administrador.
                    </p>
                    <form onSubmit={handleSubmit(onSubmit)} noValidate>
                        <div className="field">
                            <label htmlFor="name">Nome completo</label>
                            <input
                                id="name"
                                autoComplete="name"
                                aria-invalid={!!errors.name}
                                {...register("name", { required: "Informe seu nome" })}
                            />
                            {errors.name && <p className="field-error">{errors.name.message}</p>}
                        </div>
                        <div className="field">
                            <label htmlFor="username">Nome de usuário</label>
                            <input
                                id="username"
                                autoComplete="username"
                                aria-invalid={!!errors.username}
                                {...register("username", { required: "Informe o nome de usuário" })}
                            />
                            {errors.username && (
                                <p className="field-error">{errors.username.message}</p>
                            )}
                        </div>
                        <div className="field">
                            <label htmlFor="password">Senha</label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="new-password"
                                aria-invalid={!!errors.password}
                                {...register("password", {
                                    required: "Informe a senha",
                                    minLength: {
                                        value: 8,
                                        message: "A senha precisa ter pelo menos 8 caracteres",
                                    },
                                })}
                            />
                            <p className="field-help">Mínimo de 8 caracteres.</p>
                            {errors.password && (
                                <p className="field-error">{errors.password.message}</p>
                            )}
                        </div>
                        <div className="field">
                            <label htmlFor="confirmPassword">Confirmar senha</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                aria-invalid={!!errors.confirmPassword}
                                {...register("confirmPassword", {
                                    validate: (v) =>
                                        v === getValues("password") || "As senhas não coincidem",
                                })}
                            />
                            {errors.confirmPassword && (
                                <p className="field-error">{errors.confirmPassword.message}</p>
                            )}
                        </div>
                        <div className="field">
                            <label htmlFor="phone">Telefone (opcional)</label>
                            <input
                                id="phone"
                                type="tel"
                                autoComplete="tel"
                                {...register("phone")}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="email">E-mail (opcional)</label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                aria-invalid={!!errors.email}
                                {...register("email", {
                                    pattern: {
                                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                        message: "Informe um e-mail válido",
                                    },
                                })}
                            />
                            {errors.email && <p className="field-error">{errors.email.message}</p>}
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
                            Criar conta
                        </button>
                    </form>
                    <p className="auth-links">
                        <Link to="/login">Já tenho conta</Link>
                        <Link to="/track">Rastrear pedido</Link>
                    </p>
                </Glass>
            </main>
        </div>
    );
}
