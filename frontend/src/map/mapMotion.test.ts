import type { Map as MapLibreMap } from "maplibre-gl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setArcData } from "./mapLayers";
import { animateArcs, cometPositions, cometsDone, cutLegs, partialLine } from "./mapMotion";

vi.mock("./mapLayers", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./mapLayers")>()),
    setArcData: vi.fn(),
}));

describe("map motion math", () => {
    const line: [number, number][] = [
        [0, 0],
        [0, 10],
    ];

    it("cuts a line by progress", () => {
        expect(partialLine(line, 0)).toEqual([[0, 0]]);
        expect(partialLine(line, 1)).toEqual(line);
        expect(partialLine(line, 0.5)).toEqual([
            [0, 0],
            [0, 5],
        ]);
    });

    it("staggers comets by 0.17 of a period and stops after the cycles", () => {
        const paths = [line, line];
        const at = cometPositions(paths, 1100, 2200, 2);
        expect(at[0]).toEqual([0, 5]);
        expect(at[1]).not.toBeNull();
        expect(cometPositions(paths, 200, 2200, 2)[1]).toBeNull();
        expect(cometsDone(2, 2200 * 2.17 + 1, 2200, 2)).toBe(true);
        expect(cometsDone(2, 2200 * 2.17 - 1, 2200, 2)).toBe(false);
    });

    it("keeps the original-order layer whole while the route draws", () => {
        const original = { kind: "original" as const, points: line };
        const road = { kind: "road" as const, points: line };
        expect(cutLegs([original, road], 0)).toEqual([original]);
        expect(cutLegs([original, road], 0.5)).toEqual([
            original,
            {
                kind: "road",
                points: [
                    [0, 0],
                    [0, 5],
                ],
            },
        ]);
    });
});

describe("arc drawing", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("stops drawing on cancel so a cleared plan never comes back", () => {
        const frames = new Map<number, FrameRequestCallback>();
        let next = 0;
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
            frames.set(++next, callback);
            return next;
        });
        vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
        const flush = (now: number) => {
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach((callback) => callback(now));
        };
        const arc = {
            id: "a",
            from: [-24.8, -54.2] as [number, number],
            to: [-24.9, -54.3] as [number, number],
        };
        const drawing = animateArcs({} as MapLibreMap, [arc], 900);
        flush(performance.now() + 100);
        const calls = vi.mocked(setArcData).mock.calls.length;
        expect(calls).toBeGreaterThan(0);
        drawing.cancel();
        flush(performance.now() + 2000);
        expect(vi.mocked(setArcData).mock.calls.length).toBe(calls);
        expect(frames.size).toBe(0);
    });
});
