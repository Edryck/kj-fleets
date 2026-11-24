import type { Driver, OrderRoute, RouteStop } from "../api/types";
import { formatKm } from "../components/format";
import { stopMarkers } from "../components/MapView";
import { legsFromStops } from "../components/RouteLegs";
import type { Padding } from "../map/camera";
import type { SceneMarker } from "../map/markers";
import type { Viewport } from "../map/responsive";
import type { MapScene } from "../map/sceneStore";
import type { SheetSnap } from "../patterns/BottomSheet";
import { initials } from "../patterns/initials";

export { initials };

export interface LiveMapSceneInput {
    drivers: Driver[];
    staleIds: ReadonlySet<string>;
    selectedId: string | null;
    route: OrderRoute | null;
    padding: Padding;
}

function legPoints(from: RouteStop, to: RouteStop): [number, number][] | null {
    if (to.path && to.path.length > 1) return to.path;
    if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return null;
    return [
        [from.lat, from.lng],
        [to.lat, to.lng],
    ];
}

export function midpointOf(points: [number, number][]): [number, number] {
    if (points.length === 1) return points[0];
    const scale = Math.cos((points[0][0] * Math.PI) / 180);
    const lengths = points
        .slice(1)
        .map((p, i) => Math.hypot(p[0] - points[i][0], (p[1] - points[i][1]) * scale));
    let remaining = lengths.reduce((sum, l) => sum + l, 0) / 2;
    for (let i = 0; i < lengths.length; i++) {
        if (remaining <= lengths[i] && lengths[i] > 0) {
            const f = remaining / lengths[i];
            const [a, b] = [points[i], points[i + 1]];
            return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        }
        remaining -= lengths[i];
    }
    return points[points.length - 1];
}

export function routeMarkers(stops: RouteStop[]): SceneMarker[] {
    const nextSeq = stops.find((s) => s.visitedAt == null && s.type !== "START")?.seq;
    const markers: SceneMarker[] = stopMarkers(stops).map((m) => ({
        ...m,
        next: m.id === `s${nextSeq}`,
    }));
    for (let i = 1; i < stops.length; i++) {
        const to = stops[i];
        const points = legPoints(stops[i - 1], to);
        if (!points || to.legKm == null || to.legKm < 0.05) continue;
        const estimated = !(to.path && to.path.length > 1);
        const [lat, lng] = midpointOf(points);
        markers.push({
            id: `km-${to.seq}`,
            kind: "pill",
            lat,
            lng,
            pill: {
                text: `${formatKm(to.legKm)}${estimated ? " · estimado" : ""}`,
                estimated,
            },
        });
    }
    return markers;
}

export function liveMapScene({
    drivers,
    staleIds,
    selectedId,
    route,
    padding,
}: LiveMapSceneInput): MapScene {
    const driverMarkers: SceneMarker[] = drivers
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
            id: d.publicId,
            kind: "driver",
            lat: d.lat as number,
            lng: d.lng as number,
            label: initials(d.name),
            title: d.vehicle ? `${d.name} · ${d.vehicle.plate}` : d.name,
            status: d.status,
            selected: d.publicId === selectedId,
            stale: staleIds.has(d.publicId),
        }));
    const stops = route?.stops ?? [];
    return {
        markers: [...driverMarkers, ...routeMarkers(stops)],
        legs: legsFromStops(stops, false),
        camera: {
            fit: stops.length > 1 ? "legs" : "markers",
            padding,
            pitch: 0,
            terrain: 0,
            flat: true,
        },
    };
}

export function livePadding(viewport: Viewport, snap: SheetSnap, height: number): Padding {
    if (viewport === "full") return { top: 170, bottom: 170, left: 150, right: 400 };
    if (viewport === "compact") return { top: 220, bottom: 160, left: 120, right: 400 };
    const phone = viewport === "phone";
    const bottom = snap === "half" ? Math.round(height * 0.48) + (phone ? 30 : 40) : 130;
    return phone
        ? { top: 300, bottom, left: 40, right: 40 }
        : { top: 230, bottom, left: 60, right: 80 };
}
