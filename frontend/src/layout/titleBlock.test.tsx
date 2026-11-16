import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import TitleBlock from "./TitleBlock";
import { createTitleBlockStore, TitleBlockContext, useTitleBlock } from "./titleBlockContext";

vi.mock("../realtime/useTopic", () => ({ useConnectionState: () => "connected" }));

function Page({ hook }: { hook: () => void }) {
    hook();
    return null;
}

function Frame({ hook }: { hook: () => void }) {
    const [store] = useState(createTitleBlockStore);
    return (
        <TitleBlockContext.Provider value={store}>
            <TitleBlock />
            <Page hook={hook} />
        </TitleBlockContext.Provider>
    );
}

function renderAt(path: string, hook: () => void) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Frame hook={hook} />
        </MemoryRouter>,
    );
}

it("uses the route title and the page meta", () => {
    renderAt("/vehicles", () => useTitleBlock({ meta: "12 veículos" }));
    expect(screen.getByRole("heading", { level: 1, name: "Veículos" })).toBeInTheDocument();
    expect(screen.getByText("12 veículos")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Tempo real: Conectado" })).toBeInTheDocument();
});
