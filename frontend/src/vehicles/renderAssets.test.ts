import { describe, expect, it } from "vitest";
import { VEHICLE_MODELS } from "./catalog";
import { vehicleRender, type VehicleView } from "./vehicleRender";

const FILES = import.meta.glob<string>("/public/renders/*.webp", {
    eager: true,
    query: "?inline",
    import: "default",
});
const VIEWS: VehicleView[] = ["34", "side"];

function bytes(src: string): string | null {
    const data = FILES[`/public${src}`];
    return data ? atob(data.slice(data.indexOf(",") + 1)) : null;
}

function webpSize(data: string): [number, number] {
    expect(data.slice(0, 4)).toBe("RIFF");
    expect(data.slice(8, 16)).toBe("WEBPVP8X");
    const read = (at: number) =>
        data.charCodeAt(at) | (data.charCodeAt(at + 1) << 8) | (data.charCodeAt(at + 2) << 16);
    return [1 + read(24), 1 + read(27)];
}

describe("vehicle render assets", () => {
    for (const model of VEHICLE_MODELS) {
        for (const view of VIEWS) {
            it(`${model.key} ${view} has a render and a paint mask of the declared size`, () => {
                const info = vehicleRender({ brand: model.brand, model: model.model }, view);
                expect(info?.key).toBe(model.key);
                const shot = bytes(info!.src);
                const paint = bytes(info!.paint);
                expect(shot).not.toBeNull();
                expect(paint).not.toBeNull();
                expect(webpSize(shot!)).toEqual([info!.width, info!.height]);
                expect(webpSize(paint!)).toEqual([info!.width, info!.height]);
            });
        }
    }

    it("keeps no renders from the old van and truck set", () => {
        expect(Object.keys(FILES).filter((path) => /\/(van|truck)-/.test(path))).toEqual([]);
    });
});
