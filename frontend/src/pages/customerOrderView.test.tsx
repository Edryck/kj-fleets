import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderDetail as Order, OrderStatus } from "../api/types";
import OrderDetail from "./OrderDetail";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../api/http", () => ({
    request,
    ApiError: class extends Error {},
}));
vi.mock("../components/MapView", () => ({ default: () => <div>mapa</div> }));
vi.mock("../realtime/useTopic", () => ({ useTopic: () => undefined }));
vi.mock("../auth/session", () => ({ useSession: () => ({ role: "CUSTOMER" }) }));

afterEach(() => {
    cleanup();
    request.mockReset();
});

const place = (name: string) => ({
    publicId: name,
    name,
    address: `Rua ${name}`,
    lat: -24.8,
    lng: -54.3,
    contact: null,
    active: true,
});

const order = (status: OrderStatus): Order => ({
    publicId: "o1",
    trackingNumber: "KJ-0001",
    status,
    customer: { publicId: "c1", name: "Eu" },
    driver: { publicId: "d1", name: "Maria" },
    vehicle: { publicId: "v1", plate: "ABC1D23" },
    pickup: place("Origem"),
    dropoff: place("Destino"),
    waypoints: [],
    items: [],
    podRequired: false,
    podValue: null,
    podAt: null,
    reason: null,
    notes: null,
    meta: null,
    createdAt: "2026-11-10T10:00:00Z",
    dispatchedAt: null,
    finishedAt: null,
});

function mount(status: OrderStatus, etaMinutes: number | null) {
    request.mockImplementation((_method: string, path: string) => {
        if (path === "/orders/o1") return Promise.resolve(order(status));
        if (path === "/orders/o1/tracking") return Promise.resolve([]);
        if (path === "/track/KJ-0001")
            return Promise.resolve({ trackingNumber: "KJ-0001", status, etaMinutes, timeline: [] });
        return Promise.reject(new Error(`chamada inesperada: ${path}`));
    });
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={["/orders/o1"]}>
                <Routes>
                    <Route path="/orders/:id" element={<OrderDetail />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe("pedido na visão do cliente", () => {
    it("não mostra rota, mapa, veículo nem botões da equipe", async () => {
        mount("CREATED", null);
        await screen.findByText("KJ-0001");
        expect(screen.queryByText("mapa")).toBeNull();
        expect(screen.queryByText("Rota")).toBeNull();
        expect(screen.queryByText("ABC1D23")).toBeNull();
        expect(screen.queryByText(/Atribuir|Trocar motorista|Despachar|Falhou/)).toBeNull();
        const paths = request.mock.calls.map((c) => c[1] as string);
        expect(paths.some((p) => p.endsWith("/route") || p.startsWith("/drivers"))).toBe(false);
    });

    it("permite cancelar só enquanto o pedido está criado", async () => {
        mount("CREATED", null);
        expect(await screen.findByRole("button", { name: /Cancelar pedido/ })).toBeTruthy();
        cleanup();
        mount("DISPATCHED", null);
        await screen.findByText("KJ-0001");
        expect(screen.queryByRole("button", { name: /Cancelar/ })).toBeNull();
    });

    it("mostra a previsão só com o motorista em movimento", async () => {
        mount("IN_PROGRESS", 12);
        expect(await screen.findByText("12min")).toBeTruthy();
        cleanup();
        mount("CREATED", 12);
        await screen.findByText("KJ-0001");
        await waitFor(() => expect(request).toHaveBeenCalled());
        expect(screen.queryByText("12min")).toBeNull();
    });
});
