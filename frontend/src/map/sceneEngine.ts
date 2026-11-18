import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { MapLeg } from "../components/RouteLegs";
import { ZERO, type CameraMap, type Padding, type SceneCamera } from "./camera";
import type { SceneArc } from "./mapLayers";
import type { MarkerLayer, SceneMarker } from "./markers";
import { adaptCamera, type Viewport } from "./responsive";
import {
    getFollowState,
    setFollowState,
    subscribeFollow,
    type MapScene,
    type SceneEntry,
} from "./sceneStore";

export interface EngineDeps {
    markers: MarkerLayer;
    layers: {
        ensure(map: MapLibreMap): void;
        setLegs(map: MapLibreMap, legs: MapLeg[]): void;
        setArcs(map: MapLibreMap, arcs: SceneArc[], progress?: number): void;
        setComets(map: MapLibreMap, points: [number, number][]): void;
    };
    motion: {
        animateLegs(map: MapLibreMap, legs: MapLeg[]): () => void;
        animateArcs(map: MapLibreMap, arcs: SceneArc[]): Promise<void>;
        startComets(map: MapLibreMap, arcs: SceneArc[], options?: { cycles?: number }): () => void;
        introSpin(map: MapLibreMap): () => void;
    };
    camera: {
        flyToScene(
            map: CameraMap,
            points: [number, number][],
            camera: SceneCamera,
            reduce: boolean,
        ): void;
        applyTerrain(map: CameraMap, exaggeration: number | undefined): void;
        followTo(
            map: CameraMap,
            position: [number, number],
            legs: MapLeg[],
            follow: NonNullable<SceneCamera["follow"]>,
            first: boolean,
            reduce: boolean,
            padding?: Padding,
        ): void;
    };
    reduce: () => boolean;
    viewport?: () => Viewport;
}

export interface SceneEngine {
    apply(entry: SceneEntry | null): void;
    relayout(): void;
    reapplyAfterStyle(): void;
    fitAll(): void;
    destroy(): void;
}

const FIT_KINDS = new Set<SceneMarker["kind"]>([
    "start",
    "pickup",
    "waypoint",
    "dropoff",
    "driver",
    "order",
    "vehicle",
]);

function markerPoints(scene: MapScene): [number, number][] {
    return scene.markers.filter((m) => FIT_KINDS.has(m.kind)).map((m) => [m.lat, m.lng]);
}

function fitPoints(scene: MapScene): [number, number][] {
    const camera = scene.camera;
    if (!camera?.fit) return [];
    if (camera.fit === "points") return camera.points ?? [];
    if (camera.fit === "legs") return (scene.legs ?? []).flatMap((leg) => leg.points);
    return markerPoints(scene);
}

function cameraKey(camera: SceneCamera | undefined): string {
    if (!camera) return "";
    return JSON.stringify({ ...camera, follow: camera.follow?.markerId ?? null, terrain: null });
}

const GESTURES = ["dragstart", "wheel", "pitchstart", "rotatestart"] as const;

function adaptEntry(entry: SceneEntry, viewport: Viewport): SceneEntry {
    const camera = entry.scene.camera;
    if (!camera) return entry;
    return { ...entry, scene: { ...entry.scene, camera: adaptCamera(camera, viewport) } };
}

