import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DispatchQueue, OrderDetail, Place, PlanResponse } from "../api/types";
import { renderAt } from "../test/render";
import { lastScene, resetScenes } from "../test/sceneMock";
import Dispatch from "./Dispatch";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../api/http")>()),
    request: mockRequest,
}));
vi.mock("../map/useMapScene", () => import("../test/sceneMock"));

const item = (orderId: string, trackingNumber: string, minutesInStage = 5) => ({
    orderId,
    trackingNumber,
    pickupName: "Armazém Santa Helena",
    dropoffName: "Mercado Central",
    minutesInStage,
});

const queue: DispatchQueue = {
    unassigned: { items: [item("o1", "KJ0001", 42), item("o2", "KJ0002")], total: 2 },
    assignedNotDispatched: { items: [item("o3", "KJ0003")], total: 1 },
    inProgress: {
        items: [
            {
                orderId: "o4",
                status: "IN_PROGRESS",
                driverId: "d2",
                driverName: "Bianca Alves",
                etaMinutes: 25,
                stopsDone: 1,
                stopsTotal: 3,
            },
        ] as DispatchQueue["inProgress"]["items"],
        total: 1,
    },
    stale: {
        items: [
            {
                orderId: "o1",
                trackingNumber: "KJ0001",
                stage: "UNASSIGNED",
                minutesInStage: 42,
                limitMin: 30,
            },
        ],
        total: 1,
    },
};

const place = (lat: number, lng: number, name: string): Place => ({
    publicId: name,
    name,
    address: "",
    lat,
    lng,
    contact: null,
    active: true,
});

const detail = (id: string, waypoints = 0): OrderDetail =>
    ({
        publicId: id,
        trackingNumber: `KJ000${id.slice(1)}`,
        status: "CREATED",
        pickup: place(-24.86, -54.33, "Armazém Santa Helena"),
        dropoff: place(-25.09, -54.24, "Mercado Central"),
        waypoints: Array.from({ length: waypoints }, (_, i) =>
            place(-24.9 - i / 100, -54.3, `Parada ${i}`),
        ),
    }) as OrderDetail;

const plan = (applied: boolean): PlanResponse => ({
    algorithm: "HUNGARIAN",
    applied,
    assignments: [{ orderId: "o1", driverId: "d1", vehicleId: "v1", km: 17.8 }],
    unassigned: [],
    totalKm: 17.8,
    comparison: { HUNGARIAN: 17.8, GREEDY: 21.3 },
});

beforeEach(() => {
    resetScenes();
    mockRequest.mockReset();
    mockRequest.mockImplementation((method: string, path: string, body?: { apply?: boolean }) => {
        if (path === "/dashboard/dispatch/queue") return Promise.resolve(queue);
        if (path === "/drivers")
            return Promise.resolve({
                items: [
                    {
                        publicId: "d1",
                        name: "Marcos Vieira",
                        status: "AVAILABLE",
                        lat: -24.95,
                        lng: -54.2,
                        vehicle: null,
                    },
                ],
                total: 1,
            });
        if (path === "/vehicles")
            return Promise.resolve({
                items: [{ publicId: "v1", plate: "KJF1A01", status: "AVAILABLE" }],
                total: 1,
            });
        if (path === "/orders/o1") return Promise.resolve(detail("o1", 2));
        if (path.startsWith("/orders/") && method === "GET")
            return Promise.resolve(detail(path.split("/").pop()!));
        if (path === "/dispatch/plan") return Promise.resolve(plan(Boolean(body?.apply)));
        return Promise.reject(new Error(`unexpected ${method} ${path}`));
    });
});

const renderDispatch = () => renderAt("/dispatch", <Dispatch />, { role: "DISPATCHER" });

describe("Dispatch", () => {
    it("offers selection only in 'Sem motorista'", async () => {
        renderDispatch();
        expect(await screen.findAllByRole("checkbox")).toHaveLength(2);
        await userEvent.click(screen.getByRole("tab", { name: /Atribuídos/ }));
        expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("enables 'Despachar todos' only after the plan is applied", async () => {
        renderDispatch();
        const dispatchAll = await screen.findByRole("button", { name: "Despachar todos" });
        expect(dispatchAll).toBeDisabled();
        await userEvent.click(screen.getByRole("button", { name: "Calcular plano" }));
        expect(await screen.findByText("17,8 km")).toBeInTheDocument();
        expect(dispatchAll).toBeDisabled();
        await userEvent.click(screen.getByRole("button", { name: "Aplicar plano" }));
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(within(dialog).getByRole("button", { name: "Aplicar plano" }));
        await waitFor(() => expect(dispatchAll).toBeEnabled());
    });

    it("shows '+N paradas' once the order detail arrives", async () => {
        renderDispatch();
        expect(await screen.findByText("+2 paradas")).toBeInTheDocument();
    });

    it("lists driver, ETA and stops in 'Em andamento' without selection", async () => {
        renderDispatch();
        await userEvent.click(await screen.findByRole("tab", { name: /Em andamento/ }));
        expect(screen.getByText("Bianca Alves")).toBeInTheDocument();
        expect(screen.getByText("1/3 paradas")).toBeInTheDocument();
        expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("draws plan arcs on the flat map after planning", async () => {
        renderDispatch();
        await userEvent.click(await screen.findByRole("button", { name: "Calcular plano" }));
        await screen.findByText("17,8 km");
        await waitFor(() => expect(lastScene().arcs).toHaveLength(1));
        expect(lastScene().camera).toMatchObject({ pitch: 0, terrain: 0 });
    });
});
