import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MapStage from "./MapStage";

vi.mock("./maplibre", () => ({
    MapLibreMap: class {},
    currentTheme: () => "dark",
    loadStyleOrFallback: () => new Promise(() => {}),
    observeTheme: () => () => {},
    switchStyle: async () => {},
}));

describe("MapStage", () => {
    it("takes the hidden map out of the tab order", () => {
        const { container, rerender } = render(<MapStage visible={false} />);
        const stage = container.querySelector(".map-stage")!;
        expect(stage).toHaveAttribute("aria-hidden", "true");
        expect(stage).toHaveAttribute("inert", "");
        rerender(<MapStage visible />);
        expect(stage.hasAttribute("inert")).toBe(false);
    });
});
