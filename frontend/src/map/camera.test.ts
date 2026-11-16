import { describe, expect, it, vi } from "vitest";
import type { MapLeg } from "../components/RouteLegs";
import { applyTerrain, flyToScene, followBearing, headingOf, type CameraMap } from "./camera";

function fakeMap() {
    const calls: string[] = [];
    const map = {
        stop: vi.fn(() => calls.push("stop")),
        setPadding: vi.fn(() => calls.push("setPadding")),
        cameraForBounds: vi.fn(
            () => (calls.push("cameraForBounds"), { center: [-54.2, -24.9], zoom: 9 }),
        ),
        flyTo: vi.fn<(options: unknown) => number>(() => calls.push("flyTo")),
        easeTo: vi.fn(),
        setTerrain: vi.fn(),
    };
    return { map, calls };
}

describe("camera", () => {
    it("measures headings clockwise from north", () => {
        expect(headingOf([0, 0], [1, 0])).toBeCloseTo(0);
        expect(headingOf([0, 0], [0, 1])).toBeCloseTo(90);
    });

    it("points the follow camera at the route ahead", () => {
        const legs: MapLeg[] = [
            {
                kind: "road",
                points: [
                    [0, 0],
                    [0.001, 0],
                    [0.002, 0],
                    [0.002, 0.001],
                    [0.002, 0.002],
                ],
            },
        ];
        expect(followBearing([0.002, 0], legs, 2)).toBeCloseTo(90, 0);
        expect(followBearing([0, 0], legs, 1)).toBeCloseTo(0, 0);
        expect(followBearing([0, 0], [], 3)).toBeNull();
    });

    it("stops and resets padding before fitting", () => {
        const { map, calls } = fakeMap();
        flyToScene(
            map as unknown as CameraMap,
            [
                [-24.8, -54.3],
                [-25.1, -54.1],
            ],
            { fit: "points", pitch: 0, padding: { top: 120, bottom: 210, left: 580, right: 90 } },
            false,
        );
        expect(calls).toEqual(["stop", "setPadding", "cameraForBounds", "flyTo"]);
        expect(map.setPadding).toHaveBeenCalledWith({ top: 0, bottom: 0, left: 0, right: 0 });
    });

    it("skips the flight when the bounds cannot fit and jumps with reduced motion", () => {
        const { map } = fakeMap();
        map.cameraForBounds.mockReturnValueOnce(undefined as never);
        flyToScene(
            map as unknown as CameraMap,
            [
                [0, 0],
                [1, 1],
            ],
            { fit: "points" },
            false,
        );
        expect(map.flyTo).not.toHaveBeenCalled();
        flyToScene(
            map as unknown as CameraMap,
            [
                [0, 0],
                [1, 1],
            ],
            { fit: "points" },
            true,
        );
        expect(map.flyTo.mock.calls[0][0]).toMatchObject({ duration: 0 });
    });

    it("turns terrain on and off", () => {
        const { map } = fakeMap();
        applyTerrain(map as unknown as CameraMap, 2.4);
        applyTerrain(map as unknown as CameraMap, 0);
        expect(map.setTerrain).toHaveBeenNthCalledWith(1, { source: "dem", exaggeration: 2.4 });
        expect(map.setTerrain).toHaveBeenNthCalledWith(2, null);
    });
});
