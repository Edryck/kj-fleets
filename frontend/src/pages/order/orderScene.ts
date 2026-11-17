import type { Driver, OrderDetail, OrderRoute, OrderStatus, Place } from "../../api/types";
import { legsFromStops } from "../../components/RouteLegs";
import type { Padding } from "../../map/camera";
import type { SceneMarker } from "../../map/markers";
import type { MapScene } from "../../map/sceneStore";
import { routeMarkers } from "../liveMapScene";

const FOLLOWED: readonly OrderStatus[] = ["DRIVER_ENROUTE", "IN_PROGRESS"];
const FINISHED: readonly OrderStatus[] = ["COMPLETED", "CANCELLED", "FAILED"];

export const FOLLOW = { markerId: "vehicle", zoom: 15.4, pitch: 68 };

type Position = { lat: number | null; lng: number | null } | null;

export function shouldFollow(status: OrderStatus, position: Position): boolean {
    return FOLLOWED.includes(status) && position?.lat != null && position?.lng != null;
}

function placeMarker(
    p: Place,
    id: string,
    kind: SceneMarker["kind"],
    label: string,
): SceneMarker[] {
    if (p.lat == null || p.lng == null) return [];
    return [{ id, kind, label, title: p.name, lat: p.lat, lng: p.lng }];
}

function orderMarkers(order: OrderDetail): SceneMarker[] {
    return [
        ...placeMarker(order.pickup, "pickup", "pickup", "R"),
        ...order.waypoints.flatMap((w, i) =>
            placeMarker(w, `w${i + 1}`, "waypoint", String(i + 1)),
        ),
        ...placeMarker(order.dropoff, "dropoff", "dropoff", "E"),
    ];
}

export interface OrderSceneInput {
    order: OrderDetail;
    route: OrderRoute | null;
    driver: Driver | null;
    following: boolean;
    padding: Padding;
}

export function orderScene({
    order,
    route,
    driver,
    following,
    padding,
}: OrderSceneInput): MapScene {
    const stops = route?.stops ?? [];
    const finished = FINISHED.includes(order.status);
    const markers = stops.length > 0 ? routeMarkers(stops) : orderMarkers(order);
    const next = finished
        ? undefined
        : stops.find((s) => s.visitedAt == null && s.type !== "START");
    if (next && next.lat != null && next.lng != null) {
        markers.push({
            id: "hud-next",
            kind: "hud",
            lat: next.lat,
            lng: next.lng,
            hud: { label: "Próxima parada", value: next.name },
        });
    }
    const located = driver?.lat != null && driver?.lng != null;
    if (driver && located && !finished) {
        markers.push({
            id: "vehicle",
            kind: "vehicle",
            lat: driver.lat as number,
            lng: driver.lng as number,
            title: order.vehicle?.plate ?? driver.name,
            status: driver.status,
        });
    }
    const legs = legsFromStops(stops, false);
    return {
        markers,
        legs,
        animateLegs: true,
        camera: {
            fit: legs.length > 0 ? "legs" : "markers",
            padding,
            pitch: 30,
            terrain: 1.3,
            follow: following && shouldFollow(order.status, driver) ? FOLLOW : null,
        },
    };
}
