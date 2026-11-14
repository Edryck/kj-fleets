import { beforeEach, describe, expect, it } from "vitest";
import { readTheme, toggleTheme } from "./theme";

describe("theme", () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute("data-theme");
    });

    it("começa no tema escuro quando nada foi salvo", () => {
        expect(readTheme()).toBe("dark");
    });

    it("alterna e persiste a escolha em kjfleets.theme", () => {
        expect(toggleTheme()).toBe("light");
        expect(localStorage.getItem("kjfleets.theme")).toBe("light");
        expect(readTheme()).toBe("light");
        expect(document.documentElement.dataset.theme).toBe("light");

        expect(toggleTheme()).toBe("dark");
        expect(localStorage.getItem("kjfleets.theme")).toBe("dark");
    });
});
