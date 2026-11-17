import type { Map as MapLibreMap } from "maplibre-gl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapLeg } from "../components/RouteLegs";
import type { SceneArc } from "./mapLayers";
import { createSceneEngine, type EngineDeps } from "./sceneEngine";
import { setFollowState } from "./sceneStore";

type Listener = (event?: unknown) => void;
let listeners: { type: string; fn: Listener; once: boolean }[] = [];

function fakeMap(): MapLibreMap {
    const canvas = document.createElement("div");
    const map = {
        on: (type: string, fn: Listener) => listeners.push({ type, fn, once: false }),
        once: (type: string, fn: Listener) => listeners.push({ type, fn, once: true }),
        off: (type: string, fn: Listener) => {
            listeners = listeners.filter((l) => l.type !== type || l.fn !== fn);
        },
        getCanvasContainer: () => canvas,
        getBearing: () => 0,
        getStyle: () => ({ layers: [], sources: {} }),
    };
    return map as unknown as MapLibreMap;
}

function fire(type: string) {
    const due = listeners.filter((l) => l.type === type);
    listeners = listeners.filter((l) => l.type !== type || !l.once);
    due.forEach((l) => l.fn({}));
}

function makeDeps(motion: Partial<EngineDeps["motion"]> = {}) {
    listeners = [];
    const deps = {
        markers: { apply: vi.fn(), glideTo: vi.fn(), clear: vi.fn() },
        layers: { ensure: vi.fn(), setLegs: vi.fn(), setArcs: vi.fn(), setComets: vi.fn() },
        motion: {
            animateLegs: vi.fn(() => () => {}),
            animateArcs: vi.fn(() => Promise.resolve()),
            startComets: vi.fn(() => () => {}),
            introSpin: vi.fn(() => () => {}),
            ...motion,
        },
        camera: { flyToScene: vi.fn(), applyTerrain: vi.fn(), followTo: vi.fn() },
        reduce: () => false,
        fireMoveEnd: () => fire("moveend"),
    };
    return deps;
}

const arc: SceneArc = { id: "a", from: [-24.8, -54.2], to: [-24.9, -54.3] };

it("stops the previous scene's animations when the owner changes", () => {
    const stopSpin = vi.fn();
    const stopComets = vi.fn();
    const deps = makeDeps({ introSpin: () => stopSpin, startComets: () => stopComets });
    const engine = createSceneEngine(fakeMap(), deps);
    engine.apply({
        owner: Symbol("dash"),
        scene: { markers: [], camera: { fit: null, intro: "spin" }, arcs: [arc], comets: 2 },
    });
    deps.fireMoveEnd();
    engine.apply({ owner: Symbol("dispatch"), scene: { markers: [] } });
    expect(stopSpin).toHaveBeenCalled();
    expect(stopComets).toHaveBeenCalled();
});

it("reapplies layers, current data and terrain after a style change", () => {
    const deps = makeDeps();
    const engine = createSceneEngine(fakeMap(), deps);
    const legs: MapLeg[] = [
        {
            kind: "road",
            points: [
                [0, 0],
                [1, 1],
            ],
        },
    ];
    engine.apply({
        owner: Symbol("o"),
        scene: { markers: [], legs, camera: { fit: null, terrain: 1.3 } },
    });
    deps.layers.ensure.mockClear();
    deps.layers.setLegs.mockClear();
    deps.camera.applyTerrain.mockClear();
    engine.reapplyAfterStyle();
    expect(deps.layers.ensure).toHaveBeenCalled();
    expect(deps.layers.setLegs).toHaveBeenCalledWith(expect.anything(), legs);
    expect(deps.camera.applyTerrain).toHaveBeenCalledWith(expect.anything(), 1.3);
});

it("clears markers and data when the scene is removed", () => {
    const deps = makeDeps();
    const engine = createSceneEngine(fakeMap(), deps);
    engine.apply({
        owner: Symbol("o"),
        scene: { markers: [{ id: "a", lat: 0, lng: 0, kind: "driver" }] },
    });
    engine.apply(null);
    expect(deps.markers.clear).toHaveBeenCalled();
    expect(deps.layers.setLegs).toHaveBeenLastCalledWith(expect.anything(), []);
});

it("fits every positioned marker on demand, ignoring the scene's own fit", () => {
    const deps = makeDeps();
    const engine = createSceneEngine(fakeMap(), deps);
    engine.apply({
        owner: Symbol("live"),
        scene: {
            markers: [
                { id: "d1", lat: -24.8, lng: -54.3, kind: "driver" },
                { id: "d2", lat: -25.1, lng: -54.1, kind: "driver" },
                { id: "km", lat: -25.0, lng: -54.2, kind: "pill", pill: { text: "3 km" } },
            ],
            legs: [
                {
                    kind: "road",
                    points: [
                        [-24.9, -54.2],
                        [-25.0, -54.25],
                    ],
                },
            ],
            camera: { fit: "legs", pitch: 0 },
        },
    });
    deps.camera.flyToScene.mockClear();
    engine.fitAll();
    expect(deps.camera.flyToScene).toHaveBeenCalledWith(
        expect.anything(),
        [
            [-24.8, -54.3],
            [-25.1, -54.1],
        ],
        expect.objectContaining({ fit: "markers", pitch: 0 }),
        false,
    );
});

