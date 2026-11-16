import { describe, expect, it } from "vitest";
import ambientCss from "../styles/ambient.css?raw";
import { contourPaths } from "./contours";

describe("ambient background", () => {
    it("generates 32 closed topographic rings deterministically", () => {
        const paths = contourPaths();
        expect(paths).toHaveLength(32);
        paths.forEach((d) => {
            expect(d.startsWith("M")).toBe(true);
            expect(d.endsWith("Z")).toBe(true);
        });
        expect(contourPaths()).toEqual(paths);
    });

    it("never animates behind glass", () => {
        expect(ambientCss).not.toMatch(/animation|@keyframes/);
    });
});
