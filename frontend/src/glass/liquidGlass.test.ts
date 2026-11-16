import { describe, expect, it } from "vitest";
import {
    GLASS,
    bezelFor,
    displacementScale,
    filterKey,
    glassPixels,
    refractionProfile,
    squircle,
} from "./liquidGlass";

describe("liquid glass math", () => {
    it("uses the approved variant parameters", () => {
        expect(GLASS.regular).toMatchObject({
            bezel: 26,
            thickness: 46,
            blur: 4.5,
            refraction: 1,
            specSaturation: 4,
            specOpacity: 0.85,
            light: -125,
        });
        expect(GLASS.clear).toMatchObject({
            bezelRatio: 0.42,
            thickness: 34,
            blur: 0.6,
            refraction: 1.15,
            specSaturation: 5,
            specOpacity: 0.95,
            light: -125,
        });
    });

    it("follows the convex squircle profile", () => {
        expect(squircle(0)).toBe(0);
        expect(squircle(1)).toBe(1);
    });

    it("is zero at the edge and at the inner end, with an interior peak normalized to 1", () => {
        const { magnitudes, max } = refractionProfile(26, 46);
        expect(magnitudes).toHaveLength(128);
        expect(magnitudes[0]).toBeCloseTo(0, 3);
        expect(magnitudes[127]).toBeCloseTo(0, 2);
        const peak = magnitudes.indexOf(Math.max(...magnitudes));
        expect(peak).toBeGreaterThan(0);
        expect(peak).toBeLessThan(127);
        expect(Math.max(...magnitudes)).toBeCloseTo(1, 5);
        expect(max).toBeGreaterThan(0);
    });

    it("sizes the bezel per variant", () => {
        expect(bezelFor(300, 200, GLASS.regular)).toBe(26);
        expect(bezelFor(60, 40, GLASS.regular)).toBe(12);
        expect(bezelFor(44, 44, GLASS.clear)).toBeCloseTo(18.48);
    });

    it("encodes inward displacement and leaves the center neutral", () => {
        const { magnitudes } = refractionProfile(26, 46);
        const w = 100,
            h = 60;
        const { displacement, specular } = glassPixels(w, h, 20, 26, magnitudes, -125);
        expect(displacement).toHaveLength(w * h * 4);
        const at = (x: number, y: number) => (y * w + x) * 4;
        expect(displacement[at(50, 30)]).toBe(128);
        expect(displacement[at(50, 30) + 1]).toBe(128);
        expect(displacement[at(6, 30)]).toBeGreaterThan(128);
        expect(displacement[at(93, 30)]).toBeLessThan(128);
        expect(specular[at(50, 30) + 3]).toBe(0);
        expect(specular[at(0, 30) + 3]).toBeGreaterThan(0);
    });

    it("builds cache keys and filter scale", () => {
        expect(filterKey("regular", 340, 120, 22.4)).toBe("regular:340x120:22");
        expect(displacementScale(10, 1.15)).toBeCloseTo(23);
    });
});
