import { describe, expect, it } from "vitest";
import { personFigure } from "./personFigure";

const FILES = import.meta.glob<string>("/public/people/*.webp", {
    eager: true,
    query: "?inline",
    import: "default",
});
const ROLES = ["ADMIN", "DISPATCHER", "FLEET_MANAGER", "DRIVER", "CUSTOMER"];

describe("people figure assets", () => {
    for (const role of ROLES) {
        it(`${role} has a full figure and a bust on disk`, () => {
            for (const variant of ["full", "bust"] as const) {
                const data = FILES[`/public${personFigure(role, variant)}`];
                expect(data).toBeDefined();
                const head = atob(data.slice(data.indexOf(",") + 1, data.indexOf(",") + 25));
                expect(head.slice(0, 4)).toBe("RIFF");
                expect(head.slice(8, 12)).toBe("WEBP");
            }
        });
    }
});
