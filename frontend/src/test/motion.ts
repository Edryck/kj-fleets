import { vi } from "vitest";

export function setReducedMotion(matches: boolean): void {
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query.includes("prefers-reduced-motion") ? matches : false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
    }));
}
