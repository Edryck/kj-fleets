import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { getSession } from "../auth/session";
import { setReducedMotion } from "./motion";
import { currentPath, renderAt } from "./render";

describe("test kit", () => {
    it("provides the DOM matchers", () => {
        render(
            <button aria-label="Tema" className="btn is-on" disabled>
                x
            </button>,
        );
        const button = screen.getByRole("button");
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute("aria-label", "Tema");
        expect(button).toHaveClass("btn", "is-on");
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleName("Tema");
    });

    it("renders at a path with a session and tracks navigation", async () => {
        renderAt("/a?x=1", <Link to="/b?y=2">ir</Link>, { role: "DISPATCHER" });
        expect(getSession()?.role).toBe("DISPATCHER");
        expect(currentPath()).toBe("/a?x=1");
        await userEvent.click(screen.getByRole("link", { name: "ir" }));
        expect(currentPath()).toBe("/b?y=2");
    });

    it("simulates reduced motion", () => {
        setReducedMotion(true);
        expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    });
});
