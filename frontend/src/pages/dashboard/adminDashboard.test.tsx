import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminPanel, FleetStatus } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { currentPath, renderAt } from "../../test/render";
import { lastScene, resetScenes } from "../../test/sceneMock";
import Dashboard from "../Dashboard";
import { driverRow, meta, summary } from "./fixtures";

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

const panel: AdminPanel = {
    meta,
    summary: summary({ previous: summary({ successRate: { rate: 0.907, n: 100 } }) }),
    funnel: {
        byStage: {
            UNASSIGNED: 30,
            ASSIGNED: 3,
            DISPATCHED: 2,
            DRIVER_ENROUTE: 5,
            ARRIVED: 1,
            IN_PROGRESS: 4,
        },
        staleByStage: { UNASSIGNED: 6 },
    },
    fleet: {
        driversByStatus: { AVAILABLE: 5, BUSY: 6, OFFLINE: 3 },
        vehiclesByStatus: { AVAILABLE: 6, IN_USE: 4, MAINTENANCE: 2 },
        waitingOrders: 30,
        availableDrivers: 5,
    },
    routing: {
        routes: 96,
        plannedKm: 3412,
        baselineKm: 4018,
        savedKm: 606,
        avgSavingsPct: 15.1,
        byAlgorithm: {},
        batchDispatchPct: { rate: 0.4, n: 10 },
    },
    alertCounts: { STALE_ORDER: 2, DRIVER_NO_SIGNAL: 1 },
};

const fleet = {
    meta,
    driversByStatus: {},
    vehiclesByStatus: {},
    waitingOrders: 0,
    availableDrivers: 0,
    drivers: [driverRow("d1"), driverRow("d2", { name: "Tiago Nunes", pingStale: true })],
    availableDriversList: [],
} as FleetStatus;

beforeEach(() => {
    setReducedMotion(true);
    resetScenes();
    mockRequest.mockReset();
    mockRequest.mockImplementation((_method: string, path: string) => {
        if (path === "/dashboard/admin") return Promise.resolve(panel);
        if (path === "/dashboard/fleet/status") return Promise.resolve(fleet);
        return Promise.reject(new Error(`unexpected ${path}`));
    });
});

const renderDashboard = () => renderAt("/dashboard", <Dashboard />, { role: "ADMIN" });

describe("AdminDashboard", () => {
    it("leads with the success rate as the hero number", async () => {
        renderDashboard();
        expect(await screen.findByText("Taxa de sucesso · Hoje")).toBeInTheDocument();
        expect(screen.getByText("93")).toBeInTheDocument();
        expect(screen.getByText("120 pedidos finalizados")).toBeInTheDocument();
    });

    it("compares the success rate in percentage points", async () => {
        renderDashboard();
        expect(await screen.findByText("+2,3 p.p.")).toBeInTheDocument();
    });

    it("splits cancellations by origin and shows the POD denominator", async () => {
        renderDashboard();
        expect(await screen.findByText(/4 pelo cliente · 2 pela equipe/)).toBeInTheDocument();
        expect(screen.getByText(/Prova de entrega · 98/)).toBeInTheDocument();
    });

    it("scales the funnel dot matrix and links each stage", async () => {
        renderDashboard();
        expect(await screen.findByText("1 ponto = 3 pedidos")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Sem motorista/ })).toHaveAttribute(
            "href",
            "/dispatch",
        );
    });

    it("sends a clicked driver to the live map", async () => {
        renderDashboard();
        await screen.findByText("93");
        act(() => lastScene().onMarkerClick?.("d1"));
        expect(currentPath()).toBe("/map?driver=d1");
    });

    it("never renders a row of KPI cards", async () => {
        const { container } = renderDashboard();
        await screen.findByText("93");
        expect(container.querySelector(".kpi-grid, .kpi-card")).toBeNull();
    });
});
