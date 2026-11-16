import { useEffect, useRef, useSyncExternalStore } from "react";
import { prefersReducedMotion } from "../motion/reducedMotion";
import { applyTerrain, flyToScene, followTo } from "./camera";
import { ensureLayers, setArcData, setCometData, setLegData } from "./mapLayers";
import {
    currentTheme,
    loadStyleOrFallback,
    MapLibreMap,
    observeTheme,
    switchStyle,
} from "./maplibre";
import { animateArcs, animateLegs, introSpin, startComets } from "./mapMotion";
import { PALETTES } from "./mapStyle";
import { createMarkerLayer } from "./markers";
import { createSceneEngine } from "./sceneEngine";
import { getScene, subscribeScene } from "./sceneStore";

const CENTER: [number, number] = [-54.18, -24.93];

export default function MapStage({ visible }: { visible: boolean }) {
    const container = useRef<HTMLDivElement>(null);
    const entry = useSyncExternalStore(subscribeScene, getScene, getScene);
    const hint = visible ? entry?.scene.pick?.hint : undefined;

    useEffect(() => {
        let disposed = false;
        let cleanup = () => {};
        void loadStyleOrFallback(currentTheme()).then((style) => {
            if (disposed || !container.current) return;
            const map = new MapLibreMap({
                container: container.current,
                style,
                center: CENTER,
                zoom: 9,
                maxPitch: 75,
                attributionControl: { compact: true },
            });
            const markers = createMarkerLayer(map, (id) => getScene()?.scene.onMarkerClick?.(id));
            const engine = createSceneEngine(map, {
                markers,
                layers: {
                    ensure: (m) => ensureLayers(m, PALETTES[currentTheme()]),
                    setLegs: setLegData,
                    setArcs: setArcData,
                    setComets: setCometData,
                },
                motion: {
                    animateLegs: (m, legs) => animateLegs(m, legs),
                    animateArcs: (m, arcs) => animateArcs(m, arcs),
                    startComets,
                    introSpin: (m) => introSpin(m),
                },
                camera: {
                    flyToScene,
                    applyTerrain: (m, exaggeration) => {
                        if (map.getSource("dem")) applyTerrain(m, exaggeration);
                    },
                    followTo,
                },
                reduce: prefersReducedMotion,
            });
            const reapply = () => engine.reapplyAfterStyle();
            map.on("style.load", reapply);
            engine.apply(getScene());
            const unsubscribe = subscribeScene(() => engine.apply(getScene()));
            const stopTheme = observeTheme((theme) => void switchStyle(map, theme, reapply));
            cleanup = () => {
                stopTheme();
                unsubscribe();
                engine.destroy();
                map.remove();
            };
        });
        return () => {
            disposed = true;
            cleanup();
        };
    }, []);

    return (
        <div className={`map-stage${visible ? "" : " is-hidden"}`} aria-hidden={!visible}>
            <div ref={container} className="map-stage-canvas" />
            {hint && (
                <div className="map-stage-hint" role="status">
                    {hint}
                </div>
            )}
        </div>
    );
}
