import { useEffect, useRef } from "react";
import {
    currentTheme,
    loadStyleOrFallback,
    MapLibreMap,
    observeTheme,
    switchStyle,
} from "./maplibre";

const CENTER: [number, number] = [-54.18, -24.93];

const hasWebGL = () => typeof window !== "undefined" && "WebGLRenderingContext" in window;

export default function StaticMapBackdrop() {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hasWebGL()) return;
        let disposed = false;
        let map: MapLibreMap | null = null;
        let stopTheme = () => {};
        void loadStyleOrFallback(currentTheme()).then((style) => {
            if (disposed || !container.current) return;
            try {
                map = new MapLibreMap({
                    container: container.current,
                    style,
                    center: CENTER,
                    zoom: 9.6,
                    pitch: 0,
                    bearing: 0,
                    interactive: false,
                    fadeDuration: 0,
                    attributionControl: { compact: true },
                });
            } catch {
                map = null;
                return;
            }
            const current = map;
            stopTheme = observeTheme((theme) => void switchStyle(current, theme, () => {}));
        });
        return () => {
            disposed = true;
            stopTheme();
            map?.remove();
        };
    }, []);

    return (
        <div className="auth-backdrop" aria-hidden="true">
            <div ref={container} className="auth-map" />
            <div className="auth-veil" />
        </div>
    );
}
