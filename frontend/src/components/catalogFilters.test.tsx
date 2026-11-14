import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});
