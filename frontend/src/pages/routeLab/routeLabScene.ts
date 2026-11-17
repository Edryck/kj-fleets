import type { OptimizeResponse, RouteStop } from "../../api/types";
import { legsFromStops, type MapLeg } from "../../components/RouteLegs";
import { HOME_CENTER, type Padding } from "../../map/camera";
import type { SceneMarker } from "../../map/markers";
import type { MapScene } from "../../map/sceneStore";
import { routeMarkers } from "../liveMapScene";

export type LabPoint = { lat: number; lng: number };

export interface RouteLabSceneInput {
    start: LabPoint | null;
    pickup: LabPoint | null;
    waypoints: LabPoint[];
    dropoff: LabPoint | null;
    result: OptimizeResponse | null;
    showOriginal: boolean;
    pick: { hint: string; onPick: (lat: number, lng: number) => void };
    padding: Padding;
    frame?: LabPoint[];
}

const at = (point: LabPoint): [number, number] => [point.lat, point.lng];

const [homeLng, homeLat] = HOME_CENTER;
const HOME_FRAME: [number, number][] = [
    [homeLat - 0.3, homeLng - 0.4],
    [homeLat + 0.3, homeLng + 0.4],
];

function typedMarkers({ start, pickup, waypoints, dropoff }: RouteLabSceneInput): SceneMarker[] {
    const markers: SceneMarker[] = [];
    if (start) markers.push({ id: "start", kind: "start", label: "", ...start });
    if (pickup) markers.push({ id: "pickup", kind: "pickup", label: "R", ...pickup });
    waypoints.forEach((w, i) =>
        markers.push({ id: `w${i}`, kind: "waypoint", label: String(i + 1), ...w }),
    );
    if (dropoff) markers.push({ id: "dropoff", kind: "dropoff", label: "E", ...dropoff });
    return markers;
}

function asRouteStops(result: OptimizeResponse): RouteStop[] {
    return result.stops.map((stop) => ({
        seq: stop.seq,
        type: stop.type,
        placeId: null,
        name: "",
        lat: stop.lat,
        lng: stop.lng,
        legKm: stop.legKm,
        visitedAt: null,
        distanceM: null,
        distanceSource: stop.distanceSource,
        path: stop.path,
    }));
}

export function routeLabScene(input: RouteLabSceneInput): MapScene {
    const { start, pickup, waypoints, dropoff, result, showOriginal, pick, padding, frame } = input;
    const typed = [start, pickup, ...waypoints, dropoff].filter(
        (point): point is LabPoint => point != null,
    );
    const legs: MapLeg[] = [];
    if (showOriginal && pickup && dropoff) {
        legs.push({
            kind: "original",
            points: [start, pickup, ...waypoints, dropoff]
                .filter((point): point is LabPoint => point != null)
                .map(at),
        });
    }
    let markers = typedMarkers(input);
    if (result) {
        const stops = asRouteStops(result);
        const straight =
            result.fallbackLegs === 0 && result.stops.every((s) => s.distanceSource !== "ROAD");
        legs.push(...legsFromStops(stops, straight));
        markers = routeMarkers(stops).map((marker) => ({ ...marker, next: false }));
    }
    const framed = (frame ?? typed).map(at);
    return {
        markers,
        legs,
        animateLegs: result != null,
        pick,
        camera: {
            fit: "points",
            points: framed.length > 0 ? framed : HOME_FRAME,
            padding,
            pitch: 0,
            bearing: 0,
            terrain: 0,
            maxZoom: 13,
        },
    };
}
