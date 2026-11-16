import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DispatchPanel } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { currentPath, renderAt } from "../../test/render";
import { lastScene, resetScenes } from "../../test/sceneMock";
import DispatchDashboard from "../DispatchDashboard";
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

const queueItem = (orderId: string, trackingNumber: string) => ({
    orderId,
    trackingNumber,
    pickupName: "CD Toledo",
    dropoffName: "Mercado Central",
    minutesInStage: 12,
});

const panel: DispatchPanel = {
    meta,
    queue: {
        unassigned: { items: [queueItem("o1", "KJ-1001")], total: 6 },
        assignedNotDispatched: { items: [queueItem("o2", "KJ-1002")], total: 2 },
        inProgress: { items: [], total: 3 },
        stale: {
            items: [
                {
                    orderId: "o3",
                    trackingNumber: "KJ-1003",
                    stage: "UNASSIGNED",
                    minutesInStage: 52,
                    limitMin: 20,
                },
            ],
            total: 1,
        },
    },
    availableDrivers: [
        driverRow("d1", { status: "AVAILABLE", name: "Ana Ribeiro" }),
        driverRow("d2", { status: "AVAILABLE", name: "Bianca Alves", pingStale: true }),
    ],
    counts: {
        driversByStatus: { AVAILABLE: 5, BUSY: 6, OFFLINE: 3 },
        vehiclesByStatus: {},
        waitingOrders: 7,
        availableDrivers: 5,
    },
    summary: summary(),
    alerts: [
        {
            type: "STALE_ORDER",
            severity: "MEDIUM",
            message: "Pedido parado",
            subjectType: "ORDER",
            subjectId: "o3",
            since: "2026-11-16T12:10:00Z",
            suggestedAction: "Atribuir motorista",
        },
    ],
};

beforeEach(() => {
    setReducedMotion(true);
    resetScenes();
    mockRequest.mockReset();
    mockRequest.mockImplementation((method: string, path: string) => {
        if (path === "/dashboard/dispatch") return Promise.resolve(panel);
        if (method === "POST" && path === "/orders/o2/dispatch") return Promise.resolve({});
        return Promise.reject(new Error(`unexpected ${path}`));
    });
});

const renderDashboard = () =>
    renderAt("/dashboard/dispatch", <DispatchDashboard />, { role: "DISPATCHER" });

describe("DispatchDashboard", () => {
    it("leads with waiting orders and available drivers", async () => {
        renderDashboard();
        expect(await screen.findByText("Pedidos aguardando")).toBeInTheDocument();
        expect(screen.getByText("7")).toBeInTheDocument();
        expect(screen.getByText("5 motoristas disponíveis")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Abrir despacho/ })).toHaveAttribute(
            "href",
            "/dispatch",
        );
    });

    it("dispatches an assigned order straight from the dock", async () => {
        renderDashboard();
        const row = (await screen.findByText("KJ-1002")).closest("li") as HTMLElement;
        fireEvent.click(within(row).getByRole("button", { name: /Despachar/ }));
        await vi.waitFor(() =>
            expect(mockRequest).toHaveBeenCalledWith("POST", "/orders/o2/dispatch", {}),
        );
    });

    it("lists stale orders against their limit", async () => {
        renderDashboard();
        const link = await screen.findByRole("link", { name: /KJ-1003/ });
        expect(link).toHaveAttribute("href", "/orders/o3");
        expect(link.textContent).toContain("52min");
        expect(link.textContent).toContain("limite 20min");
    });

    it("shows the queue as a dot matrix that links to dispatch", async () => {
        renderDashboard();
        expect(await screen.findByRole("link", { name: /^\d+ Sem motorista$/ })).toHaveAttribute(
            "href",
            "/dispatch",
        );
        expect(screen.getByRole("link", { name: /^\d+ Em andamento$/ })).toHaveAttribute(
            "href",
            "/orders?active=true",
        );
    });

    it("maps the free drivers and sends a click to the live map", async () => {
        renderDashboard();
        await screen.findByText("Pedidos aguardando");
        await vi.waitFor(() => expect(lastScene().markers.some((m) => m.id === "d1")).toBe(true));
        act(() => lastScene().onMarkerClick?.("d1"));
        expect(currentPath()).toBe("/map?driver=d1");
    });

    it("never renders a row of KPI cards", async () => {
        const { container } = renderDashboard();
        await screen.findByText("Pedidos aguardando");
        expect(container.querySelector(".kpi-card, .kpi-row")).toBeNull();
    });
});
