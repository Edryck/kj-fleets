import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderDetail, OrderRoute, OrderSummary, Place } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { currentPath, renderAt } from "../../test/render";
import { WithTitleBlock } from "../../test/titleBlock";
import OrdersList from "../OrdersList";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request,
}));
vi.mock("../../realtime/useTopic", () => ({
    useTopic: () => {},
    useTopics: () => {},
    useConnectionState: () => "connected",
}));

const summary = (
    id: string,
    tracking: string,
    pickup: string,
    extra: Partial<OrderSummary> = {},
): OrderSummary => ({
    publicId: id,
    trackingNumber: tracking,
    status: "DISPATCHED",
    createdAt: "2026-11-16T11:40:00Z",
    dispatchedAt: "2026-11-16T11:50:00Z",
    finishedAt: null,
    pickupName: pickup,
    dropoffName: "CD Medianeira",
    waypointCount: 1,
    driver: { publicId: "d1", name: "Ana Ribeiro" },
    vehicle: { publicId: "v1", plate: "BRA2E19" },
    customer: { publicId: "c1", name: "Mercado Central" },
    ...extra,
});

const place = (publicId: string, name: string): Place => ({
    publicId,
    name,
    address: `${name}, Paraná`,
    lat: -24.7,
    lng: -53.7,
    contact: null,
    active: true,
});

const detail: OrderDetail = {
    publicId: "o1",
    trackingNumber: "KJ7Q2M9XAB",
    status: "DISPATCHED",
    customer: { publicId: "c1", name: "Mercado Central" },
    driver: { publicId: "d1", name: "Ana Ribeiro" },
    vehicle: { publicId: "v1", plate: "BRA2E19" },
    pickup: place("p1", "Armazém Toledo"),
    dropoff: place("p3", "CD Medianeira"),
    waypoints: [place("p2", "Bom Preço")],
    items: [],
    podRequired: false,
    podValue: null,
    podAt: null,
    reason: null,
    notes: null,
    meta: null,
    createdAt: "2026-11-16T11:40:00Z",
    dispatchedAt: "2026-11-16T11:50:00Z",
    finishedAt: null,
};

const route: OrderRoute = {
    orderId: "o1",
    algorithm: "NEAREST",
    mode: "ROAD",
    totalKm: 32.5,
    baselineKm: 34,
    savingsPct: 4.4,
    etaMinutes: 41,
    computedAt: "2026-11-16T11:50:00Z",
    fallbackLegs: 0,
    stops: [
        {
            seq: 1,
            type: "PICKUP",
            placeId: "p1",
            name: "Armazém Toledo",
            lat: -24.7,
            lng: -53.7,
            legKm: null,
            visitedAt: "2026-11-16T12:05:00Z",
            distanceM: null,
            distanceSource: null,
            path: null,
        },
        {
            seq: 2,
            type: "WAYPOINT",
            placeId: "p2",
            name: "Bom Preço",
            lat: -24.9,
            lng: -53.9,
            legKm: 12.4,
            visitedAt: null,
            distanceM: 12400,
            distanceSource: "ROAD",
            path: null,
        },
        {
            seq: 3,
            type: "DROPOFF",
            placeId: "p3",
            name: "CD Medianeira",
            lat: -25.2,
            lng: -54.0,
            legKm: 20.1,
            visitedAt: null,
            distanceM: 20100,
            distanceSource: "ROAD",
            path: null,
        },
    ],
};

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 20, offset: 0 });

beforeEach(() => {
    setReducedMotion(true);
    request.mockReset();
    request.mockImplementation(
        (_m: string, path: string, _b: unknown, q?: Record<string, unknown>) => {
            if (path === "/orders" && q?.limit === 1)
                return Promise.resolve({
                    items: [],
                    total: q.status === "CREATED" ? 7 : 1,
                    limit: 1,
                    offset: 0,
                });
            if (path === "/orders")
                return Promise.resolve(
                    page([
                        summary("o1", "KJ7Q2M9XAB", "Armazém Toledo"),
                        summary("o2", "KJ4H8L2PZN", "Mercado Sul"),
                    ]),
                );
            if (path === "/orders/o1") return Promise.resolve(detail);
            if (path === "/orders/o1/route") return Promise.resolve(route);
            if (path === "/drivers" || path === "/customers") return Promise.resolve(page([]));
            return Promise.reject(new Error(`unexpected ${path}`));
        },
    );
});

const renderList = (role: "DISPATCHER" | "CUSTOMER" = "DISPATCHER", path = "/orders") =>
    renderAt(
        path,
        <WithTitleBlock>
            <OrdersList />
        </WithTitleBlock>,
        { role },
    );

describe("OrdersList", () => {
    it("shows status counts in the filter segment", async () => {
        renderList();
        expect(await screen.findByRole("button", { name: /Criado\s*7/ })).toBeInTheDocument();
    });

    it("counts each status under the other active filters", async () => {
        renderList("DISPATCHER", "/orders?driverId=d1&active=true");
        await screen.findByRole("button", { name: /Criado\s*7/ });
        expect(request).toHaveBeenCalledWith(
            "GET",
            "/orders",
            undefined,
            expect.objectContaining({ status: "CREATED", driverId: "d1", active: true, limit: 1 }),
        );
    });

    it("toggles a status filter in the URL", async () => {
        renderList();
        await userEvent.click(await screen.findByRole("button", { name: /Criado\s*7/ }));
        expect(currentPath()).toBe("/orders?status=CREATED");
        expect(screen.getByRole("button", { name: /Criado\s*7/ })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
    });

    it("opens the side panel with the stop timeline when a row is selected", async () => {
        renderList();
        await userEvent.click(await screen.findByText("Armazém Toledo"));
        const panel = screen.getByRole("dialog", { name: "KJ7Q2M9XAB" });
        expect(within(panel).getByRole("list", { name: "Paradas" })).toBeInTheDocument();
        expect(await within(panel).findByText("Próxima · 12,4 km")).toBeInTheDocument();
        expect(within(panel).getByRole("link", { name: "Abrir pedido" })).toHaveAttribute(
            "href",
            "/orders/o1",
        );
    });

    it("closes the side panel when the same row is clicked again", async () => {
        renderList();
        await userEvent.click(await screen.findByText("Armazém Toledo"));
        expect(screen.getByRole("dialog", { name: "KJ7Q2M9XAB" })).toBeInTheDocument();
        await userEvent.click(screen.getAllByText("Armazém Toledo")[0]);
        expect(screen.queryByRole("dialog", { name: "KJ7Q2M9XAB" })).toBeNull();
    });

    it("navigates directly when the code is clicked", async () => {
        renderList();
        await userEvent.click(await screen.findByRole("link", { name: "KJ7Q2M9XAB" }));
        expect(currentPath()).toBe("/orders/o1");
    });

    it("builds the customer timeline from the order stops without asking for the route", async () => {
        renderList("CUSTOMER");
        await userEvent.click(await screen.findByText("Armazém Toledo"));
        const panel = screen.getByRole("dialog", { name: "KJ7Q2M9XAB" });
        const list = await within(panel).findByRole("list", { name: "Paradas" });
        expect(await within(list).findByText("Bom Preço")).toBeInTheDocument();
        expect(request).not.toHaveBeenCalledWith("GET", "/orders/o1/route");
        expect(within(panel).queryByText(/BRA2E19/)).toBeNull();
    });

    it("offers 'Novo pedido' in the title for those who can create", async () => {
        renderList();
        expect(await screen.findByRole("link", { name: /Novo pedido/ })).toHaveAttribute(
            "href",
            "/orders/new",
        );
    });
});
