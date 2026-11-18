import { describe, expect, it } from "vitest";
import type { SceneCamera } from "./camera";
import { adaptCamera, viewportFor } from "./responsive";

describe("responsive camera", () => {
    it.each([
        [1440, "full"],
        [1280, "full"],
        [1279, "compact"],
        [1100, "compact"],
        [1024, "compact"],
        [1023, "tablet"],
        [900, "tablet"],
        [768, "tablet"],
        [767, "phone"],
        [390, "phone"],
    ] as const)("%i px → %s", (w, v) => {
        expect(viewportFor(w)).toBe(v);
    });

    it("caps pitch on tablets and drops terrain and intro on phones", () => {
        const dash: SceneCamera = { fit: "points", pitch: 73, terrain: 2.4, intro: "spin" };
        expect(adaptCamera(dash, "tablet")).toMatchObject({
            pitch: 60,
            terrain: 2.4,
            intro: "spin",
        });
        expect(adaptCamera(dash, "phone")).toMatchObject({ pitch: 45, terrain: 0, intro: null });
        expect(adaptCamera(dash, "full")).toEqual(dash);
        expect(adaptCamera(dash, "compact")).toEqual(dash);
    });

    it("caps the follow camera pitch too and leaves low pitches alone", () => {
        const order: SceneCamera = {
            fit: "legs",
            pitch: 30,
            follow: { markerId: "d1", zoom: 15, pitch: 70 },
        };
        expect(adaptCamera(order, "phone")).toMatchObject({
            pitch: 30,
            follow: { markerId: "d1", zoom: 15, pitch: 45 },
        });
        expect(adaptCamera(order, "tablet").follow).toEqual({
            markerId: "d1",
            zoom: 15,
            pitch: 60,
        });
    });
});
