import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Driver, DriverStatus } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { WithTitleBlock } from "../../test/titleBlock";
import FleetDetail from "../FleetDetail";
import Fleets from "../Fleets";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));
vi.mock("../../patterns/GlassMapFrame", () => ({
    GlassMapFrame: ({ markers }: { markers: unknown[] }) => (
        <div data-testid="glass-map-frame" data-count={markers.length} />
    ),
    default: () => <div data-testid="glass-map-frame" />,
}));

const NAMES = [
    "Marcos Vieira",
    "Ana Souza",
    "Paulo Lima",
    "Rita Gomes",
    "Caio Dias",
    "Bruna Reis",
    "Davi Melo",
];

const member = (i: number, status: DriverStatus, located = true): Driver => ({
    publicId: `d${i}`,
    username: `u${i}`,
    name: NAMES[i],
    phone: null,
    licenseNumber: null,
    status,
    lat: located ? -24.9 - i / 100 : null,
    lng: located ? -53.4 : null,
    lastSeenAt: null,
    fleets: [],
    vehicle: i === 0 ? { publicId: "v1", plate: "BRA2E19", type: "Van" } : null,
    active: true,
});

const OESTE = {
    publicId: "f1",
    name: "Oeste",
    drivers: [member(0, "AVAILABLE"), member(1, "AVAILABLE"), member(2, "BUSY", false)],
};
const NORTE = {
    publicId: "f2",
    name: "Norte",
    drivers: [0, 1, 2, 3, 4, 5, 6].map((i) => member(i, "OFFLINE")),
};

beforeEach(() => {
    setReducedMotion(true);
    mockRequest.mockReset();
    mockRequest.mockImplementation((_method: string, path: string) => {
        if (path === "/fleets")
            return Promise.resolve({
                items: [
                    { publicId: "f1", name: "Oeste", driverCount: 3 },
                    { publicId: "f2", name: "Norte", driverCount: 7 },
                ],
                total: 2,
                limit: 20,
                offset: 0,
            });
        if (path === "/fleets/f1") return Promise.resolve(OESTE);
        if (path === "/fleets/f2") return Promise.resolve(NORTE);
        if (path === "/drivers")
            return Promise.resolve({ items: OESTE.drivers, total: 3, limit: 100, offset: 0 });
        return Promise.reject(new Error(`unexpected ${path}`));
    });
});

const renderList = () =>
    renderAt(
        "/fleets",
        <WithTitleBlock>
            <Fleets />
        </WithTitleBlock>,
        { role: "FLEET_MANAGER" },
    );

const renderDetail = (role: "FLEET_MANAGER" | "DISPATCHER" = "FLEET_MANAGER") =>
    renderAt(
        "/fleets/f1",
        <WithTitleBlock>
            <Routes>
                <Route path="/fleets/:id" element={<FleetDetail />} />
            </Routes>
        </WithTitleBlock>,
        { role },
    );

const hasText = (text: string) => (_: string, el: Element | null) => el?.textContent === text;

describe("Fleets", () => {
    it("shows each fleet as a card with a stacked status bar and overlapping avatars", async () => {
        renderList();
        const card = (await screen.findByText("Oeste")).closest("article")!;
        expect(within(card).getByText(hasText("3 motoristas"))).toBeInTheDocument();
        expect(
            await within(card).findByRole("img", { name: "2 disponíveis, 1 ocupado, 0 offline" }),
        ).toBeInTheDocument();
        expect(within(card).getAllByText(/^[A-Z]{1,2}$/)).toHaveLength(3);
    });

    it("caps the avatar stack at five and shows the rest as +N", async () => {
        renderList();
        const card = (await screen.findByText("Norte")).closest("article")!;
        expect(await within(card).findByText("+2")).toBeInTheDocument();
        expect(within(card).getAllByText(/^[A-Z]{1,2}$/)).toHaveLength(5);
    });

    it("opens the members in the side panel and toggles it from the same card", async () => {
        renderList();
        const open = await screen.findByRole("button", { name: "Oeste" });
        await userEvent.click(open);
        const panel = screen.getByRole("dialog", { name: "Oeste" });
        expect(panel).toHaveAttribute("aria-modal", "false");
        expect(await within(panel).findByText("Marcos Vieira")).toBeInTheDocument();
        expect(within(panel).getByRole("link", { name: "Abrir frota" })).toHaveAttribute(
            "href",
            "/fleets/f1",
        );
        await userEvent.click(open);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("hides the pager while every fleet fits on the smallest page", async () => {
        renderList();
        await screen.findByText("Oeste");
        expect(screen.queryByText("Por página")).toBeNull();
    });

    it("puts the fleet total in the title block", async () => {
        renderList();
        expect(await screen.findByText("2 frotas")).toBeInTheDocument();
    });
});

describe("Fleet detail", () => {
    it("shows name, count, members with status and only located drivers on the map", async () => {
        renderDetail();
        expect(await screen.findByRole("heading", { name: "Oeste" })).toBeInTheDocument();
        expect(screen.getByText("3 motoristas")).toBeInTheDocument();
        expect(screen.getByTestId("glass-map-frame")).toHaveAttribute("data-count", "2");
        const list = screen.getByRole("list", { name: "Membros da frota" });
        expect(within(list).getByText("Paulo Lima")).toBeInTheDocument();
        expect(within(list).getAllByText("Disponível")).toHaveLength(2);
        expect(within(list).getByText("Ocupado")).toBeInTheDocument();
    });

    it("edits name and members in the side panel", async () => {
        renderDetail();
        await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
        const panel = screen.getByRole("dialog", { name: "Editar frota" });
        expect(panel).toHaveAttribute("aria-modal", "false");
        expect(within(panel).getByLabelText("Nome")).toHaveValue("Oeste");
        expect(
            await within(panel).findByRole("list", { name: "Motoristas da frota" }),
        ).toBeInTheDocument();
    });

    it("hides management actions from dispatchers", async () => {
        renderDetail("DISPATCHER");
        await screen.findByRole("heading", { name: "Oeste" });
        expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    });
});
