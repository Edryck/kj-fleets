import { LngLatBounds } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { RouteStop } from "../api/types";
import { SOUTH_BOUNDS } from "../map/camera";
import { ensureLayers, setLegData } from "../map/mapLayers";
import {
    currentTheme,
    loadStyleOrFallback,
    MapLibreMap,
    NavigationControl,
    observeTheme,
    switchStyle,
} from "../map/maplibre";
import { PALETTES } from "../map/mapStyle";
import { createMarkerLayer, type MarkerLayer } from "../map/markers";
import { MapLegend, type MapLeg } from "./RouteLegs";

export interface MapMarker {
    id: string;
    lat: number;
    lng: number;
    kind: "pickup" | "waypoint" | "dropoff" | "driver" | "start";
    label?: string;
    title?: string;
    dimmed?: boolean;
    status?: "AVAILABLE" | "BUSY" | "OFFLINE";
    selected?: boolean;
}

export function stopMarkers(stops: RouteStop[]): MapMarker[] {
    const list: MapMarker[] = [];
    let waypointNumber = 0;
    for (const s of stops) {
        if (s.lat == null || s.lng == null) continue;
        if (s.type === "WAYPOINT") waypointNumber++;
        list.push({
            id: `s${s.seq}`,
            lat: s.lat,
            lng: s.lng,
            kind:
                s.type === "PICKUP"
                    ? "pickup"
                    : s.type === "DROPOFF"
                      ? "dropoff"
                      : s.type === "START"
                        ? "start"
                        : "waypoint",
            label:
                s.type === "PICKUP"
                    ? "R"
                    : s.type === "DROPOFF"
                      ? "E"
                      : s.type === "WAYPOINT"
                        ? String(waypointNumber)
                        : "",
            title: s.name,
            dimmed: s.visitedAt != null,
        });
    }
    return list;
}

export interface MapViewProps {
    markers: MapMarker[];
    line?: boolean;
    legs?: MapLeg[];
    fit?: boolean;
    onPick?: (lat: number, lng: number) => void;
    onMarkerClick?: (id: string) => void;
    focusId?: string | null;
    pickHint?: string;
    className?: string;
}

const FALLBACK_CENTER: [number, number] = [-54.34, -24.86];

export default function MapView({
    markers,
    line,
    legs,
    fit = true,
    onPick,
    onMarkerClick,
    focusId,
    pickHint,
    className,
}: MapViewProps) {
    const container = useRef<HTMLDivElement>(null);
    const map = useRef<MapLibreMap | null>(null);
    const layer = useRef<MarkerLayer | null>(null);
    const lastFit = useRef("");
    const [ready, setReady] = useState(false);
    const stops = markers.filter((p) => p.kind !== "driver");
    const drawnLegs: MapLeg[] =
        legs ??
        (line && stops.length > 1
            ? [{ kind: "straight", points: stops.map((p) => [p.lat, p.lng]) }]
            : []);
    const latest = useRef({ markers, legs: drawnLegs, onPick, onMarkerClick, fit });
    latest.current = { markers, legs: drawnLegs, onPick, onMarkerClick, fit };
    const clickable = Boolean(onMarkerClick);

    useEffect(() => {
        let disposed = false;
        let cleanup = () => {};
        void loadStyleOrFallback(currentTheme()).then((style) => {
            if (disposed || !container.current) return;
            const m = new MapLibreMap({
                container: container.current,
                style,
                center: FALLBACK_CENTER,
                zoom: 11,
                maxBounds: SOUTH_BOUNDS,
                attributionControl: { compact: true },
            });
            m.addControl(new NavigationControl({ showCompass: false }), "top-right");
            const paint = () => {
                ensureLayers(m, PALETTES[currentTheme()]);
                setLegData(m, latest.current.legs);
            };
            m.on("style.load", paint);
            m.on("click", (e) => latest.current.onPick?.(e.lngLat.lat, e.lngLat.lng));
            layer.current = createMarkerLayer(m, (id) => latest.current.onMarkerClick?.(id));
            map.current = m;
            const stopTheme = observeTheme((theme) => void switchStyle(m, theme, paint));
            cleanup = () => {
                stopTheme();
                layer.current?.clear();
                layer.current = null;
                map.current = null;
                lastFit.current = "";
                m.remove();
            };
            setReady(true);
        });
        return () => {
            disposed = true;
            cleanup();
            setReady(false);
        };
    }, []);

    const signature = JSON.stringify(markers);
    const legsSignature = JSON.stringify(drawnLegs);

    useEffect(() => {
        const m = map.current;
        if (!m || !layer.current) return;
        const { markers: points, legs: lines, fit: refit } = latest.current;
        layer.current.apply(points, clickable);
        if (m.isStyleLoaded()) setLegData(m, lines);

        const key = points
            .map((p) => (p.kind === "driver" ? p.id : `${p.id}:${p.lat}:${p.lng}`))
            .join("|")
            .concat(`#${lines.map((l) => `${l.kind}${l.points.length}`).join(",")}`);
        if (!refit || key === lastFit.current || points.length === 0) return;
        lastFit.current = key;
        m.resize();
        if (points.length === 1) {
            m.easeTo({ center: [points[0].lng, points[0].lat], zoom: 14, duration: 0 });
            return;
        }
        const bounds = new LngLatBounds();
        points.forEach((p) => bounds.extend([p.lng, p.lat]));
        lines.forEach((l) => l.points.forEach(([lat, lng]) => bounds.extend([lng, lat])));
        m.fitBounds(bounds, {
            padding: { top: 64, bottom: 48, left: 48, right: 48 },
            maxZoom: 15,
            duration: 0,
        });
    }, [signature, legsSignature, ready, clickable]);

    useEffect(() => {
        const target = focusId ? latest.current.markers.find((p) => p.id === focusId) : null;
        if (!target || !map.current) return;
        map.current.easeTo({
            center: [target.lng, target.lat],
            zoom: Math.max(map.current.getZoom(), 14),
            duration: 500,
        });
    }, [focusId, ready]);

    return (
        <div className={`map-view${onPick ? " is-picking" : ""} ${className ?? ""}`}>
            <div ref={container} className="map-canvas" />
            {pickHint && <div className="map-hint">{pickHint}</div>}
            <MapLegend legs={drawnLegs} />
        </div>
    );
}
