import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RoleFigure from "./RoleFigure";
import { personFigure } from "./personFigure";

describe("personFigure", () => {
    it("maps each role to its bust render", () => {
        expect(personFigure("DRIVER", "bust")).toBe("/people/driver-bust.webp");
        expect(personFigure("ADMIN", "bust")).toBe("/people/admin-bust.webp");
        expect(personFigure("DISPATCHER")).toBe("/people/dispatcher-bust.webp");
        expect(personFigure("CUSTOMER", "bust")).toBe("/people/customer-bust.webp");
    });

    it("uses kebab case and no suffix for the full figure", () => {
        expect(personFigure("FLEET_MANAGER", "full")).toBe("/people/fleet-manager.webp");
        expect(personFigure("DRIVER", "full")).toBe("/people/driver.webp");
    });

    it("returns null for unknown or missing roles", () => {
        expect(personFigure("AUDITOR", "bust")).toBeNull();
        expect(personFigure(undefined)).toBeNull();
        expect(personFigure(null, "full")).toBeNull();
    });
});

describe("RoleFigure", () => {
    it("shows the role figure as decoration over the initials", () => {
        const { container, getByText } = render(
            <RoleFigure role="CUSTOMER" name="Ana Lima" size="lg" />,
        );
        const root = container.querySelector(".avatar") as HTMLElement;
        expect(root).toHaveClass("is-lg");
        expect(root).toHaveClass("has-figure");
        expect(root).toHaveAttribute("aria-hidden", "true");
        const img = container.querySelector("img");
        expect(img).toHaveAttribute("src", "/people/customer-bust.webp");
        expect(img).toHaveAttribute("alt", "");
        expect(getByText("AL")).toBeInTheDocument();
    });

    it("falls back to the initials when the image fails", () => {
        const { container, getByText } = render(<RoleFigure role="DRIVER" name="Bruno Souza" />);
        fireEvent.error(container.querySelector("img") as HTMLImageElement);
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector(".avatar")).not.toHaveClass("has-figure");
        expect(getByText("BS")).toBeInTheDocument();
    });

    it("keeps plain initials for an unknown role", () => {
        const { container, getByText } = render(<RoleFigure role="AUDITOR" name="Carla" />);
        expect(container.querySelector("img")).toBeNull();
        expect(getByText("CA")).toBeInTheDocument();
    });

    it("renders the full figure without the avatar frame", () => {
        const { container } = render(
            <RoleFigure role="ADMIN" name="Admin" variant="full" className="account-figure" />,
        );
        const root = container.querySelector(".person-figure") as HTMLElement;
        expect(root).toHaveClass("account-figure");
        expect(container.querySelector(".avatar")).toBeNull();
        expect(container.querySelector("img")).toHaveAttribute("src", "/people/admin.webp");
    });
});
