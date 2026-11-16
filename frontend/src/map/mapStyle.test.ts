import { describe, expect, it } from "vitest";
import base from "./__fixtures__/libertyMini.json";
import { DEM_URL, PALETTES, transformStyle } from "./mapStyle";
import type { StyleSpecification } from "maplibre-gl";

const style = base as unknown as StyleSpecification;
const layer = (s: StyleSpecification, id: string) => s.layers.find((l) => l.id === id)!;

describe("transformStyle", () => {
    it("hides clutter layers", () => {
        const out = transformStyle(style, "dark");
        expect(layer(out, "poi_r1").layout?.visibility).toBe("none");
        expect(layer(out, "highway-shield").layout?.visibility).toBe("none");
    });

    it("adds separate DEM sources for terrain and hillshade", () => {
        const out = transformStyle(style, "dark");
        const dem = {
            type: "raster-dem",
            tiles: [DEM_URL],
            tileSize: 256,
            maxzoom: 13,
            encoding: "terrarium",
        };
        expect(out.sources.dem).toMatchObject(dem);
        expect(out.sources["dem-shade"]).toMatchObject(dem);
    });

    it("inserts the relief hillshade right before water", () => {
        const out = transformStyle(style, "light");
        const i = out.layers.findIndex((l) => l.id === "water");
        expect(out.layers[i - 1]).toMatchObject({
            id: "relief",
            type: "hillshade",
            source: "dem-shade",
        });
        expect(
            (out.layers[i - 1] as { paint: Record<string, unknown> }).paint[
                "hillshade-illumination-direction"
            ],
        ).toBe(315);
    });

    it("shows 3D buildings colored by render_height", () => {
        const b = layer(transformStyle(style, "dark"), "building-3d") as {
            layout?: { visibility?: string };
            paint: Record<string, unknown>;
        };
        expect(b.layout?.visibility).toBe("visible");
        expect(JSON.stringify(b.paint["fill-extrusion-color"])).toContain("render_height");
    });

    it("applies the theme palette and sky without mutating the input", () => {
        const snapshot = JSON.stringify(style);
        const dark = transformStyle(style, "dark");
        const light = transformStyle(style, "light");
        expect(dark.sky).toEqual(PALETTES.dark.sky);
        expect(light.sky).toEqual(PALETTES.light.sky);
        expect(JSON.stringify(layer(dark, "background"))).not.toEqual(
            JSON.stringify(layer(light, "background")),
        );
        expect(JSON.stringify(style)).toBe(snapshot);
    });
});
