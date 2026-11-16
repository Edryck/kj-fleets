import type { DriverStatus, OrderDetail, PlanResponse } from "../api/types";
import { formatKm } from "../components/format";
import type { Padding } from "../map/camera";
import { arcPoints, type SceneArc } from "../map/mapLayers";
import type { SceneMarker } from "../map/markers";
import type { MapScene } from "../map/sceneStore";
import { initials } from "./liveMapScene";

export interface DispatchDriver {
    id: string;
    name: string;
    status: DriverStatus;
    lat: number | null;
    lng: number | null;
}

export interface DispatchSceneInput {
    orders: OrderDetail[];
    staleIds: ReadonlyMap<string, number>;
    drivers: DispatchDriver[];
    selectedOrderId: string | null;
    plan: PlanResponse | null;
    selection: ReadonlySet<string>;
    padding: Padding;
}

type Point = [number, number];

function pointOf(place: { lat: number | null; lng: number | null }): Point | null {
    return place.lat == null || place.lng == null ? null : [place.lat, place.lng];
}

function orderMarkers(input: DispatchSceneInput): SceneMarker[] {
    const list: SceneMarker[] = [];
    for (const order of input.orders) {
        const at = pointOf(order.pickup);
        if (!at) continue;
        list.push({
            id: order.publicId,
            lat: at[0],
            lng: at[1],
            kind: "order",
            label: "R",
            title: `${order.trackingNumber} · ${order.pickup.name}`,
            stale: input.staleIds.has(order.publicId),
            selected:
                input.selection.has(order.publicId) || input.selectedOrderId === order.publicId,
        });
    }
    return list;
}

function staleHud(input: DispatchSceneInput, positioned: Map<string, Point>): SceneMarker[] {
    let worst: [string, number] | null = null;
    for (const [id, minutes] of input.staleIds) {
        if (positioned.has(id) && (!worst || minutes > worst[1])) worst = [id, minutes];
    }
    if (!worst) return [];
    const [id, minutes] = worst;
    const at = positioned.get(id)!;
    return [
        {
            id: `hud-${id}`,
            lat: at[0],
            lng: at[1],
            kind: "hud",
            hud: { label: "Parado", value: `${minutes} min`, warn: true },
        },
    ];
}

function selectedStops(order: OrderDetail | undefined): SceneMarker[] {
    if (!order) return [];
    const list: SceneMarker[] = [];
    order.waypoints.forEach((place, index) => {
        const at = pointOf(place);
        if (!at) return;
        list.push({
            id: `stop-${order.publicId}-${index}`,
            lat: at[0],
            lng: at[1],
            kind: "waypoint",
            label: String(index + 1),
            title: place.name,
        });
    });
    const drop = pointOf(order.dropoff);
    if (drop) {
        list.push({
            id: `stop-${order.publicId}-drop`,
            lat: drop[0],
            lng: drop[1],
            kind: "dropoff",
            label: "E",
            title: order.dropoff.name,
        });
    }
    return list;
}

function driverMarkers(drivers: DispatchDriver[]): SceneMarker[] {
    const list: SceneMarker[] = [];
    for (const d of drivers) {
        if (d.lat == null || d.lng == null || d.status === "OFFLINE") continue;
        list.push({
            id: `driver-${d.id}`,
            lat: d.lat,
            lng: d.lng,
            kind: "driver",
            label: initials(d.name),
            title: d.name,
            status: d.status,
        });
    }
    return list;
}

function planArcs(
    input: DispatchSceneInput,
    positioned: Map<string, Point>,
): { arcs: SceneArc[]; pills: SceneMarker[] } {
    const arcs: SceneArc[] = [];
    const pills: SceneMarker[] = [];
    if (!input.plan) return { arcs, pills };
    const drivers = new Map(input.drivers.map((d) => [d.id, d]));
    for (const a of input.plan.assignments) {
        if (input.selection.size > 0 && !input.selection.has(a.orderId)) continue;
        const to = positioned.get(a.orderId);
        const driver = drivers.get(a.driverId);
        if (!to || !driver || driver.lat == null || driver.lng == null) continue;
        const from: Point = [driver.lat, driver.lng];
        const label = formatKm(a.km);
        arcs.push({ id: a.orderId, from, to, label });
        if (a.km < 0.05) continue;
        const curve = arcPoints(from, to);
        const mid = curve[Math.floor(curve.length / 2)];
        pills.push({
            id: `pill-${a.orderId}`,
            lat: mid[0],
            lng: mid[1],
            kind: "pill",
            pill: { text: label },
        });
    }
    return { arcs, pills };
}

export function dispatchScene(input: DispatchSceneInput): MapScene {
    const orders = orderMarkers(input);
    const positioned = new Map<string, Point>(orders.map((m) => [m.id, [m.lat, m.lng]]));
    const selected = input.orders.find((o) => o.publicId === input.selectedOrderId);
    const stops = selectedStops(selected);
    const drivers = driverMarkers(input.drivers);
    const { arcs, pills } = planArcs(input, positioned);
    const points: Point[] = [
        ...orders.map((m): Point => [m.lat, m.lng]),
        ...stops.map((m): Point => [m.lat, m.lng]),
        ...arcs.map((a) => a.from),
    ];
    return {
        markers: [...drivers, ...orders, ...staleHud(input, positioned), ...stops, ...pills],
        legs: [],
        arcs,
        comets: arcs.length > 0 ? 2 : undefined,
        camera: { fit: "points", points, padding: input.padding, pitch: 0, terrain: 0 },
    };
}
