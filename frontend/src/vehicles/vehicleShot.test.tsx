import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VehicleShot from "./VehicleShot";

describe("VehicleShot", () => {
    it("paints the mask with the registered color", () => {
        const { container } = render(
            <VehicleShot
                vehicle={{ type: "Furgão", brand: "Fiat", model: "Fiorino", color: "Vermelho" }}
                view="side"
                className="vcard-shot"
                alt="Fiat Fiorino ABC1D23"
            />,
        );
        const root = container.querySelector(".vehicle-shot") as HTMLElement;
        expect(root).toHaveClass("vcard-shot");
        expect(root.style.getPropertyValue("--paint")).toBe("#c4362f");
        expect(container.querySelector("img")).toHaveAttribute("src", "/renders/fiorino-side.webp");
        expect(container.querySelector("img")).toHaveAttribute("alt", "Fiat Fiorino ABC1D23");
        const paint = container.querySelector(".vehicle-shot-paint") as HTMLElement;
        expect(paint.style.maskImage).toBe('url("/renders/fiorino-side-paint.webp")');
        expect(paint).toHaveAttribute("aria-hidden", "true");
    });

    it("keeps the clay paint for white or unknown colors", () => {
        const { container } = render(
            <VehicleShot vehicle={{ type: "Van", color: "Branco" }} view="34" />,
        );
        expect(container.querySelector(".vehicle-shot-paint")).toBeNull();
        expect(container.querySelector("img")).toHaveAttribute("alt", "");
    });

    it("renders the fallback when no render matches", () => {
        const { container, getByText } = render(
            <VehicleShot vehicle={{ type: "Bicicleta" }} view="34" fallback={<span>sem</span>} />,
        );
        expect(container.querySelector("img")).toBeNull();
        expect(getByText("sem")).toBeInTheDocument();
    });
});
