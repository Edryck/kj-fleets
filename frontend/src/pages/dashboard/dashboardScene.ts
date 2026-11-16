import type { DriverRow } from "../../api/types";
import type { Padding } from "../../map/camera";
import type { SceneMarker } from "../../map/markers";
import type { MapScene } from "../../map/sceneStore";
import { initials } from "../liveMapScene";

export interface DashboardSceneInput {
    drivers: DriverRow[];
    now: number;
    padding: Padding;
    frame?: [number, number][];
}

const MINUTE = 60_000;

export function staleLabel(lastSeenAt: string | null, now: number): string {
    if (!lastSeenAt) return "sem sinal";
    const minutes = Math.max(0, Math.floor((now - Date.parse(lastSeenAt)) / MINUTE));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    return `${Math.floor(hours / 24)} d`;
}

export function dashboardScene({ drivers, now, padding, frame }: DashboardSceneInput): MapScene {
    const markers: SceneMarker[] = [];
    const huds: SceneMarker[] = [];
    const points: [number, number][] = [];
    for (const d of drivers) {
        if (d.lat == null || d.lng == null) continue;
        points.push([d.lat, d.lng]);
        markers.push({
            id: d.driverId,
            lat: d.lat,
            lng: d.lng,
            kind: "driver",
            label: initials(d.name),
            title: d.vehiclePlate ? `${d.name} · ${d.vehiclePlate}` : d.name,
            status: d.status,
            stale: d.pingStale,
        });
        if (d.pingStale) {
            huds.push({
                id: `hud-${d.driverId}`,
                lat: d.lat,
                lng: d.lng,
                kind: "hud",
                hud: { label: "Sem sinal", value: staleLabel(d.lastSeenAt, now), warn: true },
            });
        }
    }
    return {
        markers: [...markers, ...huds],
        camera: {
            fit: "points",
            points: frame ?? points,
            padding,
            pitch: 73,
            bearing: -24,
            terrain: 2.4,
            intro: "spin",
            maxZoom: 10.4,
        },
    };
}
