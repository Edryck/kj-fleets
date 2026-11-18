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
    brand: "Fiat",
    model: "Fiorino",
    year: 2023,
    color: "Vermelho",
    capacityKg: 650,
    volumeM3: 3.1,
    odometerKm: 48210,
    ...extra,
});

const bare = {
    brand: null,
    model: null,
    year: null,
    color: null,
    capacityKg: null,
    volumeM3: null,
    odometerKm: null,
};

const vehicles = [
    vehicle({}),
    vehicle({
        publicId: "v2",
        plate: "QWE4R56",
        type: "Moto",
        status: "MAINTENANCE",
        driverId: null,
        driverName: null,
        ...bare,
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
    vehicle({
        publicId: "v4",
        plate: "BIK0A01",
        type: "Bicicleta",
        driverId: null,
        driverName: null,
        ...bare,
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

    it("renders the model's side view and a fallback for unknown types", async () => {
        renderGarage();
        const fiorino = await screen.findByAltText("Fiat Fiorino BRA2E19");
        expect(fiorino).toHaveAttribute("src", "/renders/fiorino-side.webp");
        expect(fiorino).toHaveAttribute("loading", "lazy");
        expect(screen.getByAltText("Moto QWE4R56")).toHaveAttribute(
            "src",
            "/renders/cg-cargo-side.webp",
        );
        expect(screen.getByText("Sem imagem para “Bicicleta”")).toBeInTheDocument();
    });

    it("names the card by brand and model and paints it in the registered color", async () => {
        renderGarage();
        const card = (await screen.findByText("BRA2E19")).closest("button")!;
        expect(within(card).getByText("Fiat Fiorino · Marcos Vieira")).toBeInTheDocument();
        expect(card.querySelector(".vehicle-shot-paint")).not.toBeNull();
        const moto = screen.getByText("QWE4R56").closest("button")!;
        expect(within(moto).getByText("Moto · Sem motorista")).toBeInTheDocument();
    });

    it("lists every vehicle field in the detail panel", async () => {
        renderGarage();
        await userEvent.click((await screen.findByText("BRA2E19")).closest("button")!);
        const panel = screen.getByRole("dialog", { name: "BRA2E19" });
        const row = (label: string) => within(panel).getByText(label).parentElement!;
        expect(within(row("Marca e modelo")).getByText("Fiat Fiorino")).toBeInTheDocument();
        expect(within(row("Ano")).getByText("2023")).toBeInTheDocument();
        expect(within(row("Cor")).getByText("Vermelho")).toBeInTheDocument();
        expect(within(row("Capacidade")).getByText("650 kg")).toBeInTheDocument();
        expect(within(row("Volume")).getByText("3,1 m³")).toBeInTheDocument();
        expect(within(row("Hodômetro")).getByText("48.210 km")).toBeInTheDocument();
    });

    it("says what is missing for vehicles registered before the new fields", async () => {
        renderGarage();
        await userEvent.click((await screen.findByText("QWE4R56")).closest("button")!);
        const panel = screen.getByRole("dialog", { name: "QWE4R56" });
        expect(within(panel).getAllByText("Não informado").length).toBe(6);
    });

    it("sends the new fields and lets a catalog model set the type", async () => {
        mockRequest.mockImplementation(
            (method: string, _path: string, body: unknown, params = {}) => {
                if (method === "POST")
                    return Promise.resolve({ ...vehicle({}), ...(body as object) });
                if ((params as Record<string, unknown>).limit === 1)
                    return Promise.resolve({ items: [], total: 0, limit: 1, offset: 0 });
                return Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 });
            },
        );
        renderGarage();
        await userEvent.click(await screen.findByRole("button", { name: "Novo veículo" }));
        const panel = screen.getByRole("dialog", { name: "Novo veículo" });
        await userEvent.type(within(panel).getByLabelText("Placa"), "abc1d23");
        await userEvent.type(within(panel).getByLabelText("Marca"), "Fiat");
        await userEvent.type(within(panel).getByLabelText("Modelo"), "Fiorino");
        expect(within(panel).getByLabelText("Tipo")).toHaveValue("Furgão");
        await userEvent.type(within(panel).getByLabelText("Ano"), "2023");
        await userEvent.selectOptions(within(panel).getByLabelText("Cor"), "Branco");
        await userEvent.type(within(panel).getByLabelText("Capacidade (kg)"), "650");
        await userEvent.type(within(panel).getByLabelText("Volume (m³)"), "3,1");
        await userEvent.type(within(panel).getByLabelText("Hodômetro (km)"), "48210");
        await userEvent.click(within(panel).getByRole("button", { name: "Cadastrar veículo" }));
        expect(mockRequest).toHaveBeenCalledWith("POST", "/vehicles", {
            plate: "abc1d23",
            type: "Furgão",
            status: "AVAILABLE",
            brand: "Fiat",
            model: "Fiorino",
            year: 2023,
            color: "Branco",
            capacityKg: 650,
            volumeM3: 3.1,
            odometerKm: 48210,
        });
    });

    it("rejects a year outside the accepted range before sending", async () => {
        renderGarage();
        await userEvent.click(await screen.findByRole("button", { name: "Novo veículo" }));
        const panel = screen.getByRole("dialog", { name: "Novo veículo" });
        await userEvent.type(within(panel).getByLabelText("Placa"), "abc1d23");
        await userEvent.selectOptions(within(panel).getByLabelText("Tipo"), "Van");
        await userEvent.type(within(panel).getByLabelText("Ano"), "1975");
        await userEvent.click(within(panel).getByRole("button", { name: "Cadastrar veículo" }));
        const next = new Date().getFullYear() + 1;
        expect(within(panel).getByText(`Use um ano entre 1980 e ${next}`)).toBeInTheDocument();
        expect(mockRequest).not.toHaveBeenCalledWith("POST", "/vehicles", expect.anything());
    });

    it("keeps a type the user picks after a catalog model filled it", async () => {
        renderGarage();
        await userEvent.click(await screen.findByRole("button", { name: "Novo veículo" }));
        const panel = screen.getByRole("dialog", { name: "Novo veículo" });
        await userEvent.type(within(panel).getByLabelText("Marca"), "Fiat");
        await userEvent.type(within(panel).getByLabelText("Modelo"), "Ducato");
        expect(within(panel).getByLabelText("Tipo")).toHaveValue("Van");
        await userEvent.selectOptions(within(panel).getByLabelText("Tipo"), "Furgão");
        expect(within(panel).getByLabelText("Tipo")).toHaveValue("Furgão");
    });

    it("does not rewrite the saved type when opening the edit form", async () => {
        mockRequest.mockImplementation((_m: string, _p: string, _b: unknown, params = {}) => {
            if ((params as Record<string, unknown>).limit === 1)
                return Promise.resolve({ items: [], total: 1, limit: 1, offset: 0 });
            return Promise.resolve({
                items: [
                    vehicle({ type: "Caminhão", brand: "Mercedes-Benz", model: "Accelo 1016" }),
                ],
                total: 1,
                limit: 20,
                offset: 0,
            });
        });
        renderGarage();
        await userEvent.click((await screen.findByText("BRA2E19")).closest("button")!);
        await userEvent.click(screen.getByRole("button", { name: "Editar" }));
        const panel = screen.getByRole("dialog", { name: "Editar veículo" });
        expect(within(panel).getByLabelText("Tipo")).toHaveValue("Caminhão");
    });

    it("keeps an older free-text type selectable when editing", async () => {
        mockRequest.mockImplementation((_m: string, _p: string, _b: unknown, params = {}) => {
            if ((params as Record<string, unknown>).limit === 1)
                return Promise.resolve({ items: [], total: 1, limit: 1, offset: 0 });
            return Promise.resolve({
                items: [vehicle({ type: "Utilitário", brand: null, model: null, color: null })],
                total: 1,
                limit: 20,
                offset: 0,
            });
        });
        renderGarage();
        await userEvent.click((await screen.findByText("BRA2E19")).closest("button")!);
        await userEvent.click(screen.getByRole("button", { name: "Editar" }));
        const panel = screen.getByRole("dialog", { name: "Editar veículo" });
        expect(within(panel).getByLabelText("Tipo")).toHaveValue("Utilitário");
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
