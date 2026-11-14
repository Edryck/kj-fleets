import {
    LngLatBounds,
    Map as MapLibreMap,
    Marker,
    NavigationControl,
    setWorkerUrl,
    type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef } from "react";
import type { RouteStop } from "../api/types";

export interface MapMarker {
    id: string;
    lat: number;
    lng: number;
    kind: "pickup" | "waypoint" | "dropoff" | "driver" | "start";
    label?: string;
    title?: string;
    dimmed?: boolean;
    // motorista: o marcador mostra as iniciais e o estado vai no formato, não só na cor
    status?: "AVAILABLE" | "BUSY" | "OFFLINE";
    selected?: boolean;
}

// paradas da rota gravada viram marcadores numerados; visitadas ficam atenuadas
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

interface Props {
    markers: MapMarker[];
    // liga os marcadores (exceto motorista) na ordem recebida, em linha reta
    line?: boolean;
    onPick?: (lat: number, lng: number) => void;
    onMarkerClick?: (id: string) => void;
    // centraliza neste marcador quando muda (ex.: motorista escolhido na lista)
    focusId?: string | null;
    pickHint?: string;
    className?: string;
}

// o Vite não resolve o worker sozinho; sem isso o mapa fica em branco
setWorkerUrl(workerUrl);

const STYLES = {
    dark: "https://tiles.openfreemap.org/styles/dark",
    light: "https://tiles.openfreemap.org/styles/liberty",
};
const FALLBACK_CENTER: [number, number] = [-54.34, -24.86];

const currentTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export default function MapView({
    markers,
    line,
    onPick,
    onMarkerClick,
    focusId,
    pickHint,
    className,
}: Props) {
    const container = useRef<HTMLDivElement>(null);
    const map = useRef<MapLibreMap | null>(null);
    const drawn = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
    const lastFit = useRef("");
    const styleReady = useRef(false);
    // handlers e dados mais recentes, lidos pelos callbacks do mapa sem recriá-lo
    const latest = useRef({ markers, line, onPick, onMarkerClick });
    latest.current = { markers, line, onPick, onMarkerClick };

    function drawLine() {
        const m = map.current;
        if (!m) return;
        const coords = latest.current.markers
            .filter((p) => p.kind !== "driver")
            .map((p) => [p.lng, p.lat]);
        const data = {
            type: "Feature" as const,
            properties: {},
            geometry: {
                type: "LineString" as const,
                coordinates: latest.current.line && coords.length > 1 ? coords : [],
            },
        };
        // antes do estilo carregar não dá para mexer nas fontes; o style.load chama de novo
        if (!styleReady.current) return;
        const source = m.getSource("route") as GeoJSONSource | undefined;
        if (source) {
            source.setData(data);
            return;
        }
        m.addSource("route", { type: "geojson", data });
        m.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            paint: {
                // o paint do MapLibre não lê var(); resolve o token aqui
                "line-color": getComputedStyle(document.documentElement)
                    .getPropertyValue("--color-primary")
                    .trim(),
                "line-width": 3,
                "line-opacity": 0.9,
            },
        });
    }

    useEffect(() => {
        if (!container.current) return;
        const m = new MapLibreMap({
            container: container.current,
            style: STYLES[currentTheme()],
            center: FALLBACK_CENTER,
            zoom: 11,
            attributionControl: { compact: true },
        });
        m.addControl(new NavigationControl({ showCompass: false }), "top-right");
        m.on("style.load", () => {
            styleReady.current = true;
            drawLine();
        });
        m.on("click", (e) => latest.current.onPick?.(e.lngLat.lat, e.lngLat.lng));
        map.current = m;

        const items = drawn.current;
        let applied = currentTheme();
        const observer = new MutationObserver(() => {
            const next = currentTheme();
            if (next === applied) return;
            applied = next;
            styleReady.current = false;
            m.setStyle(STYLES[next]);
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => {
            observer.disconnect();
            // marcadores velhos apontariam para o mapa destruído (StrictMode remonta o efeito)
            items.forEach((item) => item.marker.remove());
            items.clear();
            lastFit.current = "";
            m.remove();
            map.current = null;
            styleReady.current = false;
        };
    }, []);

    // quem chama pode recriar o array a cada render; só redesenha se o conteúdo mudou
    const signature = JSON.stringify(markers);

    useEffect(() => {
        const m = map.current;
        if (!m) return;
        // atualiza os marcadores no lugar: recriar a cada posição perderia cliques e tooltips
        const ids = new Set(markers.map((p) => p.id));
        drawn.current.forEach((item, id) => {
            if (ids.has(id)) return;
            item.marker.remove();
            drawn.current.delete(id);
        });
        for (const p of markers) {
            let item = drawn.current.get(p.id);
            if (!item) {
                const el = document.createElement("div");
                const id = p.id;
                el.addEventListener("click", (e) => {
                    if (!latest.current.onMarkerClick) return;
                    e.stopPropagation();
                    latest.current.onMarkerClick(id);
                });
                item = {
                    marker: new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m),
                    el,
                };
                drawn.current.set(p.id, item);
            }
            item.marker.setLngLat([p.lng, p.lat]);
            item.el.className = [
                "map-marker",
                `map-marker-${p.kind}`,
                p.dimmed && "is-dimmed",
                p.selected && "is-selected",
                onMarkerClick && "is-clickable",
            ]
                .filter(Boolean)
                .join(" ");
            if (p.status) item.el.dataset.status = p.status;
            else delete item.el.dataset.status;
            item.el.textContent = p.label ?? "";
            if (p.title) item.el.title = p.title;
        }
        drawLine();

        // só reenquadra quando o conjunto de pontos muda, não a cada clique
        // motorista andando não reenquadra: só entra/sai do conjunto
        const key = markers
            .map((p) => (p.kind === "driver" ? p.id : `${p.id}:${p.lat}:${p.lng}`))
            .join("|");
        if (key === lastFit.current || markers.length === 0) return;
        lastFit.current = key;
        if (markers.length === 1) {
            m.resize();
            m.easeTo({ center: [markers[0].lng, markers[0].lat], zoom: 14, duration: 0 });
            return;
        }
        m.resize();
        const bounds = new LngLatBounds();
        markers.forEach((p) => bounds.extend([p.lng, p.lat]));
        m.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- signature representa markers
    }, [signature, line]);

    useEffect(() => {
        const target = focusId ? latest.current.markers.find((p) => p.id === focusId) : null;
        if (!target) return;
        map.current?.easeTo({
            center: [target.lng, target.lat],
            zoom: Math.max(map.current.getZoom(), 14),
            duration: 500,
        });
    }, [focusId]);

    return (
        <div className={`map-view${onPick ? " is-picking" : ""} ${className ?? ""}`}>
            <div ref={container} className="map-canvas" />
            {pickHint && <div className="map-hint">{pickHint}</div>}
            {line && markers.length > 1 && (
                <div className="map-legend">Linha reta entre paradas</div>
            )}
        </div>
    );
}
