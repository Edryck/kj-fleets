import { describe, expect, it, vi } from "vitest";
import type { OptimizeResponse } from "../../api/types";
import { ZERO } from "../../map/camera";
import { routeLabScene } from "./routeLabScene";

const p = (lat: number, lng: number) => ({ lat, lng });
const pick = { hint: "Clique no mapa para marcar a retirada", onPick: vi.fn() };
const base = {
    start: null,
    pickup: p(-24.86, -54.33),
    waypoints: [p(-24.9, -54.3), p(-25.0, -54.2)],
    dropoff: p(-25.09, -54.24),
    result: null,
    showOriginal: true,
    pick,
    padding: ZERO,
};

const result: OptimizeResponse = {
    algorithm: "TWO_OPT",
    totalKm: 41.9,
    baselineKm: 51.8,
    savingsPct: 19.1,
    etaMinutes: 64,
    comparison: null,
    fallbackLegs: 1,
    stops: [
        {
            seq: 0,
            type: "PICKUP",
            lat: -24.86,
            lng: -54.33,
            legKm: 0,
            waypointIndex: null,
            distanceSource: null,
            path: null,
        },
        {
            seq: 1,
            type: "WAYPOINT",
            lat: -25.0,
            lng: -54.2,
            legKm: 4.2,
            waypointIndex: 1,
            distanceSource: "ROAD",
            path: [
                [-24.86, -54.33],
                [-24.95, -54.26],
                [-25.0, -54.2],
            ],
        },
        {
            seq: 2,
            type: "WAYPOINT",
            lat: -24.9,
            lng: -54.3,
            legKm: 8,
            waypointIndex: 0,
            distanceSource: "HAVERSINE",
            path: null,
        },
        {
            seq: 3,
            type: "DROPOFF",
            lat: -25.09,
            lng: -54.24,
            legKm: 29.7,
            waypointIndex: null,
            distanceSource: "ROAD",
            path: [
                [-24.9, -54.3],
                [-25.0, -54.27],
                [-25.09, -54.24],
            ],
        },
    ],
};

describe("routeLabScene", () => {
    it("marks typed points and keeps pick mode on", () => {
        const scene = routeLabScene(base);
        expect(scene.markers.map((m) => m.label)).toEqual(["R", "1", "2", "E"]);
        expect(scene.pick?.hint).toBe(pick.hint);
        expect(scene.camera).toMatchObject({ pitch: 0, terrain: 0 });
    });

    it("draws the original order as straight lines in typed order", () => {
        const scene = routeLabScene(base);
        const original = scene.legs?.filter((l) => l.kind === "original") ?? [];
        expect(original).toHaveLength(1);
        expect(original[0].points).toEqual([
            [-24.86, -54.33],
            [-24.9, -54.3],
            [-25.0, -54.2],
            [-25.09, -54.24],
        ]);
    });

    it("hides the original layer when toggled off", () => {
        expect(routeLabScene({ ...base, showOriginal: false }).legs ?? []).toEqual([]);
    });

    it("draws the optimized route progressively with km pills and renumbers stops by result order", () => {
        const scene = routeLabScene({ ...base, result });
        expect(scene.animateLegs).toBe(true);
        expect(scene.legs?.map((l) => l.kind)).toEqual(["original", "road", "estimated", "road"]);
        expect(scene.markers.filter((m) => m.kind === "pill").map((m) => m.pill?.text)).toEqual([
            "4,2 km",
            "8 km · estimado",
            "29,7 km",
        ]);
        expect(scene.markers.filter((m) => m.kind === "waypoint").map((m) => m.label)).toEqual([
            "1",
            "2",
        ]);
    });

    it("needs at least pickup and dropoff for the original layer", () => {
        expect(routeLabScene({ ...base, dropoff: null }).legs ?? []).toEqual([]);
    });

    it("fits the typed points, including the start, and never pulses a stop", () => {
        const scene = routeLabScene({ ...base, start: p(-24.8, -54.4), result });
        expect(scene.camera?.fit).toBe("points");
        expect(scene.camera?.points?.[0]).toEqual([-24.8, -54.4]);
        expect(scene.markers.some((m) => m.next)).toBe(false);
    });

    it("draws straight lines when the API answered without road legs", () => {
        const straight: OptimizeResponse = {
            ...result,
            fallbackLegs: 0,
            stops: result.stops.map((stop) => ({
                ...stop,
                path: null,
                distanceSource: stop.distanceSource && "HAVERSINE",
            })),
        };
        const scene = routeLabScene({ ...base, showOriginal: false, result: straight });
        expect(scene.legs?.map((l) => l.kind)).toEqual(["straight", "straight", "straight"]);
    });

    it("keeps the camera on the given frame while points are added", () => {
        const frame = [p(-24.7, -54.5), p(-25.2, -54.0)];
        const scene = routeLabScene({ ...base, frame });
        expect(scene.camera?.points).toEqual([
            [-24.7, -54.5],
            [-25.2, -54.0],
        ]);
        const more = routeLabScene({
            ...base,
            waypoints: [...base.waypoints, p(-25, -54.1)],
            frame,
        });
        expect(more.camera).toEqual(scene.camera);
    });

    it("levels the map over the home region when there is nothing to frame", () => {
        const scene = routeLabScene({ ...base, frame: [] });
        expect(scene.camera?.fit).toBe("points");
        expect(scene.camera?.points).toHaveLength(2);
        expect(scene.camera).toMatchObject({ pitch: 0, bearing: 0 });
        const empty = routeLabScene({ ...base, pickup: null, waypoints: [], dropoff: null });
        expect(empty.camera?.points).toEqual(scene.camera?.points);
    });
});
