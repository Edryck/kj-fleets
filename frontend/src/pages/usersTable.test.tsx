import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Me, Page, UserAccount } from "../api/types";
import { resetSessionForTests, startSession } from "../auth/session";
import Users from "./Users";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../api/http")>()),
    request: mockRequest,
}));

const users: UserAccount[] = [
    { publicId: "u-1", username: "admin", role: "ADMIN", active: true },
    { publicId: "u-2", username: "ana", role: "DISPATCHER", active: true },
    { publicId: "u-3", username: "cliente", role: "CUSTOMER", active: true },
    { publicId: "u-4", username: "motorista", role: "DRIVER", active: true },
];

const page: Page<UserAccount> = { items: users, total: users.length, limit: 20, offset: 0 };
const me: Me = {
    publicId: null,
    username: "admin",
    role: "ADMIN",
    name: null,
    email: null,
    phone: null,
};

beforeEach(() => {
    sessionStorage.clear();
    resetSessionForTests();
    startSession({
        token: "t",
        role: "ADMIN",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    mockRequest.mockImplementation(async (_method: string, path: string) => {
        if (path === "/me") return me;
        if (path === "/users") return page;
        throw new Error(`rota inesperada: ${path}`);
    });
});

afterEach(cleanup);

const renderPage = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <Users />
        </QueryClientProvider>,
    );

const panelOf = async (username: string) => {
    await userEvent.click(await screen.findByText(username));
    return screen.getByRole("dialog", { name: username });
};

describe("tabela de usuários", () => {
    it("o próprio painel não tem rebaixar nem desativar", async () => {
        renderPage();
        await waitFor(() =>
            expect(mockRequest).toHaveBeenCalledWith("GET", "/users", undefined, expect.anything()),
        );
        await screen.findByText("Você");
        const panel = await panelOf("admin");
        expect(within(panel).queryByLabelText("Perfil")).toBeNull();
        expect(within(panel).queryByRole("button", { name: /desativar/i })).toBeNull();
    });

    it("CUSTOMER e DRIVER não têm edição de perfil nem desativação", async () => {
        renderPage();
        for (const username of ["cliente", "motorista"]) {
            const panel = await panelOf(username);
            expect(within(panel).queryByLabelText("Perfil")).toBeNull();
            expect(within(panel).queryByRole("button", { name: /desativar|reativar/i })).toBeNull();
            await userEvent.click(within(panel).getByRole("button", { name: /fechar/i }));
        }
    });

    it("outro usuário da equipe pode ter o perfil alterado e ser desativado", async () => {
        renderPage();
        const panel = await panelOf("ana");
        expect(within(panel).getByLabelText("Perfil")).toBeTruthy();
        expect(within(panel).getByRole("button", { name: /desativar ana/i })).toBeTruthy();
    });
});
