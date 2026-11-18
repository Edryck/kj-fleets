import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StaticMapBackdrop from "./StaticMapBackdrop";

const { mapInstances, themeListeners, switchStyle } = vi.hoisted(() => ({
    mapInstances: [] as {
        options: Record<string, unknown>;
        setTerrain: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
    }[],
    themeListeners: [] as ((theme: "dark" | "light") => void)[],
    switchStyle: vi.fn(async () => {}),
}));

vi.mock("./maplibre", () => ({
    MapLibreMap: class {
        options: Record<string, unknown>;
        setTerrain = vi.fn();
        remove = vi.fn();
        constructor(options: Record<string, unknown>) {
            this.options = options;
            mapInstances.push(this);
        }
    },
    currentTheme: () => "dark",
    loadStyleOrFallback: vi.fn(async () => ({ version: 8, sources: {}, layers: [] })),
    observeTheme: (listener: (theme: "dark" | "light") => void) => {
        themeListeners.push(listener);
        return () => {};
    },
    switchStyle,
}));

beforeEach(() => {
    mapInstances.length = 0;
    themeListeners.length = 0;
    switchStyle.mockClear();
    vi.stubGlobal("WebGLRenderingContext", function WebGLRenderingContext() {});
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("StaticMapBackdrop", () => {
    it("creates a non-interactive flat map without terrain", async () => {
        render(<StaticMapBackdrop />);
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        expect(mapInstances[0].options).toMatchObject({
            interactive: false,
            center: [-54.18, -24.93],
            zoom: 9.6,
            pitch: 0,
            attributionControl: { compact: true },
        });
        expect(mapInstances[0].setTerrain).not.toHaveBeenCalled();
    });

    it("follows the theme and removes the map on unmount", async () => {
        const { unmount } = render(<StaticMapBackdrop />);
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        themeListeners[0]("light");
        expect(switchStyle).toHaveBeenCalledWith(mapInstances[0], "light", expect.any(Function));
        unmount();
        expect(mapInstances[0].remove).toHaveBeenCalled();
    });

    it("stays a plain veil when the browser has no WebGL", async () => {
        vi.unstubAllGlobals();
        const { container } = render(<StaticMapBackdrop />);
        expect(container.querySelector(".auth-veil")).not.toBeNull();
        await new Promise((r) => setTimeout(r, 20));
        expect(mapInstances).toHaveLength(0);
    });
});
