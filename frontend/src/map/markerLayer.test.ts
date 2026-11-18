import type { Map as MapLibreMap } from "maplibre-gl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMarkerLayer, type SceneMarker } from "./markers";

const { reduced, instances } = vi.hoisted(() => ({
    reduced: { value: false },
    instances: [] as { position: { lng: number; lat: number } }[],
}));

vi.mock("../motion/reducedMotion", () => ({ prefersReducedMotion: () => reduced.value }));

vi.mock("maplibre-gl", () => ({
    Marker: class {
        position = { lng: 0, lat: 0 };
        constructor() {
            instances.push(this);
        }
        setLngLat([lng, lat]: [number, number]) {
            this.position = { lng, lat };
            return this;
        }
        getLngLat() {
            return this.position;
        }
        addTo() {
            return this;
        }
        remove() {}
    },
}));

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let clock = 0;

beforeEach(() => {
    frames.clear();
    instances.length = 0;
    reduced.value = false;
    clock = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        frames.set(++nextFrame, callback);
        return nextFrame;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function advance(ms: number) {
    clock += ms;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(clock));
}

const at = (kind: SceneMarker["kind"], lat: number, lng: number): SceneMarker => ({
    id: "m",
    kind,
    lat,
    lng,
});

const latest = () => instances[instances.length - 1].position;

it("glides a driver between real positions instead of jumping", () => {
    const layer = createMarkerLayer({} as MapLibreMap, () => {});
    layer.apply([at("driver", -24.8, -54.3)]);
    advance(16);
    layer.apply([at("driver", -24.9, -54.4)]);
    expect(latest().lat).toBeCloseTo(-24.8, 5);
    advance(300);
    const half = latest();
    expect(half.lat).toBeLessThan(-24.8);
    expect(half.lat).toBeGreaterThan(-24.9);
    advance(400);
    expect(latest().lat).toBeCloseTo(-24.9, 5);
    expect(latest().lng).toBeCloseTo(-54.4, 5);
});

it("glides the followed vehicle too", () => {
    const layer = createMarkerLayer({} as MapLibreMap, () => {});
    layer.apply([at("vehicle", -24.8, -54.3)]);
    layer.apply([at("vehicle", -24.9, -54.3)]);
    expect(latest().lat).toBeCloseTo(-24.8, 5);
    advance(700);
    expect(latest().lat).toBeCloseTo(-24.9, 5);
});

it("moves stops at once and jumps under reduced motion", () => {
    const layer = createMarkerLayer({} as MapLibreMap, () => {});
    layer.apply([at("pickup", -24.8, -54.3)]);
    layer.apply([at("pickup", -24.9, -54.3)]);
    expect(latest().lat).toBeCloseTo(-24.9, 5);
    reduced.value = true;
    const driver = createMarkerLayer({} as MapLibreMap, () => {});
    driver.apply([at("driver", -24.8, -54.3)]);
    driver.apply([at("driver", -24.9, -54.3)]);
    expect(latest().lat).toBeCloseTo(-24.9, 5);
});
