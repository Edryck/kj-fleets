import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/http";
import type { FleetPanel, FleetStatus } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { currentPath, renderAt } from "../../test/render";
import { lastScene, resetScenes } from "../../test/sceneMock";
import { WithTitleBlock } from "../../test/titleBlock";
import FleetDashboard from "../FleetDashboard";
import { driverRow, meta } from "./fixtures";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));
vi.mock("../../map/useMapScene", () => import("../../test/sceneMock"));
vi.mock("../../realtime/useTopic", () => ({
    useTopic: () => {},
    useConnectionState: () => "connected",
}));

const status = (extra: Partial<FleetStatus> = {}): FleetStatus => ({
    meta,
    driversByStatus: { AVAILABLE: 6, BUSY: 4, OFFLINE: 4 },
    vehiclesByStatus: { AVAILABLE: 7, IN_USE: 4, MAINTENANCE: 1 },
    waitingOrders: 9,
    availableDrivers: 5,
    drivers: [
        driverRow("d1", { name: "Ana Ribeiro", status: "AVAILABLE" }),
        driverRow("d2", { name: "Tiago Nunes", pingStale: true }),
    ],
    availableDriversList: [],
    ...extra,
});

const panel: FleetPanel = {
    meta,
    fleet: status(),
    alerts: [],
    performance: {
        meta,
        drivers: [
            {
                driverId: "d1",
                name: "Ana Ribeiro",
                completed: 11,
                failed: 1,
                successRate: { rate: 0.917, n: 12 },
                avgDispatchToArrivedMinutes: 14,
                busyPct: 62,
                orders: 12,
            },
        ],
        idleDriverIds: ["d2"],
    },
    sizing: {
        waitingOrders: 9,
        availableDrivers: 5,
        perDay: [
            { day: "2026-11-15", ordersCreated: 30, driversWithDelivery: 8 },
            { day: "2026-11-16", ordersCreated: 20, driversWithDelivery: 7 },
        ],
    },
};

let filtered: () => Promise<FleetStatus>;

beforeEach(() => {
    setReducedMotion(true);
    resetScenes();
    mockRequest.mockReset();
    filtered = () =>
        Promise.resolve(
            status({
                driversByStatus: { AVAILABLE: 2, BUSY: 1 },
                availableDrivers: 2,
                drivers: [driverRow("d1", { name: "Ana Ribeiro", status: "AVAILABLE" })],
            }),
        );
    mockRequest.mockImplementation((_method: string, path: string) => {
        if (path === "/dashboard/fleet") return Promise.resolve(panel);
        if (path === "/fleets")
            return Promise.resolve({
                items: [{ publicId: "f1", name: "Oeste" }],
                total: 1,
                limit: 100,
                offset: 0,
            });
        if (path === "/dashboard/fleet/status") return filtered();
        if (path === "/dashboard/drivers/performance") return Promise.resolve(panel.performance);
        return Promise.reject(new Error(`unexpected ${path}`));
    });
});

const renderDashboard = (path = "/dashboard/fleet") =>
    renderAt(
        path,
        <WithTitleBlock>
            <FleetDashboard />
        </WithTitleBlock>,
        { role: "FLEET_MANAGER" },
    );

describe("FleetDashboard", () => {
    it("leads with available drivers over the fleet total", async () => {
        renderDashboard();
        expect(await screen.findByText("Disponíveis agora")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("de 14 motoristas")).toBeInTheDocument();
    });

    it("reads a fleet from the URL through the filtered endpoints", async () => {
        renderDashboard("/dashboard/fleet?fleetId=f1");
        expect(await screen.findByText("de 3 motoristas")).toBeInTheDocument();
        expect(mockRequest).toHaveBeenCalledWith("GET", "/dashboard/fleet/status", undefined, {
            fleetId: "f1",
        });
    });

    it("writes the chosen fleet to the URL", async () => {
        renderDashboard();
        const select = await screen.findByLabelText("Frota");
        await screen.findByRole("option", { name: "Oeste" });
        fireEvent.change(select, { target: { value: "f1" } });
        expect(currentPath()).toBe("/dashboard/fleet?fleetId=f1");
    });

    it("offers all fleets back when the chosen fleet is gone", async () => {
        filtered = () => Promise.reject(new ApiError(404, "NOT_FOUND", "Frota não encontrada"));
        renderDashboard("/dashboard/fleet?fleetId=gone");
        expect(await screen.findByText(/Essa frota não existe mais/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
        expect(currentPath()).toBe("/dashboard/fleet");
    });

    it("shows a flat performance table and the idle drivers", async () => {
        renderDashboard();
        const table = await screen.findByRole("table", { name: "Desempenho por motorista" });
        expect(within(table).getByRole("link", { name: "Ana Ribeiro" })).toHaveAttribute(
            "href",
            "/drivers/d1",
        );
        expect(within(table).getByText("12")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Tiago Nunes" })).toHaveAttribute(
            "href",
            "/drivers/d2",
        );
    });

    it("maps every driver and sends a click to the live map", async () => {
        renderDashboard();
        await screen.findByText("Disponíveis agora");
        await vi.waitFor(() =>
            expect(lastScene().markers.filter((m) => m.kind === "driver")).toHaveLength(2),
        );
        act(() => lastScene().onMarkerClick?.("d2"));
        expect(currentPath()).toBe("/map?driver=d2");
    });

    it("never renders a row of KPI cards", async () => {
        const { container } = renderDashboard();
        await screen.findByText("Disponíveis agora");
        expect(container.querySelector(".kpi-card, .kpi-row")).toBeNull();
    });
});
