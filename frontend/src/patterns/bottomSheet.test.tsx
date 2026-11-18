import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import BottomSheet from "./BottomSheet";

afterEach(cleanup);

beforeAll(() => {
    const view = document.defaultView as unknown as Record<string, unknown>;
    if (!view.PointerEvent) {
        view.PointerEvent = class extends MouseEvent {
            pointerId = 1;
        };
    }
});

describe("BottomSheet", () => {
    it("moves between snap points with the handle and the keyboard", async () => {
        const onSnapChange = vi.fn();
        render(
            <BottomSheet snap="collapsed" onSnapChange={onSnapChange}>
                conteúdo
            </BottomSheet>,
        );
        const handle = screen.getByRole("button", { name: "Expandir painel" });
        await userEvent.click(handle);
        expect(onSnapChange).toHaveBeenCalledWith("half");
        handle.focus();
        await userEvent.keyboard("{ArrowUp}");
        expect(onSnapChange).toHaveBeenLastCalledWith("half");
    });

    it("collapses from full and steps down with the arrow key", async () => {
        const onSnapChange = vi.fn();
        const { container } = render(
            <BottomSheet snap="full" onSnapChange={onSnapChange}>
                conteúdo
            </BottomSheet>,
        );
        expect(container.querySelector(".bottom-sheet")).toHaveAttribute("data-snap", "full");
        const handle = screen.getByRole("button", { name: "Recolher painel" });
        handle.focus();
        await userEvent.keyboard("{ArrowDown}");
        expect(onSnapChange).toHaveBeenLastCalledWith("half");
        await userEvent.click(handle);
        expect(onSnapChange).toHaveBeenLastCalledWith("collapsed");
    });

    it("follows a vertical drag on the handle", () => {
        const onSnapChange = vi.fn();
        render(
            <BottomSheet snap="half" onSnapChange={onSnapChange}>
                conteúdo
            </BottomSheet>,
        );
        const handle = screen.getByRole("button", { name: "Expandir painel" });
        fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 });
        fireEvent.pointerUp(handle, { clientY: 380, pointerId: 1 });
        expect(onSnapChange).toHaveBeenLastCalledWith("full");
        fireEvent.pointerDown(handle, { clientY: 300, pointerId: 1 });
        fireEvent.pointerUp(handle, { clientY: 420, pointerId: 1 });
        expect(onSnapChange).toHaveBeenLastCalledWith("collapsed");
    });

    it("shows tabs that switch the panel content", async () => {
        const onTabChange = vi.fn();
        render(
            <BottomSheet
                snap="half"
                onSnapChange={() => {}}
                tabs={[
                    { id: "list", label: "Lista" },
                    { id: "detail", label: "Detalhe" },
                ]}
                tab="list"
                onTabChange={onTabChange}
            >
                conteúdo
            </BottomSheet>,
        );
        expect(screen.getByRole("tab", { name: "Lista" })).toHaveAttribute("aria-selected", "true");
        await userEvent.click(screen.getByRole("tab", { name: "Detalhe" }));
        expect(onTabChange).toHaveBeenCalledWith("detail");
    });
});

describe("BottomSheet tabs", () => {
    it("starts each tab at the top of the sheet", () => {
        const tabs = [
            { id: "list", label: "Lista" },
            { id: "detail", label: "Detalhe" },
        ];
        const { container, rerender } = render(
            <BottomSheet snap="half" onSnapChange={() => {}} tabs={tabs} tab="list">
                lista
            </BottomSheet>,
        );
        const body = container.querySelector(".sheet-body") as HTMLElement;
        body.scrollTop = 240;
        rerender(
            <BottomSheet snap="half" onSnapChange={() => {}} tabs={tabs} tab="detail">
                detalhe
            </BottomSheet>,
        );
        expect(body.scrollTop).toBe(0);
    });
});
