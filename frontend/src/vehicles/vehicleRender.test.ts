import { describe, expect, it } from "vitest";
import { colorHex, colorSwatch, findModel, typeOf, vehicleName } from "./catalog";
import { vehicleRender } from "./vehicleRender";

describe("vehicle catalog", () => {
    it("finds a model ignoring accents, case and the brand spelling", () => {
        expect(findModel("Fiat", "fiorino")?.key).toBe("fiorino");
        expect(findModel("mercedes benz", "Sprinter 416")?.key).toBe("sprinter");
        expect(findModel("VW", "Delivery 9.170")?.key).toBe("delivery");
        expect(findModel(null, "Honda CG 160 Cargo")?.key).toBe("cg-cargo");
        expect(findModel("Renault", "Master")).toBeNull();
        expect(findModel(null, null)).toBeNull();
    });

    it("reads the fixed type list and older free-text types", () => {
        expect(typeOf("Caminhão leve")).toBe("Caminhão leve");
        expect(typeOf("caminhao")).toBe("Caminhão");
        expect(typeOf("truck")).toBe("Caminhão");
        expect(typeOf("VUC")).toBe("Caminhão leve");
        expect(typeOf("Utilitário")).toBe("Furgão");
        expect(typeOf("van")).toBe("Van");
        expect(typeOf("Motocicleta")).toBe("Moto");
        expect(typeOf("Bicicleta")).toBeNull();
        expect(typeOf("  ")).toBeNull();
    });

    it("names a vehicle by brand and model, falling back to the type", () => {
        expect(vehicleName({ type: "Furgão", brand: " Fiat ", model: "Fiorino" })).toBe(
            "Fiat Fiorino",
        );
        expect(vehicleName({ type: "Furgão", brand: null, model: "Fiorino" })).toBe("Fiorino");
        expect(vehicleName({ type: " Van ", brand: null, model: null })).toBe("Van");
        expect(vehicleName({ type: "", brand: null, model: null })).toBe("Veículo");
    });

    it("maps palette names to paint colors and leaves white unpainted", () => {
        expect(colorHex("Vermelho")).toBe("#c4362f");
        expect(colorHex("vermelho")).toBe("#c4362f");
        expect(colorHex("Branco")).toBeNull();
        expect(colorHex("Roxo metálico")).toBeNull();
        expect(colorHex(null)).toBeNull();
    });

    it("gives every palette color a swatch, white included", () => {
        expect(colorSwatch("Branco")).toBe("#f2f3ef");
        expect(colorSwatch("Azul")).toBe("#2f5fa8");
        expect(colorSwatch("Roxo metálico")).toBeNull();
    });
});

describe("vehicleRender", () => {
    it("uses the catalog model render with its paint mask", () => {
        expect(
            vehicleRender({ type: "Furgão", brand: "Fiat", model: "Fiorino" }, "side"),
        ).toMatchObject({
            src: "/renders/fiorino-side.webp",
            paint: "/renders/fiorino-side-paint.webp",
        });
        expect(
            vehicleRender({ type: "Caminhão", brand: "Mercedes-Benz", model: "Atego 1719" }, "34")
                ?.src,
        ).toBe("/renders/atego-34.webp");
    });

    it("falls back to the default model of the type", () => {
        expect(vehicleRender({ type: "Van" }, "34")?.src).toBe("/renders/sprinter-34.webp");
        expect(
            vehicleRender({ type: "Furgão", brand: "Renault", model: "Master" }, "side")?.src,
        ).toBe("/renders/fiorino-side.webp");
        expect(vehicleRender({ type: "Caminhão leve" }, "side")?.src).toBe(
            "/renders/delivery-side.webp",
        );
        expect(vehicleRender({ type: "Caminhão" }, "side")?.src).toBe(
            "/renders/constellation-side.webp",
        );
        expect(vehicleRender({ type: "Moto" }, "side")?.src).toBe("/renders/cg-cargo-side.webp");
    });

    it("lets a catalog model win over a mismatched type", () => {
        expect(vehicleRender({ type: "Van", brand: "Honda", model: "Biz 125" }, "34")?.src).toBe(
            "/renders/biz-34.webp",
        );
    });

    it("returns null without a known type or model", () => {
        expect(vehicleRender({ type: "Bicicleta" }, "side")).toBeNull();
        expect(vehicleRender({ type: "   " }, "34")).toBeNull();
        expect(vehicleRender(null, "34")).toBeNull();
    });

    it("declares intrinsic sizes to avoid layout shift", () => {
        const render = vehicleRender({ type: "Van" }, "34");
        expect(render?.width).toBeGreaterThan(0);
        expect(render?.height).toBeGreaterThan(0);
    });
});
