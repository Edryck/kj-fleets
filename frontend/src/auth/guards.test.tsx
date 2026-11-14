import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Sidebar from "../layout/Sidebar";
import { RequireAuth, RequireRole } from "./guards";
import { resetSessionForTests, startSession } from "./session";
import type { Role } from "../api/types";

const login = (role: Role) =>
    startSession({ token: "t", role, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/login" element={<p>tela de login</p>} />
                <Route element={<RequireAuth />}>
                    <Route element={<RequireRole roles={["ADMIN", "DISPATCHER"]} />}>
                        <Route path="/dispatch" element={<p>despacho</p>} />
                    </Route>
                </Route>
            </Routes>
        </MemoryRouter>,
    );
}

afterEach(cleanup);

beforeEach(() => {
    sessionStorage.clear();
    resetSessionForTests();
});

describe("guards", () => {
    it("CUSTOMER em /dispatch vê a página 403", () => {
        login("CUSTOMER");
        renderAt("/dispatch");
        expect(screen.getByText("Você não tem acesso a esta página")).toBeTruthy();
        expect(screen.queryByText("despacho")).toBeNull();
    });

    it("sem token redireciona para /login?next=", () => {
        let location = "";
        render(
            <MemoryRouter initialEntries={["/dispatch"]}>
                <Routes>
                    <Route path="/login" element={<Where onRender={(l) => (location = l)} />} />
                    <Route element={<RequireAuth />}>
                        <Route path="/dispatch" element={<p>despacho</p>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );
        expect(location).toBe("?next=%2Fdispatch");
    });

    it("DISPATCHER acessa /dispatch", () => {
        login("DISPATCHER");
        renderAt("/dispatch");
        expect(screen.getByText("despacho")).toBeTruthy();
    });
});

function Where({ onRender }: { onRender: (search: string) => void }) {
    onRender(useLocation().search);
    return null;
}

describe("sidebar", () => {
    const itemsFor = (role: Role) => {
        login(role);
        render(
            <MemoryRouter>
                <Sidebar collapsed={false} onToggle={() => {}} />
            </MemoryRouter>,
        );
        return screen.queryAllByRole("link").map((a) => a.textContent);
    };

    it("DISPATCHER não vê Usuários", () => {
        const items = itemsFor("DISPATCHER");
        expect(items).toContain("Despacho");
        expect(items).not.toContain("Usuários");
    });

    it("CUSTOMER só vê navegação do cliente e sem grupos vazios", () => {
        const items = itemsFor("CUSTOMER");
        expect(items).toEqual(
            expect.arrayContaining([
                "Dashboard",
                "Pedidos",
                "Novo pedido",
                "Tendência anual",
                "Meus endereços",
            ]),
        );
        expect(items).not.toContain("Despacho");
        expect(screen.queryByText("Administração")).toBeNull();
    });
});
