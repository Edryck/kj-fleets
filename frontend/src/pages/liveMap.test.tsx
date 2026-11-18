import { screen, within } from "@testing-library/react";
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

it("shows the chosen driver's vehicle in the 3/4 view breaking out of the card", async () => {
    renderAt("/map?driver=d1", <LiveMap />, { role: "ADMIN" });
    const card = await screen.findByRole("region", { name: "Motorista escolhido" });
    const shot = within(card).getByAltText("Van KJF1A01");
    expect(shot).toHaveAttribute("src", "/renders/sprinter-34.webp");
    expect(shot.closest(".vehicle-shot")).toHaveClass("motion-drive");
    expect(shot.closest(".live-card-shot")).not.toBeNull();
    expect(card).toHaveClass("has-shot");
});

it("names the vehicle by brand and model in the chosen driver's card", async () => {
    mockRequest.mockImplementation((_method: string, path: string) => {
        if (path === "/drivers")
            return Promise.resolve({
                items: [
                    driver("d1", {
                        vehicle: {
                            publicId: "v1",
                            plate: "KJF1A01",
                            type: "Furgão",
                            brand: "Fiat",
                            model: "Fiorino",
                            color: "Prata",
                        },
                    }),
                ],
                total: 1,
                limit: 100,
                offset: 0,
            });
        return Promise.resolve({ items: [], total: 0, limit: 100, offset: 0 });
    });
    renderAt("/map?driver=d1", <LiveMap />, { role: "ADMIN" });
    const card = await screen.findByRole("region", { name: "Motorista escolhido" });
    expect(within(card).getByAltText("Fiat Fiorino KJF1A01")).toHaveAttribute(
        "src",
        "/renders/fiorino-34.webp",
    );
    expect(within(card).getByText("Fiat Fiorino · Furgão")).toBeInTheDocument();
});

it("keeps the card without a shot when the vehicle type has no render", async () => {
    mockRequest.mockImplementation((_method: string, path: string) => {
        if (path === "/drivers")
            return Promise.resolve({
                items: [
                    driver("d1", {
                        vehicle: { publicId: "v9", plate: "BIK0001", type: "Bicicleta" },
                    }),
                ],
                total: 1,
                limit: 100,
                offset: 0,
            });
        if (path === "/dashboard/fleet/status") return Promise.resolve({ drivers: [] });
        return Promise.resolve({ items: [], total: 0, limit: 1, offset: 0 });
    });
    renderAt("/map?driver=d1", <LiveMap />, { role: "ADMIN" });
    const card = await screen.findByRole("region", { name: "Motorista escolhido" });
    expect(within(card).queryByRole("img")).toBeNull();
    expect(card).not.toHaveClass("has-shot");
});

it("puts the list and the chosen driver in a glass sheet with tabs on phones", async () => {
    vi.stubGlobal("innerWidth", 390);
    try {
        const user = (await import("@testing-library/user-event")).default;
        renderAt("/map", <LiveMap />, { role: "ADMIN" });
        const sheet = await screen.findByRole("region", { name: "Motoristas" });
        expect(sheet).toHaveClass("bottom-sheet");
        expect(sheet).toHaveClass("glass");
        expect(within(sheet).getByRole("tab", { name: "Lista" })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(within(sheet).getByRole("tab", { name: "Detalhe" })).toBeDisabled();
        expect(sheet.querySelectorAll(".glass")).toHaveLength(0);
        await user.click(await within(sheet).findByRole("button", { name: /Marcos Vieira/ }));
        expect(within(sheet).getByRole("tab", { name: "Detalhe" })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(within(sheet).getByRole("heading", { name: "Marcos Vieira" })).toBeInTheDocument();
        expect(within(sheet).queryByRole("region", { name: "Lista de motoristas" })).toBeNull();
    } finally {
        vi.unstubAllGlobals();
    }
});

it("keeps the side column on wide screens", async () => {
    vi.stubGlobal("innerWidth", 1440);
    try {
        renderAt("/map", <LiveMap />, { role: "ADMIN" });
        expect(await screen.findByRole("region", { name: "Lista de motoristas" })).toHaveClass(
            "glass",
        );
        expect(screen.queryByRole("tab")).toBeNull();
    } finally {
        vi.unstubAllGlobals();
    }
});
