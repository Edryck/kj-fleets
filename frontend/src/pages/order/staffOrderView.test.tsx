import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Driver, OrderDetail, OrderRoute, TrackingEntry, Vehicle } from "../../api/types";
import { getFollowState, setFollowState } from "../../map/sceneStore";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { lastScene, resetScenes } from "../../test/sceneMock";
import OrderDetailPage from "../OrderDetail";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request,
}));
vi.mock("../../map/useMapScene", () => import("../../test/sceneMock"));
vi.mock("../../realtime/useTopic", () => ({
    useTopic: () => {},
    useTopics: () => {},
    useConnectionState: () => "connected",
}));

const place = (publicId: string, name: string, lat: number, lng: number) => ({
    publicId,
    name,
    address: `${name}, Paraná`,
    lat,
    lng,
    contact: null,
    active: true,
});

const baseOrder: OrderDetail = {
    publicId: "o1",
    trackingNumber: "KJ7Q2M9XAB",
    status: "IN_PROGRESS",
    customer: { publicId: "c1", name: "Mercado Bom Preço" },
    driver: { publicId: "d1", name: "Marcos Vieira" },
    vehicle: { publicId: "v1", plate: "BRA2E19" },
    pickup: place("p1", "Santa Helena", -24.86, -54.33),
    dropoff: place("p3", "Medianeira", -25.29, -54.09),
    waypoints: [place("p2", "Bom Preço", -24.95, -54.2)],
    items: [{ name: "Caixas de laticínios", quantity: 24 }],
    podRequired: true,
    podValue: null,
    podAt: null,
    reason: null,
    notes: "Entregar pela doca 2.",
    meta: null,
    createdAt: "2026-11-16T12:10:00Z",
    dispatchedAt: "2026-11-16T12:36:00Z",
    finishedAt: null,
};

const route: OrderRoute = {
    orderId: "o1",
    algorithm: "TWO_OPT",
    mode: "ROAD",
    totalKm: 65.1,
    baselineKm: 71.2,
    savingsPct: 8.6,
    etaMinutes: 96,
    computedAt: "2026-11-16T12:36:00Z",
    fallbackLegs: 0,
    stops: [
        {
            seq: 1,
            type: "PICKUP",
            placeId: "p1",
            name: "Santa Helena",
            lat: -24.86,
            lng: -54.33,
            legKm: null,
            visitedAt: "2026-11-16T12:58:00Z",
            distanceM: 12,
            distanceSource: "ROAD",
            path: null,
        },
        {
            seq: 2,
            type: "WAYPOINT",
            placeId: "p2",
            name: "Bom Preço",
            lat: -24.95,
            lng: -54.2,
            legKm: 18.4,
            visitedAt: null,
            distanceM: null,
            distanceSource: "ROAD",
            path: [
                [-24.86, -54.33],
                [-24.9, -54.26],
                [-24.95, -54.2],
            ],
        },
        {
            seq: 3,
            type: "DROPOFF",
            placeId: "p3",
            name: "Medianeira",
            lat: -25.29,
            lng: -54.09,
            legKm: 46.7,
            visitedAt: null,
            distanceM: null,
            distanceSource: "ROAD",
            path: [
                [-24.95, -54.2],
                [-25.1, -54.15],
                [-25.29, -54.09],
            ],
        },
    ],
};

const driver: Driver = {
    publicId: "d1",
    username: "marcos",
    name: "Marcos Vieira",
    phone: null,
    licenseNumber: null,
    status: "BUSY",
    lat: -24.9,
    lng: -54.26,
    lastSeenAt: new Date().toISOString(),
    fleets: [],
    vehicle: { publicId: "v1", plate: "BRA2E19", type: "Van" },
    active: true,
};

const vehicle: Vehicle = {
    publicId: "v1",
    plate: "BRA2E19",
    type: "Van",
    status: "IN_USE",
    driverId: "d1",
    driverName: "Marcos Vieira",
    active: true,
};

