import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import NewOrder, { MAX_WAYPOINTS } from "./NewOrder";

vi.mock("../components/MapView", () => ({ default: () => null }));
vi.mock("../auth/session", () => ({ useSession: () => ({ role: "CUSTOMER" }) }));

afterEach(cleanup);

function renderForm() {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter>
                <NewOrder />
            </MemoryRouter>
        </QueryClientProvider>,
    );
    for (const b of screen.getAllByRole("button", { name: "Novo ponto" })) fireEvent.click(b);
}

describe("novo pedido", () => {
    it("exige retirada e entrega", async () => {
        renderForm();
        await userEvent.click(screen.getByRole("button", { name: "Criar pedido" }));
        expect((await screen.findAllByText("Informe o nome")).length).toBe(2);
        expect(screen.getAllByText("Informe a latitude").length).toBe(2);
    });

    it("valida faixa de latitude e longitude", async () => {
        renderForm();
        const lats = screen.getAllByLabelText("Latitude");
        const lngs = screen.getAllByLabelText("Longitude");
        await userEvent.type(lats[0], "91");
        await userEvent.type(lngs[0], "-181");
        await userEvent.click(screen.getByRole("button", { name: "Criar pedido" }));
        expect(await screen.findByText("Latitude entre -90 e 90")).toBeTruthy();
        expect(screen.getByText("Longitude entre -180 e 180")).toBeTruthy();
    });

    it("quantidade do item precisa ser pelo menos 1", async () => {
        renderForm();
        await userEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
        const qty = screen.getByLabelText("Quantidade do item 1");
        await userEvent.clear(qty);
        await userEvent.type(qty, "0");
        await userEvent.click(screen.getByRole("button", { name: "Criar pedido" }));
        expect(await screen.findByText("Quantidade mínima: 1")).toBeTruthy();
    });

    it("grows the stop timeline as stops are added", async () => {
        renderForm();
        const list = screen.getByRole("list", { name: "Paradas" });
        const before = within(list).getAllByRole("listitem").length;
        await userEvent.click(screen.getByRole("button", { name: /Adicionar parada/ }));
        expect(within(list).getAllByRole("listitem")).toHaveLength(before + 1);
    });

    it("keeps pickup first and dropoff last in the stop timeline", async () => {
        renderForm();
        await userEvent.click(screen.getByRole("button", { name: /Adicionar parada/ }));
        const items = within(screen.getByRole("list", { name: "Paradas" })).getAllByRole(
            "listitem",
        );
        expect(items.map((item) => item.querySelector("legend")?.textContent)).toEqual([
            "Retirada",
            "Parada 1",
            "Entrega",
        ]);
    });

    it("marks a stop as on the map once its coordinates are valid", async () => {
        renderForm();
        const [pickup] = within(screen.getByRole("list", { name: "Paradas" })).getAllByRole(
            "listitem",
        );
        expect(within(pickup).getByText("sem localização")).toBeInTheDocument();
        await userEvent.type(within(pickup).getByLabelText("Latitude"), "-24.7");
        await userEvent.type(within(pickup).getByLabelText("Longitude"), "-53.7");
        expect(within(pickup).getByText("no mapa")).toBeInTheDocument();
    });

    it("bloqueia a 51ª parada", () => {
        renderForm();
        const add = screen.getByRole("button", { name: "Adicionar parada" });
        for (let i = 0; i < MAX_WAYPOINTS; i++) fireEvent.click(add);
        expect(screen.getAllByRole("button", { name: /Remover parada/ }).length).toBe(
            MAX_WAYPOINTS,
        );
        expect((add as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("50/50")).toBeTruthy();
    }, 60_000);
}, 30_000);
