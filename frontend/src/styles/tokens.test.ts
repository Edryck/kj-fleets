import { describe, expect, it } from "vitest";
import raw from "./tokens.css?raw";

const css = raw.replace(/\s+/g, " ");

const block = (selector: string) => {
    const start = css.indexOf(selector);
    return css.slice(start, css.indexOf("}", start));
};

describe("design tokens", () => {
    it("defines the forest palette for both themes", () => {
        expect(block('[data-theme="dark"]')).toContain("--color-bg: #0c1511");
        expect(block('[data-theme="light"]')).toContain("--color-bg: #e8ede4");
        expect(block('[data-theme="dark"]')).toContain("--color-route: #b7f52a");
        expect(block('[data-theme="light"]')).toContain("--color-route: #5f9410");
        expect(block('[data-theme="dark"]')).toContain("--color-info: #7cc4e8");
        expect(css).toContain("--color-accent: #b7f52a");
        expect(css).toContain("--color-brand-orange: #ff6a00");
    });

    it("uses the Apple font stacks with Inter as fallback", () => {
        expect(css).toContain(
            '--font-display: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
        );
        expect(css).toContain(
            '--font-ui: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
        );
        expect(css).toContain(
            '--font-mono: "SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        );
    });

    it("keeps legacy aliases pointing at the new tokens", () => {
        expect(css).toContain("--color-primary: var(--color-accent)");
        expect(css).toContain("--color-on-primary: var(--color-accent-ink)");
        expect(css).toContain("--color-background: var(--color-bg)");
    });
});
