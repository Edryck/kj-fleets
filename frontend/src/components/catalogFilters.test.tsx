import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSessionForTests, startSession } from "../auth/session";
import type { Role } from "../api/types";
import CatalogFilters from "./CatalogFilters";

const login = (role: Role) =>
    startSession({ token: "t", role, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });

const renderFilters = () =>
    render(
        <CatalogFilters
            searchLabel="Buscar motoristas"
            placeholder="Buscar por nome ou usuário"
            onQuery={() => {}}
            statuses={[["AVAILABLE", "Disponível"]]}
            status=""
            onStatus={() => {}}
            includeInactive={false}
            onIncludeInactive={() => {}}
        />,
    );

beforeEach(() => {
    sessionStorage.clear();
    resetSessionForTests();
});

afterEach(cleanup);

describe("filtros de cadastro", () => {
    it("DISPATCHER não tem o toggle de inativos", () => {
        login("DISPATCHER");
        renderFilters();
        expect(screen.queryByRole("checkbox", { name: "Mostrar inativos" })).toBeNull();
    });

    it("ADMIN e FLEET_MANAGER têm o toggle", () => {
        login("ADMIN");
        const { unmount } = renderFilters();
        expect(screen.getByRole("checkbox", { name: "Mostrar inativos" })).toBeTruthy();
        unmount();
        login("FLEET_MANAGER");
        renderFilters();
        expect(screen.getByRole("checkbox", { name: "Mostrar inativos" })).toBeTruthy();
    });

    it("com contagens, o status vira segmento com os totais e a ação fica no fim", async () => {
        login("FLEET_MANAGER");
        const onStatus = vi.fn();
        render(
            <CatalogFilters
                searchLabel="Buscar veículos"
                placeholder="Buscar por placa ou tipo"
                onQuery={() => {}}
                statuses={[
                    ["AVAILABLE", "Disponível"],
                    ["MAINTENANCE", "Manutenção"],
                ]}
                status=""
                onStatus={onStatus}
                includeInactive={false}
                onIncludeInactive={() => {}}
                counts={{ AVAILABLE: 5, MAINTENANCE: undefined }}
                total={12}
                action={<button type="button">Novo veículo</button>}
            />,
        );
        expect(screen.queryByRole("combobox")).toBeNull();
        expect(screen.getByRole("button", { name: "Todos 12" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.getByRole("button", { name: "Manutenção —" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Disponível 5" }));
        expect(onStatus).toHaveBeenCalledWith("AVAILABLE");
        expect(screen.getByRole("button", { name: "Novo veículo" })).toBeInTheDocument();
    });
});
