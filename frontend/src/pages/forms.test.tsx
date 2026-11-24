import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { clearSession, startSession } from "../auth/session";
import Login from "./Login";
import Register from "./Register";

afterEach(cleanup);

const wrap = (ui: React.ReactNode) =>
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter>{ui}</MemoryRouter>
        </QueryClientProvider>,
    );

describe("validação dos formulários", () => {
    // em dev o StrictMode chama o inicializador do useState duas vezes; o aviso não pode sumir na segunda
    it("login avisa que a sessão expirou mesmo no StrictMode", () => {
        startSession({
            token: "t",
            role: "ADMIN",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
        clearSession("expired");
        wrap(
            <StrictMode>
                <Login />
            </StrictMode>,
        );
        expect(screen.getByText(/Sua sessão expirou/)).toBeTruthy();
    });

    it("login vazio mostra os dois avisos", async () => {
        wrap(<Login />);
        await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
        expect(await screen.findByText("Informe o usuário")).toBeTruthy();
        expect(screen.getByText("Informe a senha")).toBeTruthy();
    });

    it("cadastro valida senha curta, confirmação e e-mail", async () => {
        wrap(<Register />);
        await userEvent.type(screen.getByLabelText("Nome completo"), "Ana");
        await userEvent.type(screen.getByLabelText("Nome de usuário"), "ana");
        await userEvent.type(screen.getByLabelText("Senha"), "123");
        await userEvent.type(screen.getByLabelText("Confirmar senha"), "456");
        await userEvent.type(screen.getByLabelText("E-mail (opcional)"), "x");
        await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
        expect(await screen.findByText("A senha precisa ter pelo menos 8 caracteres")).toBeTruthy();
        expect(screen.getByText("As senhas não coincidem")).toBeTruthy();
        expect(screen.getByText("Informe um e-mail válido")).toBeTruthy();
    });
});
