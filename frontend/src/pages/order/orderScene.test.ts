import { describe, expect, it } from "vitest";
import type { Driver, OrderDetail, OrderRoute, Place } from "../../api/types";
import { ZERO } from "../../map/camera";
import { orderScene, shouldFollow } from "./orderScene";

const place = (publicId: string, name: string, lat: number, lng: number): Place => ({
    publicId,
    name,
    address: `${name}, Paraná`,
    lat,
    lng,
    contact: null,
    active: true,
});

const order: OrderDetail = {
    publicId: "o1",
    trackingNumber: "KJ7Q2M9XAB",
    status: "DISPATCHED",
    customer: { publicId: "c1", name: "Mercado Central" },
    driver: { publicId: "d1", name: "Ana Ribeiro" },
    vehicle: { publicId: "v1", plate: "BRA2E19" },
    pickup: place("p1", "Armazém", -24.72, -53.74),
    dropoff: place("p3", "CD Medianeira", -25.29, -54.09),
    waypoints: [place("p2", "Bom Preço", -24.9, -53.9)],
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
    fallbackLegs: 1,
    stops: [
        {
            seq: 1,
            type: "PICKUP",
            placeId: "p1",
            name: "Armazém",
            lat: -24.72,
            lng: -53.74,
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
            path: [
                [-24.72, -53.74],
                [-24.8, -53.82],
                [-24.9, -53.9],
            ],
        },
        {
            seq: 3,
            type: "DROPOFF",
            placeId: "p3",
            name: "CD Medianeira",
            lat: -25.29,
            lng: -54.09,
            legKm: 20.1,
            visitedAt: null,
            distanceM: 20100,
            distanceSource: "HAVERSINE",
            path: null,
        },
    ],
};

describe("shouldFollow", () => {
    it.each([
        ["DRIVER_ENROUTE", { lat: -24.86, lng: -54.33 }, true],
        ["IN_PROGRESS", { lat: -24.86, lng: -54.33 }, true],
        ["DISPATCHED", { lat: -24.86, lng: -54.33 }, false],
        ["IN_PROGRESS", { lat: null, lng: null }, false],
        ["IN_PROGRESS", null, false],
        ["COMPLETED", { lat: -24.86, lng: -54.33 }, false],
    ] as const)("%s with %o → %s", (status, position, expected) => {
        expect(shouldFollow(status, position)).toBe(expected);
    });
});

describe("orderScene", () => {
    it("shows the route overview at 30° with terrain 1.3 and animated legs", () => {
        const scene = orderScene({ order, route, driver: null, following: false, padding: ZERO });
        expect(scene.camera).toMatchObject({ fit: "legs", pitch: 30, terrain: 1.3, follow: null });
        expect(scene.animateLegs).toBe(true);
    });

    it("falls back to the stop markers when the route is missing", () => {
        const scene = orderScene({
            order,
            route: null,
            driver: null,
            following: false,
            padding: ZERO,
        });
        expect(scene.legs ?? []).toEqual([]);
        expect(scene.markers.map((m) => m.kind)).toEqual(["pickup", "waypoint", "dropoff"]);
        expect(scene.markers.map((m) => m.label)).toEqual(["R", "1", "E"]);
        expect(scene.camera?.fit).toBe("markers");
    });

    it("labels the next stop with a HUD", () => {
        const scene = orderScene({ order, route, driver: null, following: false, padding: ZERO });
        expect(scene.markers.find((m) => m.kind === "hud")?.hud).toEqual({
            label: "Próxima parada",
            value: "Bom Preço",
        });
        expect(scene.markers.find((m) => m.id === "s2")?.next).toBe(true);
    });

    it("marks estimated legs in the km pills", () => {
        const scene = orderScene({ order, route, driver: null, following: false, padding: ZERO });
        expect(scene.markers.filter((m) => m.kind === "pill").map((m) => m.pill)).toEqual([
            { text: "12,4 km", estimated: false },
            { text: "20,1 km · estimado", estimated: true },
        ]);
    });

    it("drops the HUD once the order is finished", () => {
        const scene = orderScene({
            order: { ...order, status: "COMPLETED" },
            route,
            driver: null,
            following: false,
            padding: ZERO,
        });
        expect(scene.markers.some((m) => m.kind === "hud")).toBe(false);
    });

    it("follows the vehicle marker when following", () => {
        const driver = { publicId: "d1", lat: -24.86, lng: -54.33, status: "BUSY" } as Driver;
        const scene = orderScene({
            order: { ...order, status: "IN_PROGRESS" },
            route,
            driver,
            following: true,
            padding: ZERO,
        });
        expect(scene.markers.find((m) => m.id === "vehicle")).toMatchObject({
            kind: "vehicle",
            lat: -24.86,
            lng: -54.33,
        });
        expect(scene.camera?.follow).toEqual({ markerId: "vehicle", zoom: 15.4, pitch: 68 });
    });

    it("never adds a vehicle marker without a position", () => {
        const driver = { publicId: "d1", lat: null, lng: null, status: "BUSY" } as Driver;
        const scene = orderScene({
            order: { ...order, status: "IN_PROGRESS" },
            route,
            driver,
            following: true,
            padding: ZERO,
        });
        expect(scene.markers.some((m) => m.kind === "vehicle")).toBe(false);
        expect(scene.camera?.follow).toBeNull();
    });
});
