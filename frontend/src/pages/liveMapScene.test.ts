import { describe, expect, it } from "vitest";
import type { Driver, OrderRoute } from "../api/types";
import { ZERO } from "../map/camera";
import { liveMapScene, livePadding } from "./liveMapScene";

const driver = (id: string, extra: Partial<Driver> = {}): Driver => ({
    publicId: id,
    username: id,
    name: "Marcos Vieira",
    phone: null,
    licenseNumber: null,
    status: "BUSY",
    lat: -24.865,
    lng: -54.331,
    lastSeenAt: null,
    fleets: [],
    vehicle: null,
    active: true,
    ...extra,
});

describe("liveMapScene", () => {
    it("drops drivers without a position", () => {
        const scene = liveMapScene({
            drivers: [driver("d1"), driver("d2", { lat: null, lng: null })],
            staleIds: new Set(),
            selectedId: null,
            route: null,
            padding: ZERO,
        });
        expect(scene.markers.map((m) => m.id)).toEqual(["d1"]);
    });

    it("marks the selected driver and labels it with initials", () => {
        const scene = liveMapScene({
            drivers: [driver("d1")],
            staleIds: new Set(["d1"]),
            selectedId: "d1",
            route: null,
            padding: ZERO,
        });
        expect(scene.markers[0]).toMatchObject({
            kind: "driver",
            selected: true,
            status: "BUSY",
            label: "MV",
            stale: true,
        });
    });

    it("adds the selected route with stops, legs and km pills only where legKm exists", () => {
        const route = {
            stops: [
                {
                    seq: 0,
                    type: "PICKUP",
                    name: "A",
                    lat: -24.86,
                    lng: -54.33,
                    legKm: null,
                    visitedAt: "x",
                    path: null,
                },
                {
                    seq: 1,
                    type: "DROPOFF",
                    name: "B",
                    lat: -25.09,
                    lng: -54.24,
                    legKm: 29.7,
                    visitedAt: null,
                    path: [
                        [-24.86, -54.33],
                        [-25.0, -54.3],
                        [-25.09, -54.24],
                    ],
                },
                {
                    seq: 2,
                    type: "DROPOFF",
                    name: "C",
                    lat: -25.29,
                    lng: -54.09,
                    legKm: null,
                    visitedAt: null,
                    path: null,
                },
            ],
        } as unknown as OrderRoute;
        const scene = liveMapScene({
            drivers: [driver("d1")],
            staleIds: new Set(),
            selectedId: "d1",
            route,
            padding: ZERO,
        });
        expect(scene.legs?.map((l) => l.kind)).toEqual(["road", "estimated"]);
        expect(scene.legs?.[0].points).toEqual([
            [-24.86, -54.33],
            [-25.0, -54.3],
            [-25.09, -54.24],
        ]);
        expect(scene.legs?.[1].points).toEqual([
            [-25.09, -54.24],
            [-25.29, -54.09],
        ]);
        expect(scene.markers.filter((m) => m.kind === "pill").map((m) => m.pill?.text)).toEqual([
            "29,7 km",
        ]);
        expect(scene.markers.find((m) => m.title === "A")?.dimmed).toBe(true);
    });

    it("skips the km pill on a zero-length leg", () => {
        const route = {
            stops: [
                {
                    seq: 0,
                    type: "START",
                    name: null,
                    lat: -25.13,
                    lng: -54.3,
                    legKm: 0,
                    visitedAt: null,
                    path: null,
                },
                {
                    seq: 1,
                    type: "PICKUP",
                    name: "A",
                    lat: -25.13,
                    lng: -54.3,
                    legKm: 0,
                    visitedAt: null,
                    path: null,
                },
                {
                    seq: 2,
                    type: "DROPOFF",
                    name: "B",
                    lat: -25.3,
                    lng: -54.2,
                    legKm: 31.9,
                    visitedAt: null,
                    path: null,
                },
            ],
        } as unknown as OrderRoute;
        const scene = liveMapScene({
            drivers: [],
            staleIds: new Set(),
            selectedId: null,
            route,
            padding: ZERO,
        });
        expect(scene.markers.filter((m) => m.kind === "pill").map((m) => m.pill?.text)).toEqual([
            "31,9 km · estimado",
        ]);
    });

    it("keeps the camera still for moving drivers and fits markers once", () => {
        const scene = liveMapScene({
            drivers: [driver("d1")],
            staleIds: new Set(),
            selectedId: null,
            route: null,
            padding: ZERO,
        });
        expect(scene.camera).toMatchObject({ fit: "markers", pitch: 0, terrain: 0 });
    });
});

describe("livePadding", () => {
    it("keeps the wide layout padding beside the side column", () => {
        expect(livePadding("full", "half", 900)).toEqual({
            top: 170,
            bottom: 170,
            left: 150,
            right: 400,
        });
        expect(livePadding("compact", "half", 820)).toEqual({
            top: 220,
            bottom: 160,
            left: 120,
            right: 400,
        });
    });

    it("frames the map above the sheet on tablets and phones", () => {
        expect(livePadding("tablet", "half", 1000)).toMatchObject({ bottom: 520, right: 80 });
        expect(livePadding("phone", "half", 844)).toMatchObject({
            top: 300,
            bottom: 435,
            left: 40,
        });
        expect(livePadding("phone", "collapsed", 844).bottom).toBe(130);
        expect(livePadding("phone", "full", 844).bottom).toBe(130);
    });
});
