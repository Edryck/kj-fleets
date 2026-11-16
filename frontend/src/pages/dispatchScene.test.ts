import { describe, expect, it } from "vitest";
import type { OrderDetail, Place, PlanResponse } from "../api/types";
import { ZERO } from "../map/camera";
import { dispatchScene, type DispatchDriver } from "./dispatchScene";

const place = (lat: number | null, lng: number | null, name = "Ponto"): Place => ({
    publicId: `p${lat}${lng}`,
    name,
    address: "",
    lat,
    lng,
    contact: null,
    active: true,
});

const order = (id: string, extra: Partial<OrderDetail> = {}): OrderDetail =>
    ({
        publicId: id,
        trackingNumber: `KJ${id.toUpperCase()}`,
        status: "CREATED",
        customer: null,
        driver: null,
        vehicle: null,
        pickup: place(-24.86, -54.33, "Santa Helena"),
        dropoff: place(-25.09, -54.24, "Missal"),
        waypoints: [],
        items: [],
        podRequired: false,
        podValue: null,
        podAt: null,
        reason: null,
        ...extra,
    }) as OrderDetail;

const drv = (id: string, extra: Partial<DispatchDriver> = {}): DispatchDriver => ({
    id,
    name: "Marcos Vieira",
    status: "AVAILABLE",
    lat: -24.95,
    lng: -54.2,
    ...extra,
});

const base = {
    orders: [] as OrderDetail[],
    staleIds: new Map<string, number>(),
    drivers: [] as DispatchDriver[],
    selectedOrderId: null,
    plan: null,
    selection: new Set<string>(),
    padding: ZERO,
};

describe("dispatchScene", () => {
    it("shows each queued pickup, flags stale orders and adds a 'Parado' HUD", () => {
        const scene = dispatchScene({
            ...base,
            orders: [order("o1"), order("o2")],
            staleIds: new Map([["o1", 42]]),
        });
        const o1 = scene.markers.find((m) => m.id === "o1")!;
        expect(o1).toMatchObject({ kind: "order", label: "R", stale: true });
        expect(scene.markers.find((m) => m.id === "hud-o1")?.hud).toEqual({
            label: "Parado",
            value: "42 min",
            warn: true,
        });
    });

    it("draws the selected order's stops without a line between them", () => {
        const scene = dispatchScene({
            ...base,
            orders: [order("o1", { waypoints: [place(-24.9, -54.3)] })],
            selectedOrderId: "o1",
        });
        expect(scene.markers.filter((m) => m.kind === "waypoint")).toHaveLength(1);
        expect(scene.markers.some((m) => m.kind === "dropoff")).toBe(true);
        expect(scene.legs ?? []).toEqual([]);
    });

    it("adds plan arcs with km pills for selected orders only after planning", () => {
        const plan = {
            applied: false,
            assignments: [{ orderId: "o1", driverId: "d1", vehicleId: "v1", km: 16.4 }],
        } as PlanResponse;
        const scene = dispatchScene({
            ...base,
            orders: [order("o1")],
            drivers: [drv("d1")],
            plan,
            selection: new Set(["o1"]),
        });
        expect(scene.arcs).toEqual([
            {
                id: "o1",
                from: [drv("d1").lat, drv("d1").lng],
                to: [order("o1").pickup.lat, order("o1").pickup.lng],
                label: "16,4 km",
            },
        ]);
        expect(scene.comets).toBe(2);
        expect(scene.markers.find((m) => m.id === "pill-o1")?.pill?.text).toBe("16,4 km");
    });

    it("skips the km pill when the driver is already at the pickup", () => {
        const plan = {
            applied: false,
            assignments: [{ orderId: "o1", driverId: "d1", vehicleId: "v1", km: 0.02 }],
        } as PlanResponse;
        const scene = dispatchScene({
            ...base,
            orders: [order("o1")],
            drivers: [drv("d1")],
            plan,
            selection: new Set(["o1"]),
        });
        expect(scene.arcs).toHaveLength(1);
        expect(scene.markers.some((m) => m.kind === "pill")).toBe(false);
    });

    it("is a flat planning table", () => {
        expect(dispatchScene(base).camera).toMatchObject({ pitch: 0, terrain: 0, fit: "points" });
    });

    it("skips orders and drivers without coordinates", () => {
        const scene = dispatchScene({
            ...base,
            orders: [order("o1", { pickup: place(null, null) })],
            drivers: [drv("d1", { lat: null, lng: null })],
        });
        expect(scene.markers).toEqual([]);
    });
});
