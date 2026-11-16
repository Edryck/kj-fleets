import type { FeatureCollection, LineString } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { LegKind, MapLeg } from "../components/RouteLegs";
import type { MapPalette } from "./palettes";

export interface SceneArc {
    id: string;
    from: [number, number];
    to: [number, number];
    label?: string;
}

export const KJ_SOURCES = ["kj-route", "kj-arcs", "kj-comets"] as const;

type Line = FeatureCollection<LineString, { kind: LegKind }>;

const toLngLat = ([lat, lng]: [number, number]): [number, number] => [lng, lat];

export function legsToGeoJSON(legs: MapLeg[]): Line {
    return {
        type: "FeatureCollection",
        features: legs.map((leg) => ({
            type: "Feature",
            properties: { kind: leg.kind },
            geometry: { type: "LineString", coordinates: leg.points.map(toLngLat) },
        })),
    };
}

export function arcPoints(
    from: [number, number],
    to: [number, number],
    steps = 48,
): [number, number][] {
    const [lat1, lng1] = from;
    const [lat2, lng2] = to;
    const mx = (lng1 + lng2) / 2;
    const my = (lat1 + lat2) / 2;
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const cx = mx - dy * 0.28;
    const cy = my + dx * 0.28;
    const points: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        if (i === 0) points.push([lat1, lng1]);
        else if (i === steps) points.push([lat2, lng2]);
        else
            points.push([
                u * u * lat1 + 2 * u * t * cy + t * t * lat2,
                u * u * lng1 + 2 * u * t * cx + t * t * lng2,
            ]);
    }
    return points;
}

export function arcsToGeoJSON(arcs: SceneArc[], progress: number): FeatureCollection<LineString> {
    return {
        type: "FeatureCollection",
        features: arcs.map((arc) => {
            const points = arcPoints(arc.from, arc.to);
            const cut = points.slice(0, Math.max(2, Math.round(points.length * progress)));
            return {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: cut.map(toLngLat) },
            };
        }),
    };
}

const empty = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

function token(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

type PaintKey = Parameters<MapLibreMap["setPaintProperty"]>[1];
type PaintValue = Parameters<MapLibreMap["setPaintProperty"]>[2];

function paintLayers(map: MapLibreMap, palette: MapPalette): void {
    const route = token("--color-route", "#b7f52a");
    const accent = token("--color-accent", "#b7f52a");
    const set = (id: string, key: PaintKey, value: PaintValue) => {
        if (map.getLayer(id)) map.setPaintProperty(id, key, value);
    };
    set("kj-route-original", "line-color", token("--color-text-subtle", palette.label));
    set("kj-route-glow", "line-color", route);
    set("kj-route-casing", "line-color", token("--color-route-casing", palette.casing));
    set("kj-route-solid", "line-color", route);
    set("kj-route-dashed", "line-color", [
        "match",
        ["get", "kind"],
        "estimated",
        token("--color-warning", "#f2b84b"),
        route,
    ]);
    set("kj-arcs-glow", "line-color", accent);
    set("kj-arcs", "line-color", accent);
    set("kj-comets-glow", "circle-color", accent);
}

const ROUND = { "line-join": "round", "line-cap": "round" } as const;
const isKind = (kind: LegKind) => ["==", ["get", "kind"], kind] as const;

export function ensureLayers(map: MapLibreMap, palette: MapPalette): void {
    for (const id of KJ_SOURCES) {
        if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty() });
    }
    const add = (layer: Parameters<MapLibreMap["addLayer"]>[0]) => {
        if (!map.getLayer(layer.id)) map.addLayer(layer);
    };
    add({
        id: "kj-route-original",
        type: "line",
        source: "kj-route",
        filter: isKind("original") as never,
        layout: ROUND,
        paint: { "line-width": 2, "line-opacity": 0.45 },
    });
    add({
        id: "kj-route-glow",
        type: "line",
        source: "kj-route",
        filter: isKind("road") as never,
        layout: ROUND,
        paint: { "line-width": 14, "line-blur": 10, "line-opacity": 0.38 },
    });
    add({
        id: "kj-route-casing",
        type: "line",
        source: "kj-route",
        filter: isKind("road") as never,
        layout: ROUND,
        paint: { "line-width": 7 },
    });
    add({
        id: "kj-route-solid",
        type: "line",
        source: "kj-route",
        filter: isKind("road") as never,
        layout: ROUND,
        paint: { "line-width": 4 },
    });
    add({
        id: "kj-route-dashed",
        type: "line",
        source: "kj-route",
        filter: ["in", ["get", "kind"], ["literal", ["estimated", "straight"]]],
        paint: { "line-width": 3, "line-dasharray": [2, 1.6] },
    });
    add({
        id: "kj-arcs-glow",
        type: "line",
        source: "kj-arcs",
        layout: ROUND,
        paint: { "line-width": 8, "line-blur": 6, "line-opacity": 0.3 },
    });
    add({
        id: "kj-arcs",
        type: "line",
        source: "kj-arcs",
        layout: ROUND,
        paint: { "line-width": 2, "line-opacity": 0.8 },
    });
    add({
        id: "kj-comets-glow",
        type: "circle",
        source: "kj-comets",
        paint: { "circle-radius": 11, "circle-blur": 1, "circle-opacity": 0.55 },
    });
    add({
        id: "kj-comets",
        type: "circle",
        source: "kj-comets",
        paint: { "circle-radius": 3.2, "circle-color": "#ffffff" },
    });
    paintLayers(map, palette);
}

function source(map: MapLibreMap, id: (typeof KJ_SOURCES)[number]): GeoJSONSource | undefined {
    return map.getSource(id) as GeoJSONSource | undefined;
}

export function setLegData(map: MapLibreMap, legs: MapLeg[]): void {
    source(map, "kj-route")?.setData(legsToGeoJSON(legs));
}

export function setArcData(map: MapLibreMap, arcs: SceneArc[], progress = 1): void {
    source(map, "kj-arcs")?.setData(arcsToGeoJSON(arcs, progress));
}

export function setCometData(map: MapLibreMap, points: [number, number][]): void {
    source(map, "kj-comets")?.setData({
        type: "FeatureCollection",
        features: points.map((p) => ({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: toLngLat(p) },
        })),
    });
}
