import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Vehicle } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { WithTitleBlock } from "../../test/titleBlock";
import Vehicles from "../Vehicles";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));
vi.mock("../../realtime/useTopic", () => ({
    useTopic: () => {},
    useConnectionState: () => "connected",
}));

const vehicle = (extra: Partial<Vehicle>): Vehicle => ({
    publicId: "v1",
    plate: "BRA2E19",
    type: "Van",
    status: "AVAILABLE",
    driverId: "d1",
    driverName: "Marcos Vieira",
    active: true,
    ...extra,
});

const vehicles = [
    vehicle({}),
    vehicle({
        publicId: "v2",
        plate: "QWE4R56",
        type: "Moto",
        status: "MAINTENANCE",
        driverId: null,
        driverName: null,
    }),
    vehicle({
        publicId: "v3",
        plate: "RHN7C02",
        type: "Caminhão",
        status: "AVAILABLE",
        driverId: null,
        driverName: null,
        active: false,
    }),
];

const TOTALS: Record<string, number> = { AVAILABLE: 5, IN_USE: 4, MAINTENANCE: 3 };

const renderGarage = (path = "/vehicles") =>
    renderAt(
        path,
        <WithTitleBlock>
            <Vehicles />
        </WithTitleBlock>,
        { role: "FLEET_MANAGER" },
    );

beforeEach(() => {
    setReducedMotion(true);
    mockRequest.mockReset();
    mockRequest.mockImplementation(
        (_method: string, path: string, _body: unknown, params: Record<string, unknown> = {}) => {
            if (path !== "/vehicles") return Promise.reject(new Error(`unexpected ${path}`));
            if (params.limit === 1) {
                const total = params.status ? TOTALS[params.status as string] : 12;
                return Promise.resolve({ items: [], total, limit: 1, offset: 0 });
            }
            return Promise.resolve({ items: vehicles, total: 12, limit: 20, offset: 0 });
        },
    );
});

describe("Vehicles garage", () => {
    it("shows the count line from the API totals", async () => {
        renderGarage();
        expect(await screen.findByText("12 veículos")).toBeInTheDocument();
        expect(await screen.findByText("5 disponíveis")).toBeInTheDocument();
        expect(screen.getByText("4 em uso")).toBeInTheDocument();
        expect(screen.getByText("3 em manutenção")).toBeInTheDocument();
        expect(mockRequest).toHaveBeenCalledWith(
            "GET",
            "/vehicles",
            undefined,
            expect.objectContaining({ status: "MAINTENANCE", limit: 1 }),
        );
    });

    it("renders the side view for known types and a fallback for unknown ones", async () => {
        renderGarage();
        const van = await screen.findByAltText("Van BRA2E19");
        expect(van).toHaveAttribute("src", "/renders/van-side.webp");
        expect(van).toHaveAttribute("loading", "lazy");
        expect(screen.getByText("Sem imagem para “Moto”")).toBeInTheDocument();
        expect(screen.queryByAltText(/Moto/)).toBeNull();
    });

    it("dims inactive vehicles with the 'Inativo' chip", async () => {
        renderGarage("/vehicles?includeInactive=true");
        const card = (await screen.findByText("RHN7C02")).closest("button")!;
        expect(card).toHaveClass("is-inactive");
        expect(within(card).getByText("Inativo")).toBeInTheDocument();
    });

    it("opens and closes the detail panel by clicking the same card again", async () => {
        renderGarage();
        const card = (await screen.findByText("BRA2E19")).closest("button")!;
        await userEvent.click(card);
        expect(card).toHaveAttribute("aria-pressed", "true");
        const panel = screen.getByRole("dialog", { name: "BRA2E19" });
        expect(within(panel).getByText("Motorista atual")).toBeInTheDocument();
        expect(within(panel).getByText("Marcos Vieira")).toBeInTheDocument();
        await userEvent.click(card);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("switches the panel to the flat form when editing", async () => {
        renderGarage();
        await userEvent.click((await screen.findByText("BRA2E19")).closest("button")!);
        await userEvent.click(screen.getByRole("button", { name: "Editar" }));
        const panel = screen.getByRole("dialog", { name: "Editar veículo" });
        expect(within(panel).getByLabelText("Placa")).toHaveValue("BRA2E19");
    });

    it("filters by status through the segment with counts", async () => {
        renderGarage();
        await userEvent.click(await screen.findByRole("button", { name: /Manutenção 3/ }));
        expect(mockRequest).toHaveBeenCalledWith(
            "GET",
            "/vehicles",
            undefined,
            expect.objectContaining({ status: "MAINTENANCE", limit: 20 }),
        );
    });
});
