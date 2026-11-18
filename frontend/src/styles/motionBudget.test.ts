import { describe, expect, it } from "vitest";

const SHEETS = import.meta.glob<string>("./*.css", {
    eager: true,
    query: "?raw",
    import: "default",
});
const ALLOWED = ["live-breathe", "map-ping", "spin"];

function infiniteAnimations(): { sheet: string; declaration: string }[] {
    const found: { sheet: string; declaration: string }[] = [];
    for (const [sheet, css] of Object.entries(SHEETS)) {
        for (const match of css.matchAll(/animation:\s*([^;]+);/g)) {
            if (/\binfinite\b/.test(match[1])) found.push({ sheet, declaration: match[1].trim() });
        }
    }
    return found;
}

describe("motion budget behind the glass", () => {
    it("runs no infinite animation beyond the live dot, the map pings and the loading spinner", () => {
        const names = infiniteAnimations().map(({ declaration }) => declaration.split(/\s+/)[0]);
        expect(names.length).toBeGreaterThan(0);
        expect(names.filter((name) => !ALLOWED.includes(name))).toEqual([]);
    });

    it("lets the live dot breathe in discrete steps so the glass recomputes a few times a second", () => {
        const breathing = infiniteAnimations().filter(({ declaration }) =>
            declaration.startsWith("live-breathe"),
        );
        expect(breathing.length).toBeGreaterThanOrEqual(2);
        for (const { declaration } of breathing) expect(declaration).toMatch(/steps\(\d+/);
    });
});
