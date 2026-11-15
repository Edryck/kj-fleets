import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraphStatus } from "../api/types";
import RoadGraph from "./RoadGraph";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../api/http")>()),
    request: mockRequest,
}));
vi.mock("../components/MapView", () => ({ default: () => <div>mapa</div> }));

afterEach(cleanup);

const base: GraphStatus = {
    mode: "ROAD",
    loaded: false,
    region: null,
    osmFile: null,
    nodes: 0,
    edges: 0,
    importedAt: null,
    loadMillis: 0,
    reason: null,
};

const show = (status: GraphStatus) => {
    mockRequest.mockResolvedValue(status);
    render(
        <QueryClientProvider client={new QueryClient()}>
            <RoadGraph />
        </QueryClientProvider>,
    );
};

describe("mapa viário", () => {
    it("não carregado mostra o motivo e esconde o teste", async () => {
        show({ ...base, reason: "arquivo OSM não encontrado" });
        expect(await screen.findByText(/arquivo OSM não encontrado/)).toBeTruthy();
        expect(screen.getByText("Com erro")).toBeTruthy();
        expect(screen.queryByText("Teste entre dois pontos")).toBeNull();
    });

    it("carregado mostra os números e o teste", async () => {
        show({
            ...base,
            loaded: true,
            region: "Sul do Brasil",
            nodes: 1234567,
            edges: 2345678,
            importedAt: "2026-11-14T12:00:00Z",
            loadMillis: 8000,
        });
        expect(await screen.findByText("Carregado")).toBeTruthy();
        expect(screen.getByText("1.234.567")).toBeTruthy();
        expect(screen.getByText("Teste entre dois pontos")).toBeTruthy();
    });
});
