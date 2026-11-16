import { describe, expect, it } from "vitest";
import {
    diffMarkers,
    glidePosition,
    markerClassName,
    renderMarker,
    type SceneMarker,
} from "./markers";

describe("markers", () => {
    const m = (id: string, extra: Partial<SceneMarker> = {}): SceneMarker => ({
        id,
        lat: -24.8,
        lng: -54.3,
        kind: "driver",
        ...extra,
    });

    it("diffs markers by id", () => {
        const current = new Map([
            ["a", m("a")],
            ["b", m("b")],
        ]);
        const d = diffMarkers(current, [m("b", { lat: -24.9 }), m("c")]);
        expect(d.add.map((x) => x.id)).toEqual(["c"]);
        expect(d.update.map((x) => x.id)).toEqual(["b"]);
        expect(d.remove).toEqual(["a"]);
    });

    it("builds class names from state", () => {
        expect(markerClassName(m("a", { kind: "order", stale: true, selected: true }), true)).toBe(
            "maplibregl-marker map-marker map-marker-order is-selected is-stale is-clickable",
        );
        expect(
            markerClassName(m("s", { kind: "waypoint", dimmed: true, next: false }), false),
        ).toBe("maplibregl-marker map-marker map-marker-waypoint is-dimmed");
    });

    it("renders HUD labels as text, never HTML", () => {
        const el = document.createElement("div");
        renderMarker(
            el,
            m("h", { kind: "hud", hud: { label: "Sem sinal", value: "<b>9 min</b>", warn: true } }),
        );
        expect(el.querySelector(".hud-box")?.textContent).toContain("Sem sinal");
        expect(el.querySelector("b")).toBeNull();
        expect(el.querySelector(".hud-stem")).not.toBeNull();
        expect(el.classList.contains("is-warn")).toBe(true);
    });

    it("eases glide positions", () => {
        expect(glidePosition([0, 0], [10, 20], 0)).toEqual([0, 0]);
        expect(glidePosition([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
        expect(glidePosition([0, 0], [10, 20], 1)).toEqual([10, 20]);
    });
});
