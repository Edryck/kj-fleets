import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Glass from "./Glass";

describe("Glass", () => {
    it("renders a regular glass surface by default", () => {
        render(<Glass data-testid="g">conteúdo</Glass>);
        const el = screen.getByTestId("g");
        expect(el).toHaveAttribute("data-glass", "regular");
        expect(el.className).toContain("glass glass-regular");
    });

    it("renders the requested element and variant", () => {
        render(<Glass as="button" variant="clear" press aria-label="Tema" />);
        const el = screen.getByRole("button", { name: "Tema" });
        expect(el).toHaveAttribute("data-glass", "clear");
        expect(el.className).toContain("glass-press");
    });

    it("renders flat when nested and warns in development", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        render(
            <Glass>
                <Glass data-testid="inner">dentro</Glass>
            </Glass>,
        );
        const inner = screen.getByTestId("inner");
        expect(inner).toHaveAttribute("data-glass", "flat");
        expect(inner.className).toContain("glass-flat");
        expect(inner.className).not.toContain("glass-regular");
        expect(warn).toHaveBeenCalledWith("Glass dentro de Glass renderiza chapado");
        warn.mockRestore();
    });

    it("does not set a refraction filter outside Chromium", () => {
        render(<Glass data-testid="g" />);
        expect(screen.getByTestId("g").style.getPropertyValue("--glass-filter")).toBe("");
    });
});
