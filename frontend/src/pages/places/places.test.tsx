import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapMarker } from "../../components/MapView";
import type { Place } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { WithTitleBlock } from "../../test/titleBlock";
import MyPlaces from "../MyPlaces";
import Places from "../Places";

type MapProps = {
    markers: MapMarker[];
    focusId?: string | null;
    onPick?: (lat: number, lng: number) => void;
};

const { mockRequest, mapProps } = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mapProps: [] as MapProps[],
}));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));
vi.mock("../../patterns/GlassMapFrame", () => {
    const Frame = (props: MapProps) => {
        mapProps.push(props);
        return <div data-testid="glass-map-frame" />;
    };
    return { GlassMapFrame: Frame, default: Frame };
});

const lastMapProps = () => mapProps[mapProps.length - 1];

const PLACES: Place[] = [
    {
        publicId: "p1",
        name: "Depósito Centro",
        address: "Rua A, 100",
        lat: -25.5,
        lng: -54.58,
        contact: { name: "Rui Prado", phone: "45 99999-0000", email: null },
        active: true,
    },
    {
        publicId: "p2",
        name: "CD Medianeira",
        address: "Av. Brasil, 9",
        lat: -25.29,
        lng: -54.09,
        contact: null,
        active: true,
    },
    {
        publicId: "p3",
        name: "Galpão sem ponto",
        address: "",
        lat: null,
        lng: null,
        contact: null,
        active: true,
    },
];

beforeEach(() => {
    setReducedMotion(true);
    mapProps.length = 0;
    mockRequest.mockReset();
    mockRequest.mockImplementation((method: string, path: string) => {
        if (method === "GET" && (path === "/places" || path === "/customer/places"))
            return Promise.resolve({ items: PLACES, total: 3, limit: 20, offset: 0 });
        if (method === "DELETE") return Promise.resolve(undefined);
        return Promise.reject(new Error(`unexpected ${method} ${path}`));
    });
});

const renderPlaces = (role: "ADMIN" | "FLEET_MANAGER" = "ADMIN") =>
    renderAt(
        "/places",
        <WithTitleBlock>
            <Places />
        </WithTitleBlock>,
        { role },
    );

const renderMine = () =>
    renderAt(
        "/my/places",
        <WithTitleBlock>
            <MyPlaces />
        </WithTitleBlock>,
        { role: "CUSTOMER" },
    );

describe("Places", () => {
    it("pins every place with coordinates and flies to the selected one", async () => {
        renderPlaces();
        await screen.findByText("CD Medianeira");
        expect(lastMapProps().markers.map((m) => m.id)).toEqual(["p1", "p2"]);
        await userEvent.click(screen.getByText("CD Medianeira"));
        expect(lastMapProps().focusId).toBe("p2");
    });

    it("picks the point on the map while creating", async () => {
        renderPlaces();
        await userEvent.click(await screen.findByRole("button", { name: "Novo lugar" }));
        const panel = screen.getByRole("dialog", { name: "Novo lugar" });
        expect(panel).toHaveAttribute("aria-modal", "false");
        act(() => lastMapProps().onPick!(-25.29, -54.09));
        expect(within(panel).getByLabelText("Latitude")).toHaveValue("-25.290000");
        expect(within(panel).getByLabelText("Longitude")).toHaveValue("-54.090000");
        expect(lastMapProps().markers.map((m) => m.id)).toContain("draft");
    });

    it("shows the count as a large number", async () => {
        renderPlaces();
        await screen.findByText("CD Medianeira");
        const hero = screen.getByText("lugares ativos").closest(".hero-number")!;
        expect(hero).toHaveClass("is-large");
        expect(hero.textContent).toContain("3");
    });

    it("edits the selected place in the side panel with its point as the draft", async () => {
        renderPlaces();
        await userEvent.click(await screen.findByText("CD Medianeira"));
        await userEvent.click(screen.getByRole("button", { name: "Editar CD Medianeira" }));
        const panel = screen.getByRole("dialog", { name: "Editar lugar" });
        expect(within(panel).getByLabelText("Nome")).toHaveValue("CD Medianeira");
        const ids = lastMapProps().markers.map((m) => m.id);
        expect(ids).toContain("draft");
        expect(ids).not.toContain("p2");
    });

    it("confirms before deleting the selected place", async () => {
        renderPlaces();
        await userEvent.click(await screen.findByText("Depósito Centro"));
        await userEvent.click(screen.getByRole("button", { name: "Excluir Depósito Centro" }));
        await userEvent.click(screen.getByRole("button", { name: "Excluir lugar" }));
        expect(mockRequest).toHaveBeenCalledWith("DELETE", "/places/p1");
    });

    it("keeps fleet managers read-only", async () => {
        renderPlaces("FLEET_MANAGER");
        await userEvent.click(await screen.findByText("CD Medianeira"));
        expect(screen.queryByRole("button", { name: "Novo lugar" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Editar CD Medianeira" })).toBeNull();
    });
});

describe("My places", () => {
    it("uses the same atlas without internal data and edits in the side panel", async () => {
        renderMine();
        await screen.findByText("CD Medianeira");
        expect(screen.getByText("endereços salvos")).toBeInTheDocument();
        expect(lastMapProps().markers.map((m) => m.id)).toEqual(["p1", "p2"]);
        expect(screen.queryByText("Rui Prado")).toBeNull();
        await userEvent.click(screen.getByText("CD Medianeira"));
        expect(lastMapProps().focusId).toBe("p2");
        await userEvent.click(screen.getByRole("button", { name: "Editar CD Medianeira" }));
        const panel = screen.getByRole("dialog", { name: "Editar endereço" });
        act(() => lastMapProps().onPick!(-25.3, -54.1));
        expect(within(panel).getByLabelText("Latitude")).toHaveValue("-25.300000");
    });
});
