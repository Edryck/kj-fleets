import { describe, expect, it } from "vitest";
import { arcPoints, arcsToGeoJSON, legsToGeoJSON } from "./mapLayers";

describe("map layers data", () => {
    it("converts legs to GeoJSON with [lng, lat] and keeps the kind", () => {
        const fc = legsToGeoJSON([
            {
                kind: "original",
                points: [
                    [-24.86, -54.33],
                    [-25.09, -54.24],
                ],
            },
        ]);
        expect(fc.features[0].properties.kind).toBe("original");
        expect(fc.features[0].geometry.coordinates[0]).toEqual([-54.33, -24.86]);
    });

    it("draws a curved arc that starts and ends exactly at the endpoints", () => {
        const pts = arcPoints([-24.79, -54.19], [-24.858, -54.329], 48);
        expect(pts).toHaveLength(49);
        expect(pts[0]).toEqual([-24.79, -54.19]);
        expect(pts[48]).toEqual([-24.858, -54.329]);
        const mid = pts[24];
        const straight = [(-24.79 + -24.858) / 2, (-54.19 + -54.329) / 2];
        expect(Math.hypot(mid[0] - straight[0], mid[1] - straight[1])).toBeGreaterThan(0.001);
    });

    it("truncates arcs by progress", () => {
        const fc = arcsToGeoJSON([{ id: "a", from: [0, 0], to: [1, 1] }], 0.5);
        expect(fc.features[0].geometry.coordinates.length).toBeLessThan(49);
        expect(fc.features[0].geometry.coordinates.length).toBeGreaterThan(1);
    });
});