export function createSceneEngine(map: MapLibreMap, deps: EngineDeps): SceneEngine {
    const viewportNow = () => deps.viewport?.() ?? "full";
    let viewport = viewportNow();
    let raw: SceneEntry | null = null;
    let current: SceneEntry | null = null;
    let styleReady = false;
    let ownerStops: (() => void)[] = [];
    let stopLegs: () => void = () => {};
    let stopComets: () => void = () => {};
    let arcsToken = 0;
    let legsKey = "";
    let arcsKey = "";
    let camKey = "";
    let terrain: number | undefined;
    let legsAnimated = false;
    let arrived = false;
    let followKey = "";
    let stopArrival = () => {};

    const scene = () => current?.scene;
    const legsOf = (s: MapScene | undefined) => s?.legs ?? [];
    const arcsOf = (s: MapScene | undefined) => s?.arcs ?? [];

    const followed = (s: MapScene | undefined): SceneMarker | undefined => {
        const follow = s?.camera?.follow;
        return follow ? s.markers.find((m) => m.id === follow.markerId) : undefined;
    };

    const follow = (first: boolean) => {
        const s = scene();
        const target = followed(s);
        const config = s?.camera?.follow;
        if (!s || !target || !config || getFollowState() !== "following") return;
        followKey = `${target.lat},${target.lng}`;
        deps.camera.followTo(
            map,
            [target.lat, target.lng],
            legsOf(s),
            config,
            first,
            deps.reduce(),
            s.camera?.padding ?? ZERO,
        );
    };

    const runComets = (arcs: SceneArc[], cycles: number | undefined) => {
        stopComets();
        stopComets =
            cycles && arcs.length ? deps.motion.startComets(map, arcs, { cycles }) : () => {};
    };

    const arrive = () => {
        arrived = true;
        const s = scene();
        if (!s) return;
        if (s.camera?.follow) follow(true);
        else if (s.camera?.intro === "spin") ownerStops.push(deps.motion.introSpin(map));
        runComets(arcsOf(s), s.comets);
    };

    const stopOwner = () => {
        ownerStops.forEach((stop) => stop());
        ownerStops = [];
        stopLegs();
        stopLegs = () => {};
        stopComets();
        stopComets = () => {};
        arcsToken++;
        legsAnimated = false;
        stopArrival();
        stopArrival = () => {};
        arrived = false;
        followKey = "";
    };

    const setTerrain = (next: number | undefined) => {
        terrain = next;
        if (styleReady) deps.camera.applyTerrain(map, next);
    };

    const applyLegs = (s: MapScene) => {
        const legs = legsOf(s);
        if (!s.animateLegs) legsAnimated = false;
        const key = JSON.stringify(legs);
        if (key === legsKey) return;
        legsKey = key;
        stopLegs();
        stopLegs = () => {};
        if (s.animateLegs && !legsAnimated && legs.length > 0) {
            legsAnimated = true;
            stopLegs = deps.motion.animateLegs(map, legs);
        } else {
            deps.layers.setLegs(map, legs);
        }
    };

    const applyArcs = (s: MapScene, isNewOwner: boolean) => {
        const arcs = arcsOf(s);
        const key = JSON.stringify([arcs, s.comets ?? 0]);
        if (key === arcsKey) return;
        arcsKey = key;
        stopComets();
        stopComets = () => {};
        const token = ++arcsToken;
        if (arcs.length === 0) {
            deps.layers.setArcs(map, []);
            deps.layers.setComets(map, []);
            return;
        }
        const drawing = deps.motion.animateArcs(map, arcs);
        if (isNewOwner) return;
        void drawing.then(() => {
            if (token === arcsToken && arrived) runComets(arcs, s.comets);
        });
    };

    const applyCamera = (s: MapScene, isNewOwner: boolean) => {
        if (isNewOwner || s.camera?.terrain !== terrain) setTerrain(s.camera?.terrain);
        const key = cameraKey(s.camera);
        if (!isNewOwner && key === camKey) return;
        camKey = key;
        const points = fitPoints(s);
        if (points.length === 0 || !s.camera) {
            if (isNewOwner) arrive();
            return;
        }
        if (arrived && followed(s) && getFollowState() === "following") {
            follow(followKey === "");
            return;
        }
        const reduce = deps.reduce();
        stopArrival();
        stopArrival = () => {};
        deps.camera.flyToScene(map, points, s.camera, reduce);
        if (arrived) return;
        if (reduce) {
            arrive();
            return;
        }
        const onArrive = () => {
            stopArrival = () => {};
            arrive();
        };
        map.once("moveend", onArrive);
        stopArrival = () => map.off("moveend", onArrive);
    };

    const applyFollow = (s: MapScene) => {
        if (!arrived) return;
        const target = followed(s);
        if (!target) return;
        const key = `${target.lat},${target.lng}`;
        if (key !== followKey) follow(false);
    };

    const applyPick = (s: MapScene | undefined) => {
        map.getCanvasContainer().classList.toggle("is-picking", Boolean(s?.pick));
    };

    const onClick = (event: MapMouseEvent) => {
        scene()?.pick?.onPick(event.lngLat.lat, event.lngLat.lng);
    };

    const onGesture = (event: { originalEvent?: unknown }) => {
        if (event.originalEvent && scene()?.camera?.follow) setFollowState("suspended");
    };

    map.on("click", onClick);
    GESTURES.forEach((type) => map.on(type, onGesture));
    const unsubscribeFollow = subscribeFollow(() => {
        if (getFollowState() === "following" && arrived) follow(true);
    });

    const teardown = () => {
        stopOwner();
        current = null;
        raw = null;
        legsKey = "";
        arcsKey = "";
        camKey = "";
        deps.markers.clear();
        deps.layers.setLegs(map, []);
        deps.layers.setArcs(map, []);
        deps.layers.setComets(map, []);
        setTerrain(undefined);
        applyPick(undefined);
    };

    return {
        apply(entry) {
            if (!entry) {
                if (current) teardown();
                return;
            }
            const isNewOwner = current?.owner !== entry.owner;
            if (isNewOwner) {
                stopOwner();
                legsKey = "";
                arcsKey = "";
                camKey = "";
            }
            raw = entry;
            viewport = viewportNow();
            current = adaptEntry(entry, viewport);
            const s = current.scene;
            deps.markers.apply(s.markers, Boolean(s.onMarkerClick));
            applyLegs(s);
            applyArcs(s, isNewOwner);
            applyCamera(s, isNewOwner);
            applyFollow(s);
            applyPick(s);
        },
        relayout() {
            const next = viewportNow();
            if (next === viewport) return;
            viewport = next;
            if (!raw) return;
            current = adaptEntry(raw, viewport);
            camKey = "";
            applyCamera(current.scene, false);
        },
        reapplyAfterStyle() {
            styleReady = true;
            deps.layers.ensure(map);
            const s = scene();
            deps.layers.setLegs(map, legsOf(s));
            deps.layers.setArcs(map, arcsOf(s));
            deps.camera.applyTerrain(map, terrain);
        },
        fitAll() {
            const s = scene();
            if (!s) return;
            const points = markerPoints(s);
            if (points.length === 0) return;
            if (s.camera?.follow) setFollowState("suspended");
            deps.camera.flyToScene(map, points, { ...s.camera, fit: "markers" }, deps.reduce());
        },
        destroy() {
            stopOwner();
            unsubscribeFollow();
            map.off("click", onClick);
            GESTURES.forEach((type) => map.off(type, onGesture));
            deps.markers.clear();
            current = null;
            raw = null;
        },
    };
}
