import {
    Map as MapLibreMap,
    NavigationControl,
    setWorkerUrl,
    type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Theme } from "../theme";
import { KJ_SOURCES } from "./mapLayers";
import { loadStyle, PALETTES } from "./mapStyle";

setWorkerUrl(workerUrl);

export { MapLibreMap, NavigationControl };

export function currentTheme(): Theme {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function fallbackStyle(theme: Theme): StyleSpecification {
    return {
        version: 8,
        sources: {},
        layers: [
            {
                id: "background",
                type: "background",
                paint: { "background-color": PALETTES[theme].background },
            },
        ],
    };
}

export function loadStyleOrFallback(theme: Theme): Promise<StyleSpecification> {
    return loadStyle(theme).catch(() => fallbackStyle(theme));
}

export function observeTheme(onChange: (theme: Theme) => void): () => void {
    let applied = currentTheme();
    const observer = new MutationObserver(() => {
        const next = currentTheme();
        if (next === applied) return;
        applied = next;
        onChange(next);
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
}

export async function switchStyle(
    map: MapLibreMap,
    theme: Theme,
    onReady: () => void,
): Promise<void> {
    const next = await loadStyleOrFallback(theme);
    if (currentTheme() !== theme) return;
    map.once("styledata", onReady);
    map.setStyle(next, {
        diff: true,
        transformStyle: (previous, incoming) => ({
            ...incoming,
            terrain: previous?.terrain,
            sources: {
                ...incoming.sources,
                ...Object.fromEntries(
                    KJ_SOURCES.filter((id) => previous?.sources?.[id]).map((id) => [
                        id,
                        previous!.sources[id],
                    ]),
                ),
            },
            layers: [
                ...incoming.layers,
                ...(previous?.layers ?? []).filter((layer) => layer.id.startsWith("kj-")),
            ],
        }),
    });
}
