import { describe, expect, it } from "vitest";
import garageRaw from "./garage.css?raw";
import liveMapRaw from "./live-map.css?raw";
import patternsRaw from "./patterns.css?raw";

const flat = (css: string) => css.replace(/\s+/g, " ");

function rule(css: string, selector: string): string {
    const text = flat(css);
    const start = text.indexOf(`${selector} {`);
    expect(start, `missing rule ${selector}`).toBeGreaterThanOrEqual(0);
    return text.slice(start, text.indexOf("}", start));
}

describe("vehicle render containment", () => {
    it("keeps the garage card render in flow below the plate and model text", () => {
        const shot = rule(garageRaw, ".vcard-shot");
        expect(shot).not.toContain("position: absolute");
        expect(shot).toContain("max-width: 100%");
        const img = rule(garageRaw, ".vcard .vcard-shot > img");
        expect(img).toContain("max-width: 100%");
        expect(img).toMatch(/max-height: \d+px/);
    });

    it("keeps the vehicle detail hero inside the panel", () => {
        expect(rule(garageRaw, ".vdetail-shot")).not.toMatch(/margin: 0 -\d+px/);
        expect(rule(garageRaw, ".vdetail-shot .vehicle-shot")).toContain("max-width: 100%");
        expect(rule(garageRaw, ".vdetail-shot .vehicle-shot > img")).toMatch(/max-height: \d+px/);
    });

    it("bounds the render height on the live map card and the vehicle card", () => {
        expect(rule(liveMapRaw, ".live-card-shot .vehicle-shot > img")).toMatch(
            /max-height: \d+px/,
        );
        expect(rule(patternsRaw, ".vehicle-card-shot .vehicle-shot > img")).toMatch(
            /max-height: \d+px/,
        );
    });
});
