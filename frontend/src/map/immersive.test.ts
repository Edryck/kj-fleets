import { expect, it } from "vitest";
import { isImmersive } from "./immersive";

it.each([
    ["/dashboard", true],
    ["/dashboard/dispatch", true],
    ["/dashboard/fleet", true],
    ["/map", true],
    ["/dispatch", true],
    ["/routes/optimize", true],
    ["/orders/KJ7Q2M9XAB", true],
    ["/orders", false],
    ["/orders/new", false],
    ["/vehicles", false],
    ["/account", false],
])("staff %s immersive = %s", (path, expected) => {
    expect(isImmersive(path, "ADMIN")).toBe(expected);
});

it("never shows the continuous map to customers", () => {
    expect(isImmersive("/dashboard", "CUSTOMER")).toBe(false);
    expect(isImmersive("/orders/KJ7Q2M9XAB", "CUSTOMER")).toBe(false);
});
