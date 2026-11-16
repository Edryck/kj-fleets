import { describe, expect, it } from "vitest";
import { dotScale } from "./dotScale";

describe("dotScale", () => {
    it("uses one dot per order up to the cap", () => {
        expect(dotScale([7, 3, 0], [2, 0, 0])).toEqual({
            perDot: 1,
            dots: [7, 3, 0],
            staleDots: [2, 0, 0],
        });
    });

    it("scales every column when one stage exceeds 12", () => {
        expect(dotScale([30, 5, 1], [4, 0, 0])).toEqual({
            perDot: 3,
            dots: [10, 2, 1],
            staleDots: [2, 0, 0],
        });
    });

    it("never draws more stale dots than dots", () => {
        expect(dotScale([25], [25]).staleDots[0]).toBe(dotScale([25], [25]).dots[0]);
    });
});
