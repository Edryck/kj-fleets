import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OptimizeResponse } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { lastScene, resetScenes } from "../../test/sceneMock";
import { WithTitleBlock } from "../../test/titleBlock";
import RouteLab from "../RouteLab";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));
vi.mock("../../map/useMapScene", () => import("../../test/sceneMock"));

const optimized = (extra: Partial<OptimizeResponse> = {}): OptimizeResponse => ({
    algorithm: "TWO_OPT",
    totalKm: 42.1,
    baselineKm: 51.8,
    savingsPct: 18.7,
    etaMinutes: 64,
    comparison: null,
    fallbackLegs: 0,
    stops: [
        {
            seq: 0,
            type: "PICKUP",
            lat: -24.86,
            lng: -54.33,
            legKm: 0,
            waypointIndex: null,
            distanceSource: null,
            path: null,
        },
        {
            seq: 1,
            type: "DROPOFF",
            lat: -25.09,
            lng: -54.24,
            legKm: 42.1,
            waypointIndex: null,
            distanceSource: "ROAD",
            path: [
                [-24.86, -54.33],
                [-25.0, -54.3],
                [-25.09, -54.24],
            ],
        },
    ],
    ...extra,
});

const imported = {
    pickup: { lat: -25.0578, lng: -53.8772 },
    waypoints: [{ lat: -24.9414, lng: -54.105 }],
    dropoff: { lat: -25.0919, lng: -54.2475 },
};

function mockOptimize(extra: Partial<OptimizeResponse> = {}) {
    mockRequest.mockImplementation((method: string, path: string) => {
        if (method === "POST" && path === "/routes/optimize")
            return Promise.resolve(optimized(extra));
        if (path === "/orders/o1") return Promise.resolve(imported);
        if (path === "/orders")
            return Promise.resolve({
                items: [{ publicId: "o1", trackingNumber: "KJUCH8CWZD", waypointCount: 1 }],
                total: 1,
                limit: 100,
                offset: 0,
            });
        return Promise.reject(new Error(`unexpected ${method} ${path}`));
    });
}

const renderLab = () =>
    renderAt(
        "/routes/optimize",
        <WithTitleBlock>
            <RouteLab />
        </WithTitleBlock>,
        { role: "DISPATCHER" },
    );

function renderWithPoints() {
    renderLab();
    act(() => lastScene().pick!.onPick(-24.86, -54.33));
    act(() => lastScene().pick!.onPick(-25.09, -54.24));
}

beforeEach(() => {
    resetScenes();
    setReducedMotion(true);
    mockOptimize();
});

describe("RouteLab", () => {
    it("places points through the exclusive pick mode in target order", async () => {
        renderLab();
        act(() => lastScene().pick!.onPick(-24.86, -54.33));
        act(() => lastScene().pick!.onPick(-25.09, -54.24));
        expect(screen.getByRole("radio", { name: "Parada" })).toBeChecked();
        expect(screen.getByText("-24.86000, -54.33000")).toBeInTheDocument();
        expect(screen.getByText("-25.09000, -54.24000")).toBeInTheDocument();
    });

    it("shows the optimized km as the hero number against the original", async () => {
        mockOptimize({ totalKm: 42.1, baselineKm: 51.8, savingsPct: 18.7, etaMinutes: 64 });
        renderWithPoints();
        await userEvent.click(screen.getByRole("button", { name: "Otimizar" }));
        expect(await screen.findByText("42,1")).toBeInTheDocument();
        expect(screen.getByText(/contra 51,8 km na ordem original/)).toBeInTheDocument();
        expect(screen.getByText("18,7%")).toBeInTheDocument();
        expect(mockRequest).toHaveBeenCalledWith(
            "POST",
            "/routes/optimize",
            expect.objectContaining({
                pickup: { lat: -24.86, lng: -54.33 },
                dropoff: { lat: -25.09, lng: -54.24 },
                waypoints: [],
                compare: true,
            }),
        );
    });

    it("toggles the original-order layer", async () => {
        renderWithPoints();
        expect(lastScene().legs?.some((l) => l.kind === "original")).toBe(true);
        await userEvent.click(screen.getByRole("switch", { name: "Ordem original (linha reta)" }));
        expect(lastScene().legs?.some((l) => l.kind === "original")).toBe(false);
    });

    it("invites the first click when there are no points", () => {
        renderLab();
        expect(screen.getByText("Clique no mapa para marcar a retirada")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Otimizar" })).toBeDisabled();
    });

    it("compares the algorithms with km and calculation time", async () => {
        mockOptimize({
            comparison: {
                NEAREST_NEIGHBOR: { totalKm: 47.3, ms: 2 },
                TWO_OPT: { totalKm: 42.1, ms: 9 },
            },
        });
        renderWithPoints();
        await userEvent.click(screen.getByRole("button", { name: "Otimizar" }));
        const list = await screen.findByRole("list", { name: "Comparação dos algoritmos" });
        const rows = within(list).getAllByRole("listitem");
        expect(rows).toHaveLength(2);
        expect(within(rows[0]).getByText("Vizinho mais próximo")).toBeInTheDocument();
        expect(within(rows[0]).getByText("47,3 km")).toBeInTheDocument();
        expect(within(rows[0]).getByText("2 ms")).toBeInTheDocument();
        expect(within(rows[1]).getByText("Menor")).toBeInTheDocument();
        expect(within(rows[0]).queryByText("Menor")).toBeNull();
    });

    it("drops the result when a point changes", async () => {
        renderWithPoints();
        await userEvent.click(screen.getByRole("button", { name: "Otimizar" }));
        await screen.findByText("42,1");
        act(() => lastScene().pick!.onPick(-24.95, -54.28));
        expect(screen.queryByText("42,1")).toBeNull();
        expect(lastScene().animateLegs).toBe(false);
    });

    it("keeps the camera still while points are clicked and frames an imported order", async () => {
        renderLab();
        const before = lastScene().camera;
        act(() => lastScene().pick!.onPick(-24.86, -54.33));
        act(() => lastScene().pick!.onPick(-25.09, -54.24));
        expect(lastScene().camera).toEqual(before);
        await userEvent.selectOptions(
            await screen.findByLabelText("Importar de um pedido"),
            await screen.findByRole("option", { name: "KJUCH8CWZD (1 paradas)" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Importar" }));
        expect(await screen.findByText("-24.94140, -54.10500")).toBeInTheDocument();
        expect(lastScene().camera?.points).toEqual([
            [-25.0578, -53.8772],
            [-24.9414, -54.105],
            [-25.0919, -54.2475],
        ]);
    });
});
