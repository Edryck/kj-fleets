import type { LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import type { MapLeg } from "../components/RouteLegs";

export interface Padding {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export const ZERO: Padding = { top: 0, bottom: 0, left: 0, right: 0 };

export const HOME_CENTER: [number, number] = [-54.18, -24.93];

export interface SceneCamera {
    fit: "markers" | "legs" | "points" | null;
    points?: [number, number][];
    padding?: Padding;
    pitch?: number;
    bearing?: number;
    maxZoom?: number;
    terrain?: number;
    // sem relevo sombreado nem prédios 3D: menos tiles e menos GPU (Mapa ao vivo)
    flat?: boolean;
    intro?: "spin" | null;
    follow?: { markerId: string; zoom: number; pitch: number } | null;
    duration?: number;
}

export type CameraMap = Pick<
    MapLibreMap,
    | "stop"
    | "setPadding"
    | "cameraForBounds"
    | "flyTo"
    | "easeTo"
    | "setTerrain"
    | "getLayer"
    | "setLayoutProperty"
>;

export function headingOf(a: [number, number], b: [number, number]): number {
    const y = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
    const x = b[0] - a[0];
    return (Math.atan2(y, x) * 180) / Math.PI;
}

export function followBearing(
    position: [number, number],
    legs: MapLeg[],
    ahead = 3,
): number | null {
    const points = legs.flatMap((leg) => leg.points);
    if (points.length < 2) return null;
    let nearest = 0;
    let best = Infinity;
    points.forEach(([lat, lng], i) => {
        const d = (lat - position[0]) ** 2 + (lng - position[1]) ** 2;
        if (d < best) {
            best = d;
            nearest = i;
        }
    });
    if (nearest === points.length - 1) return headingOf(points[nearest - 1], points[nearest]);
    return headingOf(points[nearest], points[Math.min(points.length - 1, nearest + ahead)]);
}

function boundsOf(points: [number, number][]): LngLatBoundsLike {
    let minLat = Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let maxLng = -Infinity;
    for (const [lat, lng] of points) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    }
    return [
        [minLng, minLat],
        [maxLng, maxLat],
    ];
}

export function flyToScene(
    map: CameraMap,
    points: [number, number][],
    camera: SceneCamera,
    reduce: boolean,
): void {
    if (points.length === 0) return;
    const bearing = camera.bearing ?? 0;
    map.stop();
    map.setPadding(ZERO);
    const target = map.cameraForBounds(boundsOf(points), {
        padding: camera.padding ?? ZERO,
        bearing,
        maxZoom: camera.maxZoom ?? 12.5,
    });
    if (!target) return;
    map.flyTo({
        ...target,
        pitch: camera.pitch ?? 0,
        bearing,
        padding: ZERO,
        duration: reduce ? 0 : (camera.duration ?? 1600),
        curve: 1.4,
        essential: true,
    });
}

export function applyTerrain(map: CameraMap, exaggeration: number | undefined, flat = false): void {
    map.setTerrain(exaggeration && exaggeration > 0 ? { source: "dem", exaggeration } : null);
    // camada escondida não baixa tiles: é isso que deixa o mapa plano mais leve
    for (const id of ["relief", "building-3d"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", flat ? "none" : "visible");
    }
}

export function followTo(
    map: CameraMap,
    position: [number, number],
    legs: MapLeg[],
    follow: NonNullable<SceneCamera["follow"]>,
    first: boolean,
    reduce: boolean,
    padding: Padding = ZERO,
): void {
    const center: [number, number] = [position[1], position[0]];
    const bearing = followBearing(position, legs);
    if (first) {
        map.flyTo({
            center,
            zoom: follow.zoom,
            pitch: follow.pitch,
            bearing: bearing ?? 0,
            padding,
            duration: reduce ? 0 : 3400,
            curve: 1.2,
            essential: true,
        });
        return;
    }
    map.easeTo({
        center,
        ...(bearing === null ? {} : { bearing }),
        padding,
        duration: reduce ? 0 : 800,
        essential: true,
    });
}
