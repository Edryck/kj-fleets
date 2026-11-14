import { describe, expect, it } from "vitest";
import { formatAgo, formatKm, formatMinutes, formatPercent, formatRate } from "./format";

describe("format", () => {
    it("rate nulo vira traço, nunca 0%", () => {
        expect(formatRate(null)).toBe("—");
        expect(formatRate(0)).toBe("0%");
        expect(formatRate(Number.NaN)).not.toContain("NaN");
    });
    it("formata fração como porcentagem com vírgula", () => {
        expect(formatRate(0.8765)).toBe("87,7%");
        expect(formatRate(1)).toBe("100%");
    });
    it("busyPct já vem em 0..100", () => {
        expect(formatPercent(42.5)).toBe("42,5%");
        expect(formatPercent(null)).toBe("—");
    });
    it("minutos viram horas e minutos", () => {
        expect(formatMinutes(80)).toBe("1h 20min");
        expect(formatMinutes(60)).toBe("1h");
        expect(formatMinutes(45)).toBe("45min");
        expect(formatMinutes(null)).toBe("—");
    });
    it("km", () => {
        expect(formatKm(12.34)).toBe("12,3 km");
        expect(formatKm(null)).toBe("—");
    });
});

describe("formatAgo", () => {
    const now = Date.parse("2026-11-14T12:00:00Z");
    it("formats seconds, minutes, hours and null", () => {
        expect(formatAgo("2026-11-14T11:59:48Z", now)).toBe("há 12 s");
        expect(formatAgo("2026-11-14T11:55:00Z", now)).toBe("há 5 min");
        expect(formatAgo("2026-11-14T09:00:00Z", now)).toBe("há 3 h");
        expect(formatAgo(null, now)).toBe("—");
    });
});
