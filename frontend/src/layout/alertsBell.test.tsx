import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Alert, Alerts } from "../api/types";
import AlertsBell from "./AlertsBell";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../api/http", () => ({ request }));

afterEach(() => {
    cleanup();
    request.mockReset();
});

const alert = (n: number, severity: Alert["severity"]): Alert => ({
    type: "STALE_ORDER",
    severity,
    subjectType: "ORDER",
    subjectId: `o${n}`,
    message: `Alerta ${n}`,
    suggestedAction: "Verificar",
    since: new Date(Date.now() - n * 60_000).toISOString(),
});

const meta = {
    generatedAt: "",
    timezone: "America/Sao_Paulo",
    period: "now",
    from: null,
    to: null,
};

function mount(data: Alerts) {
    request.mockResolvedValue(data);
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter>
                <AlertsBell />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe("sino de alertas", () => {
    it("badge soma as contagens e o popover lista os 5 mais severos", async () => {
        const items = [
            alert(1, "LOW"),
            alert(2, "LOW"),
            alert(3, "MEDIUM"),
            alert(4, "HIGH"),
            alert(5, "MEDIUM"),
            alert(6, "HIGH"),
            alert(7, "LOW"),
        ];
        mount({ meta, items, counts: { STALE_ORDER: 5, DRIVER_NO_SIGNAL: 2 } });
        const bell = await screen.findByRole("button", { name: /Alertas/ });
        expect((await screen.findByText("7")).textContent).toBe("7");
        await userEvent.click(bell);
        const list = await screen.findAllByRole("listitem");
        expect(list).toHaveLength(5);
        expect(list[0].textContent).toContain("Alerta 6");
        expect(screen.queryByText("Alerta 1")).toBeNull();
        expect(screen.getByRole("link", { name: "Ver todos" }).getAttribute("href")).toBe(
            "/alerts",
        );
    });

    it("sem alertas mostra estado positivo e nenhum badge", async () => {
        mount({ meta, items: [], counts: {} });
        await userEvent.click(await screen.findByRole("button", { name: /Alertas/ }));
        expect(await screen.findByText("Nenhum alerta agora")).toBeTruthy();
        expect(screen.queryByText("0")).toBeNull();
    });
});
