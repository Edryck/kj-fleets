import { describe, expect, it } from "vitest";
import garageRaw from "./garage.css?raw";
import liveMapRaw from "./live-map.css?raw";
import patternsRaw from "./patterns.css?raw";

const SHEETS = import.meta.glob<string>("./*.css", {
    eager: true,
    query: "?raw",
    import: "default",
});

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

    it("pins the detail hero to the top of the tablet sheet instead of centering it in the long field column", () => {
        const text = flat(garageRaw);
        const start = text.indexOf("@media (min-width: 768px) and (max-width: 1023px)");
        expect(start).toBeGreaterThanOrEqual(0);
        const block = text.slice(start, text.indexOf("@media", start + 10));
        const shot = rule(block, ".vdetail-shot");
        expect(shot).not.toContain("height: 100%");
        expect(shot).toContain("align-self: start");
        const cap = rule(block, ".vdetail-shot .vehicle-shot > img").match(/max-height: (\d+)px/);
        expect(Number(cap?.[1])).toBeLessThanOrEqual(170);
    });

    it("bounds the render height on the live map card and the vehicle card", () => {
        expect(rule(liveMapRaw, ".live-card-shot .vehicle-shot > img")).toMatch(
            /max-height: \d+px/,
        );
        expect(rule(patternsRaw, ".vehicle-card-shot .vehicle-shot > img")).toMatch(
            /max-height: \d+px/,
        );
    });

    it("never gives the paint wrapper a width wider than a height-capped render", () => {
        const rules = Object.values(SHEETS).flatMap((css) =>
            [...flat(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
                selector: match[1].trim(),
                body: match[2],
            })),
        );
        const capped = rules
            .filter(
                (r) =>
                    /\.(vehicle|vcard)-shot > img$/.test(r.selector) && /max-height/.test(r.body),
            )
            .map((r) => r.selector.replace(/ \.(vehicle|vcard)-shot > img$/, ""));
        expect(capped.length).toBeGreaterThanOrEqual(4);
        const offenders = rules
            .filter((r) =>
                r.selector
                    .split(",")
                    .some(
                        (part) =>
                            /\.(vehicle|vcard)-shot$/.test(part.trim()) &&
                            capped.some((context) => part.includes(context)),
                    ),
            )
            .filter((r) => {
                const width = r.body.match(/(?:^|;)\s*width:\s*([^;]+)/);
                return width !== null && !/^(auto|fit-content)$/.test(width[1].trim());
            })
            .map((r) => r.selector);
        expect(offenders).toEqual([]);
    });
});
