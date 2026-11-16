import { screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Driver } from "../api/types";
import { renderAt } from "../test/render";
import { lastScene, resetScenes } from "../test/sceneMock";
import LiveMap from "./LiveMap";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../api/http")>()),
    request: mockRequest,
}));
vi.mock("../map/useMapScene", () => import("../test/sceneMock"));
vi.mock("../realtime/useTopic", () => ({
    useTopic: () => {},
    useConnectionState: () => "connected",
}));

const driver = (id: string, extra: Partial<Driver> = {}): Driver => ({
    publicId: id,
    username: id,
    name: "Marcos Vieira",
    phone: null,
    licenseNumber: null,
    status: "BUSY",
    lat: -24.865,
    lng: -54.331,
    lastSeenAt: null,
    fleets: [],
    vehicle: { publicId: "v1", plate: "KJF1A01", type: "Van" },
    active: true,
    ...extra,
});

beforeEach(() => {
    resetScenes();
    mockRequest.mockImplementation((_method: string, path: string) => {
        if (path === "/drivers")
            return Promise.resolve({
                items: [
                    driver("d1"),
                    driver("d2", {
                        name: "Felipe Moraes",
                        lat: null,
                        lng: null,
                        status: "OFFLINE",
                    }),
                ],
                total: 2,
                limit: 100,
                offset: 0,
            });
        if (path === "/dashboard/fleet/status")
            return Promise.resolve({ drivers: [{ driverId: "d1", pingStale: false }] });
        if (path === "/orders")
            return Promise.resolve({ items: [], total: 0, limit: 1, offset: 0 });
        return Promise.reject(new Error(`unexpected ${path}`));
    });
});

afterEach(() => vi.clearAllMocks());

it("preselects the driver from the URL and publishes it as selected", async () => {
    renderAt("/map?driver=d1", <LiveMap />, { role: "ADMIN" });
    expect(await screen.findByRole("heading", { name: "Marcos Vieira" })).toBeInTheDocument();
    const scene = lastScene();
    expect(scene.markers.find((m) => m.id === "d1")?.selected).toBe(true);
});

it("shows 'Sem posição' for drivers without coordinates", async () => {
    renderAt("/map", <LiveMap />, { role: "ADMIN" });
    expect(await screen.findByText("Sem posição")).toBeInTheDocument();
});
