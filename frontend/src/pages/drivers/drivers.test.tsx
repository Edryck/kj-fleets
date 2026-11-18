import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Driver, Role } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { WithTitleBlock } from "../../test/titleBlock";
import DriverDetail from "../DriverDetail";
import Drivers from "../Drivers";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));
vi.mock("../../realtime/useTopic", () => ({
    useTopic: () => {},
    useConnectionState: () => "connected",
}));
vi.mock("../../patterns/GlassMapFrame", () => ({
    GlassMapFrame: () => <div data-testid="glass-map-frame" />,
    default: () => <div data-testid="glass-map-frame" />,
}));

const marcos: Driver = {
    publicId: "drv-1",
    username: "marcos",
    name: "Marcos Vieira",
    phone: "45 99999-0000",
    licenseNumber: "123",
    status: "AVAILABLE",
    lat: -24.95,
    lng: -53.45,
    lastSeenAt: new Date(Date.now() - 180_000).toISOString(),
    fleets: [{ publicId: "f1", name: "Oeste" }],
    vehicle: { publicId: "v1", plate: "BRA2E19", type: "Van" },
    active: true,
};

const ana: Driver = {
    ...marcos,
    publicId: "drv-2",
    username: "ana",
    name: "Ana Souza",
    status: "OFFLINE",
    lat: null,
    lng: null,
    lastSeenAt: null,
    fleets: [],
    vehicle: null,
};

const TOTALS: Record<string, number> = { AVAILABLE: 3, BUSY: 2, OFFLINE: 4 };

const page = <T,>(items: T[], total = items.length) => ({ items, total, limit: 20, offset: 0 });

beforeEach(() => {
    setReducedMotion(true);
    mockRequest.mockReset();
    mockRequest.mockImplementation(
        (_method: string, path: string, _body: unknown, params: Record<string, unknown> = {}) => {
            if (path === "/drivers" && params.limit === 1) {
                const total = params.status ? TOTALS[params.status as string] : 9;
                return Promise.resolve({ items: [], total, limit: 1, offset: 0 });
            }
            if (path === "/drivers") return Promise.resolve(page([marcos, ana], 9));
            if (path === "/drivers/drv-1") return Promise.resolve(marcos);
            if (path === "/vehicles") return Promise.resolve(page([]));
            if (path === "/orders")
                return Promise.resolve(
                    page([
                        {
                            publicId: "o1",
                            trackingNumber: "KJ-0001",
                            status: "DISPATCHED",
                            createdAt: new Date().toISOString(),
                            dispatchedAt: null,
                            finishedAt: null,
                            pickupName: "Depósito Centro",
                            dropoffName: "Mercado Sul",
                            waypointCount: 1,
                            driver: { publicId: "drv-1", name: "Marcos Vieira" },
                            vehicle: null,
                            customer: null,
                        },
                    ]),
                );
            if (path === "/dashboard/drivers/performance")
                return Promise.resolve({
                    meta: {},
                    idleDriverIds: [],
                    drivers: [
                        {
                            driverId: "drv-1",
                            name: "Marcos Vieira",
                            completed: 42,
                            failed: 3,
                            successRate: { rate: 0.933, n: 45 },
                            avgDispatchToArrivedMinutes: 18,
                            busyPct: 61,
                            orders: 45,
                        },
                    ],
                });
            return Promise.reject(new Error(`unexpected ${path}`));
        },
    );
});

const renderList = () =>
    renderAt(
        "/drivers",
        <WithTitleBlock>
            <Drivers />
        </WithTitleBlock>,
        { role: "FLEET_MANAGER" },
    );

const renderProfile = (role: Role = "FLEET_MANAGER") =>
    renderAt(
        "/drivers/drv-1",
        <WithTitleBlock>
            <Routes>
                <Route path="/drivers/:id" element={<DriverDetail />} />
            </Routes>
        </WithTitleBlock>,
        { role },
    );

describe("Drivers team", () => {
    it("lists drivers with avatar, status, small side render and last signal", async () => {
        renderList();
        const row = (await screen.findByText("Marcos Vieira")).closest("tr")!;
        expect(within(row).getByText("MV")).toBeInTheDocument();
        const render = within(row).getByAltText("Van BRA2E19");
        expect(render).toHaveAttribute("src", "/renders/sprinter-side.webp");
        expect(within(row).getByText("Disponível")).toBeInTheDocument();
        expect(within(row).getByText("há 3 min")).toBeInTheDocument();
    });

    it("puts the status counts in the segment and the total in the title block", async () => {
        renderList();
        expect(await screen.findByText("9 motoristas")).toBeInTheDocument();
        expect(await screen.findByRole("button", { name: "Disponível 3" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Offline 4" })).toBeInTheDocument();
    });

    it("shows the side panel with the vehicle card and a mini map only when there is a position", async () => {
        renderList();
        await userEvent.click(await screen.findByText("Marcos Vieira"));
        const first = screen.getByRole("dialog", { name: "Marcos Vieira" });
        expect(within(first).getByTestId("glass-map-frame")).toBeInTheDocument();
        expect(within(first).getByRole("link", { name: "Ver perfil" })).toHaveAttribute(
            "href",
            "/drivers/drv-1",
        );
        await userEvent.click(screen.getByText("Ana Souza"));
        const panel = screen.getByRole("dialog", { name: "Ana Souza" });
        expect(within(panel).queryByTestId("glass-map-frame")).toBeNull();
        expect(within(panel).getByText("Sem posição")).toBeInTheDocument();
        expect(within(panel).getByText("Sem veículo atribuído")).toBeInTheDocument();
    });

    it("opens the flat form in the side panel to create a driver", async () => {
        renderList();
        await userEvent.click(await screen.findByRole("button", { name: "Novo motorista" }));
        const panel = screen.getByRole("dialog", { name: "Novo motorista" });
        expect(panel).toHaveAttribute("aria-modal", "false");
        expect(within(panel).getByLabelText("Senha")).toBeInTheDocument();
    });
});

describe("Driver profile", () => {
    it("shows name, vehicle, last position frame and recent orders with mini route", async () => {
        renderProfile();
        expect(await screen.findByRole("heading", { name: "Marcos Vieira" })).toBeInTheDocument();
        expect(screen.getByTestId("glass-map-frame")).toBeInTheDocument();
        expect(screen.getByText("BRA2E19")).toBeInTheDocument();
        expect(await screen.findByText("Depósito Centro")).toBeInTheDocument();
        expect(screen.getByText("Mercado Sul")).toBeInTheDocument();
    });

    it("shows performance numbers for fleet managers", async () => {
        renderProfile("FLEET_MANAGER");
        expect(await screen.findByText("Concluídos")).toBeInTheDocument();
        expect(await screen.findByText("Taxa de sucesso")).toBeInTheDocument();
    });

    it("hides performance numbers for dispatchers", async () => {
        renderProfile("DISPATCHER");
        await screen.findByRole("heading", { name: "Marcos Vieira" });
        expect(screen.queryByText("Concluídos")).toBeNull();
        expect(mockRequest).not.toHaveBeenCalledWith(
            "GET",
            "/dashboard/drivers/performance",
            undefined,
            expect.anything(),
        );
    });

    it("edits in the side panel", async () => {
        renderProfile();
        await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
        const panel = screen.getByRole("dialog", { name: "Editar motorista" });
        expect(panel).toHaveAttribute("aria-modal", "false");
        expect(within(panel).getByLabelText("Nome")).toHaveValue("Marcos Vieira");
    });
});