const tracking: TrackingEntry[] = [
    {
        code: "created",
        status: "CREATED",
        details: null,
        lat: null,
        lng: null,
        at: "2026-11-16T12:10:00Z",
    },
    {
        code: "dispatched",
        status: "DISPATCHED",
        details: null,
        lat: null,
        lng: null,
        at: "2026-11-16T12:36:00Z",
    },
];

let order: OrderDetail = baseOrder;
const mockOrder = (changes: Partial<OrderDetail>) => {
    order = { ...baseOrder, ...changes };
};

beforeEach(() => {
    setReducedMotion(true);
    resetScenes();
    setFollowState("following");
    order = baseOrder;
    request.mockReset();
    request.mockImplementation((_method: string, path: string) => {
        if (path === "/orders/o1") return Promise.resolve(order);
        if (path === "/orders/o1/route") return Promise.resolve(route);
        if (path === "/orders/o1/tracking") return Promise.resolve(tracking);
        if (path === "/drivers/d1") return Promise.resolve(driver);
        if (path === "/vehicles/v1") return Promise.resolve(vehicle);
        return Promise.reject(new Error(`unexpected ${path}`));
    });
});

const renderDetail = () =>
    renderAt(
        "/orders/o1",
        <Routes>
            <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>,
        { role: "DISPATCHER" },
    );

describe("StaffOrderView", () => {
    it("loads the vehicle to show its render, type and status", async () => {
        renderDetail();
        expect(await screen.findByAltText("Van BRA2E19")).toBeInTheDocument();
        expect(request).toHaveBeenCalledWith("GET", "/vehicles/v1");
    });

    it("follows the vehicle and offers 'Seguir veículo' after a gesture", async () => {
        renderDetail();
        await waitFor(() =>
            expect(lastScene().camera?.follow).toEqual({
                markerId: "vehicle",
                zoom: 15.4,
                pitch: 68,
            }),
        );
        expect(screen.queryByRole("button", { name: "Seguir veículo" })).toBeNull();
        act(() => setFollowState("suspended"));
        await userEvent.click(await screen.findByRole("button", { name: "Seguir veículo" }));
        expect(getFollowState()).toBe("following");
    });

    it("keeps following in the scene while the engine suspends it", async () => {
        renderDetail();
        await waitFor(() => expect(lastScene().camera?.follow).not.toBeNull());
        act(() => setFollowState("suspended"));
        await screen.findByRole("button", { name: "Seguir veículo" });
        expect(lastScene().camera?.follow).toEqual({ markerId: "vehicle", zoom: 15.4, pitch: 68 });
    });

    it("shows the empty vehicle card without a vehicle", async () => {
        mockOrder({ vehicle: null });
        renderDetail();
        expect(await screen.findByText("Sem veículo atribuído")).toBeInTheDocument();
        expect(request).not.toHaveBeenCalledWith("GET", expect.stringMatching(/^\/vehicles\//));
    });

    it("keeps the cargo, timeline and customer tabs", async () => {
        renderDetail();
        for (const name of ["Carga", "Linha do tempo", "Cliente"])
            expect(await screen.findByRole("tab", { name })).toBeInTheDocument();
        expect(screen.getByText("Caixas de laticínios")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("tab", { name: "Linha do tempo" }));
        expect(within(screen.getByRole("tabpanel")).getByText("Pedido criado")).toBeInTheDocument();
    });

    it("lists the stops with the next one highlighted and completes a waypoint", async () => {
        renderDetail();
        const stops = await screen.findByRole("list", { name: "Paradas" });
        expect(within(stops).getByText("Próxima · 18,4 km")).toBeInTheDocument();
        request.mockImplementationOnce(() => Promise.resolve({}));
        await userEvent.click(within(stops).getByRole("button", { name: "Concluir parada 1" }));
        expect(request).toHaveBeenCalledWith("POST", "/orders/o1/stops/2/complete", {});
    });

    it("shows the route strip with the ETA and the savings", async () => {
        renderDetail();
        const strip = await screen.findByRole("region", { name: "Rota" });
        expect(within(strip).getByText("96")).toBeInTheDocument();
        expect(within(strip).getByText("8,6%")).toBeInTheDocument();
        expect(within(strip).getByRole("button", { name: /Recalcular/ })).toBeInTheDocument();
    });
});
