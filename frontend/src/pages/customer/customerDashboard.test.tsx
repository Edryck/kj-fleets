import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerPanel } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { lastSceneOrNull, resetScenes } from "../../test/sceneMock";
import CustomerDashboard from "../CustomerDashboard";
import { meta, summary } from "../dashboard/fixtures";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));
vi.mock("../../map/useMapScene", () => import("../../test/sceneMock"));
vi.mock("../../realtime/useTopic", () => ({
    useTopic: () => {},
    useTopics: () => {},
    useConnectionState: () => "connected",
}));

const PANEL: CustomerPanel = {
    meta,
    active: [
        {
            orderId: "ord-1",
            trackingNumber: "KJ7Q2M9XAB",
            status: "DRIVER_ENROUTE",
            etaMinutes: 38,
            stopsDone: 1,
            stopsTotal: 3,
            cancellable: false,
            driverName: "Marcos Vieira",
        },
        {
            orderId: "ord-2",
            trackingNumber: "KJ4H8N1PQR",
            status: "CREATED",
            etaMinutes: null,
            stopsDone: 0,
            stopsTotal: 2,
            cancellable: true,
            driverName: null,
        },
    ],
    attention: [
        {
            orderId: "ord-3",
            trackingNumber: "KJ9C3V5LMN",
            kind: "STALE",
            reason: null,
            minutesInStage: 47,
        },
    ],
    summary: summary({
        created: 9,
        completed: 6,
        failed: 1,
        cancelled: 0,
        successRate: { rate: 0.75, n: 8 },
        avgWaitMinutes: 14,
        avgCycleMinutes: 52,
    }),
    recentDelivered: [
        {
            orderId: "ord-4",
            trackingNumber: "KJ1D6F7GHT",
            finishedAt: "2026-11-16T15:10:00Z",
            hasPod: true,
        },
    ],
};

beforeEach(() => {
    setReducedMotion(true);
    resetScenes();
    mockRequest.mockReset();
    mockRequest.mockResolvedValue(PANEL);
});

const show = () => renderAt("/dashboard", <CustomerDashboard />, { role: "CUSTOMER" });

describe("customer dashboard", () => {
    it("leads with the number of active deliveries", async () => {
        show();
        expect(await screen.findByText("Em andamento")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders editorial cards with ETA, stop progress and driver name only", async () => {
        show();
        const card = (await screen.findByText("KJ7Q2M9XAB")).closest("article")!;
        expect(within(card).getByText("38")).toBeInTheDocument();
        expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
        expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuemax", "3");
        expect(within(card).getByText("Marcos Vieira")).toBeInTheDocument();
        expect(within(card).queryByText(/km|placa|BRA2E19/i)).toBeNull();
    });

    it("offers cancel only on cancellable orders", async () => {
        show();
        await screen.findByText("KJ7Q2M9XAB");
        expect(screen.getAllByRole("button", { name: "Cancelar pedido" })).toHaveLength(1);
    });

    it("never publishes a map scene", async () => {
        show();
        await screen.findByText("KJ7Q2M9XAB");
        expect(lastSceneOrNull()).toBeNull();
    });

    it("lists what needs attention and the recent deliveries with proof", async () => {
        show();
        const attention = await screen.findByRole("region", { name: "Precisa de atenção" });
        expect(within(attention).getByText("KJ9C3V5LMN")).toBeInTheDocument();
        expect(within(attention).getByText(/Parado há 47min/)).toBeInTheDocument();
        const delivered = screen.getByRole("region", { name: "Entregues recentemente" });
        expect(within(delivered).getByText("KJ1D6F7GHT")).toBeInTheDocument();
        expect(within(delivered).getByText("Com comprovante")).toBeInTheDocument();
    });

    it("reads the reduced summary for the period", async () => {
        show();
        const summaryRegion = await screen.findByRole("region", { name: "Resumo do período" });
        expect(within(summaryRegion).getByText("Pedidos feitos")).toBeInTheDocument();
        expect(within(summaryRegion).getByText("9")).toBeInTheDocument();
    });
});
