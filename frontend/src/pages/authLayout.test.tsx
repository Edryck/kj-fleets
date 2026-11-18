import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderAt } from "../test/render";
import Login from "./Login";
import Register from "./Register";

describe("entry screens", () => {
    it.each([
        ["/login", <Login key="login" />, "Acesse sua conta"],
        ["/register", <Register key="register" />, "Criar conta de cliente"],
    ])("%s puts the form in a glass card over the static map", (path, page, title) => {
        renderAt(path, page);
        const heading = screen.getByRole("heading", { level: 1, name: title });
        const card = heading.closest(".auth-card")!;
        expect(card).toHaveClass("glass");
        expect(card.querySelector("form")).not.toBeNull();
        expect(document.querySelector(".auth-backdrop .auth-veil")).not.toBeNull();
    });
});
