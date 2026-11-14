import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

const rowOf = async (username: string) => {
    const cell = await screen.findByText(username);
    return cell.closest("tr") as HTMLElement;
};

describe("tabela de usuários", () => {
    it("a própria linha não tem rebaixar nem desativar", async () => {
        renderPage();
        await waitFor(() =>
            expect(mockRequest).toHaveBeenCalledWith("GET", "/users", undefined, expect.anything()),
        );
        const row = await rowOf("admin");
        expect(within(row).queryByRole("button", { name: /perfil/i })).toBeNull();
        expect(within(row).queryByRole("button", { name: /desativar/i })).toBeNull();
    });

    it("CUSTOMER e DRIVER não têm edição de perfil nem desativação", async () => {
        renderPage();
        for (const username of ["cliente", "motorista"]) {
            const row = await rowOf(username);
            expect(within(row).queryByRole("button")).toBeNull();
        }
    });

    it("outro usuário da equipe pode ter o perfil alterado e ser desativado", async () => {
        renderPage();
        const row = await rowOf("ana");
        expect(within(row).getByRole("button", { name: /alterar perfil de ana/i })).toBeTruthy();
        expect(within(row).getByRole("button", { name: /desativar ana/i })).toBeTruthy();
    });
});
