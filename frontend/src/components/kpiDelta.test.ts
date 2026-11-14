import { describe, expect, it } from "vitest";
import { kpiDelta } from "./kpiDelta";

describe("kpiDelta", () => {
    it("sem período anterior não há variação", () => {
        expect(kpiDelta(5, undefined, "up")).toBeNull();
        expect(kpiDelta(5, null, "up")).toBeNull();
    });

    it("mais concluídos é positivo", () => {
        expect(kpiDelta(8, 5, "up")).toMatchObject({ diff: 3, tone: "success", text: "+3" });
    });

    it("mais falhas é perigo, nunca verde", () => {
        expect(kpiDelta(4, 1, "down")).toMatchObject({ diff: 3, tone: "danger" });
    });

    it("menos falhas é positivo", () => {
        expect(kpiDelta(1, 4, "down")).toMatchObject({ diff: -3, tone: "success", text: "-3" });
    });

    it("métrica neutra e variação zero ficam neutras", () => {
        expect(kpiDelta(9, 3, "neutral")?.tone).toBe("neutral");
        expect(kpiDelta(3, 3, "down")).toMatchObject({ diff: 0, tone: "neutral", text: "igual" });
    });
});
