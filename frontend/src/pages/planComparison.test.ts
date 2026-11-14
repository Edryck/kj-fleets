import { describe, expect, it } from "vitest";
import { comparePlans } from "./planComparison";

describe("comparePlans", () => {
    it("mostra a economia do Húngaro em km e %", () => {
        const c = comparePlans({ HUNGARIAN: 40, GREEDY: 50 });
        expect(c.diffKm).toBe(10);
        expect(c.diffPct).toBe(20);
        expect(c.summary).toBe("Húngaro economiza 10 km (20%) contra o Guloso");
    });

    it("resultado igual vira 'mesmo resultado'", () => {
        const c = comparePlans({ HUNGARIAN: 12.3, GREEDY: 12.3 });
        expect(c.diffKm).toBe(0);
        expect(c.summary).toBe("Mesmo resultado");
    });

    it("guloso com 0 km não divide por zero", () => {
        const c = comparePlans({ HUNGARIAN: 0, GREEDY: 0 });
        expect(c.diffPct).toBeNull();
        expect(c.summary).toBe("Mesmo resultado");
        const d = comparePlans({ HUNGARIAN: 3, GREEDY: 0 });
        expect(d.diffPct).toBeNull();
        expect(Number.isNaN(d.diffKm)).toBe(false);
    });

    it("sem um dos lados não compara", () => {
        expect(comparePlans({ HUNGARIAN: 5 }).summary).toBeNull();
    });
});