it("follows the marker with the scene's padding once the camera arrives", () => {
    const deps = makeDeps();
    const engine = createSceneEngine(fakeMap(), deps);
    const padding = { top: 40, bottom: 160, left: 480, right: 380 };
    const follow = { markerId: "vehicle", zoom: 15.4, pitch: 68 };
    engine.apply({
        owner: Symbol("order"),
        scene: {
            markers: [{ id: "vehicle", lat: -24.9, lng: -54.2, kind: "driver" }],
            camera: { fit: "markers", padding, follow },
        },
    });
    deps.fireMoveEnd();
    expect(deps.camera.followTo).toHaveBeenCalledWith(
        expect.anything(),
        [-24.9, -54.2],
        [],
        follow,
        true,
        false,
        padding,
    );
});

describe("camera changes while following", () => {
    const owner = Symbol("order");
    const follow = { markerId: "vehicle", zoom: 15.4, pitch: 68 };
    const stop = { id: "pickup", lat: -24.8, lng: -54.3, kind: "pickup" as const };
    const vehicle = { id: "vehicle", lat: -24.9, lng: -54.2, kind: "driver" as const };
    const panels = { top: 40, bottom: 160, left: 480, right: 380 };
    const resized = { top: 40, bottom: 208, left: 480, right: 380 };

    afterEach(() => {
        setFollowState("following");
    });

    it("starts following when the followed marker shows up after the camera arrives", () => {
        setFollowState("following");
        const deps = makeDeps();
        const engine = createSceneEngine(fakeMap(), deps);
        engine.apply({
            owner,
            scene: { markers: [stop], camera: { fit: "markers", padding: panels } },
        });
        deps.fireMoveEnd();
        engine.apply({
            owner,
            scene: {
                markers: [stop, vehicle],
                camera: { fit: "markers", padding: panels, follow },
            },
        });
        expect(deps.camera.flyToScene).toHaveBeenCalledTimes(1);
        expect(deps.camera.followTo).toHaveBeenCalledWith(
            expect.anything(),
            [-24.9, -54.2],
            [],
            follow,
            true,
            false,
            panels,
        );
    });

    it("keeps following with the new padding when the panels resize", () => {
        setFollowState("following");
        const deps = makeDeps();
        const engine = createSceneEngine(fakeMap(), deps);
        const scene = (padding: typeof panels) => ({
            markers: [stop, vehicle],
            camera: { fit: "markers" as const, padding, follow },
        });
        engine.apply({ owner, scene: scene(panels) });
        deps.fireMoveEnd();
        engine.apply({ owner, scene: scene(resized) });
        expect(deps.camera.flyToScene).toHaveBeenCalledTimes(1);
        expect(deps.camera.followTo).toHaveBeenLastCalledWith(
            expect.anything(),
            [-24.9, -54.2],
            [],
            follow,
            false,
            false,
            resized,
        );
    });

    it("refits the overview on a camera change while follow is suspended", () => {
        setFollowState("following");
        const deps = makeDeps();
        const engine = createSceneEngine(fakeMap(), deps);
        const scene = (padding: typeof panels) => ({
            markers: [stop, vehicle],
            camera: { fit: "markers" as const, padding, follow },
        });
        engine.apply({ owner, scene: scene(panels) });
        deps.fireMoveEnd();
        setFollowState("suspended");
        deps.camera.followTo.mockClear();
        engine.apply({ owner, scene: scene(resized) });
        expect(deps.camera.flyToScene).toHaveBeenCalledTimes(2);
        expect(deps.camera.followTo).not.toHaveBeenCalled();
    });

    it("waits for the newest flight before following when the camera changes mid-flight", () => {
        setFollowState("following");
        const deps = makeDeps();
        const engine = createSceneEngine(fakeMap(), deps);
        engine.apply({
            owner,
            scene: { markers: [stop], camera: { fit: "markers", padding: panels } },
        });
        deps.camera.flyToScene.mockImplementation(() => deps.fireMoveEnd());
        engine.apply({
            owner,
            scene: {
                markers: [stop, vehicle],
                camera: { fit: "markers", padding: panels, follow },
            },
        });
        expect(deps.camera.followTo).not.toHaveBeenCalled();
        deps.camera.flyToScene.mockImplementation(() => {});
        deps.fireMoveEnd();
        expect(deps.camera.followTo).toHaveBeenCalledTimes(1);
    });
});
