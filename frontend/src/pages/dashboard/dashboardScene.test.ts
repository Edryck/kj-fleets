import { describe, expect, it } from "vitest";
import type { DriverRow } from "../../api/types";
import { ZERO } from "../../map/camera";
import { dashboardScene, staleLabel } from "./dashboardScene";

const row = (id: string, extra: Partial<DriverRow> = {}): DriverRow => ({
    driverId: id,
    name: "Rafael Lima",
    status: "BUSY",
    vehiclePlate: "RHN7C02",
    vehicleStatus: "IN_USE",
    activeOrderId: null,
    queueSize: 0,
    lastSeenAt: "2026-11-16T12:51:00Z",
    pingStale: false,
    lat: -24.56,
    lng: -54.06,
    ...extra,
});
const now = Date.parse("2026-11-16T13:00:00Z");

describe("dashboardScene", () => {
    it("labels stale pings in minutes or hours", () => {
        expect(staleLabel("2026-11-16T12:51:00Z", now)).toBe("9 min");
        expect(staleLabel("2026-11-16T10:40:00Z", now)).toBe("2 h");
        expect(staleLabel(null, now)).toBe("sem sinal");
    });

    it("labels pings older than a day in days", () => {
        expect(staleLabel("2026-11-13T12:00:00Z", now)).toBe("3 d");
    });

    it("adds a 'Sem sinal' HUD over stale drivers only", () => {
        const scene = dashboardScene({
            drivers: [row("d3", { pingStale: true }), row("d4")],
            now,
            padding: ZERO,
        });
        expect(scene.markers.find((m) => m.id === "hud-d3")?.hud).toEqual({
            label: "Sem sinal",
            value: "9 min",
            warn: true,
        });
        expect(scene.markers.find((m) => m.id === "hud-d4")).toBeUndefined();
    });

    it("marks each driver by status with initials and keeps the driver id", () => {
        const scene = dashboardScene({
            drivers: [row("d1", { status: "AVAILABLE", pingStale: true })],
            now,
            padding: ZERO,
        });
        expect(scene.markers.find((m) => m.id === "d1")).toMatchObject({
            kind: "driver",
            label: "RL",
            status: "AVAILABLE",
            stale: true,
        });
    });

    it("drops drivers without position", () => {
        const scene = dashboardScene({
            drivers: [row("d1", { lat: null, lng: null, pingStale: true })],
            now,
            padding: ZERO,
        });
        expect(scene.markers).toEqual([]);
    });

    it("uses the aerial camera with terrain and the intro spin", () => {
        expect(dashboardScene({ drivers: [row("d1")], now, padding: ZERO }).camera).toMatchObject({
            fit: "points",
            pitch: 73,
            bearing: -24,
            terrain: 2.4,
            intro: "spin",
            maxZoom: 10.4,
        });
    });
    it("frames the camera on the given points so moving drivers keep it still", () => {
        const frame: [number, number][] = [
            [-24.5, -54.0],
            [-24.9, -54.4],
        ];
        const scene = dashboardScene({
            drivers: [row("d1", { lat: -24.62, lng: -54.11 })],
            now,
            padding: ZERO,
            frame,
        });
        expect(scene.camera?.points).toBe(frame);
        expect(scene.markers[0]).toMatchObject({ lat: -24.62, lng: -54.11 });
    });
});
