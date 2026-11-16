import { describe, expect, it } from "vitest";
import { vehicleRender } from "./vehicleRender";

describe("vehicleRender", () => {
    it("maps trucks and vans by free-text type", () => {
        expect(vehicleRender("Caminhão leve", "side")?.src).toBe("/renders/truck-side.webp");
        expect(vehicleRender("truck", "34")?.src).toBe("/renders/truck-34.webp");
        expect(vehicleRender("Van", "34")?.src).toBe("/renders/van-34.webp");
        expect(vehicleRender("Furgão", "side")?.src).toBe("/renders/van-side.webp");
        expect(vehicleRender("Utilitário", "side")?.src).toBe("/renders/van-side.webp");
    });

    it("returns null for unknown, empty or missing types", () => {
        expect(vehicleRender("Moto", "side")).toBeNull();
        expect(vehicleRender("", "side")).toBeNull();
        expect(vehicleRender("   ", "34")).toBeNull();
        expect(vehicleRender(null, "34")).toBeNull();
        expect(vehicleRender(undefined, "34")).toBeNull();
    });

    it("declares intrinsic sizes to avoid layout shift", () => {
        expect(vehicleRender("Van", "34")).toMatchObject({ width: 960, height: 541 });
        expect(vehicleRender("Caminhão", "side")).toMatchObject({ width: 900, height: 410 });
    });
});
