import { describe, expect, it } from "vitest";
import { cometPositions, cometsDone, cutLegs, partialLine } from "./mapMotion";

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
