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

export interface MapMarker {
    id: string;
    lat: number;
    lng: number;
    kind: "pickup" | "waypoint" | "dropoff" | "driver" | "start";
    label?: string;
    title?: string;
    dimmed?: boolean;
}

interface Props {
    markers: MapMarker[];
    // liga os marcadores (exceto motorista) na ordem recebida, em linha reta
    line?: boolean;
    onPick?: (lat: number, lng: number) => void;
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

export default function MapView({ markers, line, onPick, pickHint, className }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const map = useRef<MapLibreMap | null>(null);
    const drawn = useRef<Marker[]>([]);
    const lastFit = useRef("");
    const styleReady = useRef(false);
    // handlers e dados mais recentes, lidos pelos callbacks do mapa sem recriá-lo
    const latest = useRef({ markers, line, onPick });
    latest.current = { markers, line, onPick };

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
        drawn.current.forEach((marker) => marker.remove());
        drawn.current = markers.map((p) => {
            const el = document.createElement("div");
            el.className = `map-marker map-marker-${p.kind}${p.dimmed ? " is-dimmed" : ""}`;
            el.textContent = p.label ?? "";
            if (p.title) el.title = p.title;
            return new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m);
        });
        drawLine();

        // só reenquadra quando o conjunto de pontos muda, não a cada clique
        const key = markers.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|");
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
