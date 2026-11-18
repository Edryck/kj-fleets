import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../test/render";
import { WithTitleBlock } from "../test/titleBlock";
import { Forbidden, NotFound, PendingScreen } from "./SystemPages";

vi.mock("../realtime/useTopic", () => ({
    useTopic: () => {},
    useTopics: () => {},
    useConnectionState: () => "connected",
}));

describe("system pages", () => {
    it.each([
        [<NotFound key="404" />, "404", "Não encontramos este item"],
        [<Forbidden key="403" />, "403", "Você não tem acesso a esta página"],
    ])("shows the big code, a sentence and a way back", (page, code, title) => {
        renderAt("/x", page);
        expect(screen.getByText(code)).toHaveClass("system-code");
        expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Voltar/ })).toHaveAttribute("href", "/dashboard");
    });

    it.each([
        [<NotFound key="404" />, "Página não encontrada"],
        [<Forbidden key="403" />, "Sem permissão"],
    ])("names the page in the title block", (page, title) => {
        renderAt("/gestao/qualquer", <WithTitleBlock>{page}</WithTitleBlock>);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(title);
    });

    it("shows a pending screen as a flat skeleton in glass", () => {
        renderAt("/x", <PendingScreen title="Relatórios" />);
        const panel = screen.getByRole("region", { name: "Relatórios" });
        expect(panel).toHaveClass("glass");
        expect(panel.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
        expect(panel.textContent).toContain("Esta tela ainda não foi construída.");
    });
});
