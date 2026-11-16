import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import type { Role } from "../api/types";
import Rail from "./Rail";

const auth = vi.hoisted(() => ({ role: "ADMIN" as string }));
vi.mock("../auth/session", () => ({
    useSession: () => ({ token: "t", role: auth.role, expiresAt: "" }),
}));

afterEach(() => vi.restoreAllMocks());

function renderRail(
    role: Role,
    props: { open?: boolean; onOpenChange?: (open: boolean) => void } = {},
) {
    auth.role = role;
    render(
        <MemoryRouter initialEntries={["/dashboard"]}>
            <Rail
                open={props.open ?? false}
                onOpenChange={props.onOpenChange ?? (() => {})}
                mobileOpen={false}
                onMobileClose={() => {}}
            />
        </MemoryRouter>,
    );
}

it("shows only the routes allowed for the role", () => {
    renderRail("DISPATCHER");
    expect(screen.getByRole("link", { name: "Despacho" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Tendência anual" })).toBeNull();
});

it("closes the expanded overlay on Escape and never persists it", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const onOpenChange = vi.fn();
    renderRail("ADMIN", { open: true, onOpenChange });
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(setItem).not.toHaveBeenCalled();
});

it("closes the overlay after navigating", async () => {
    const onOpenChange = vi.fn();
    renderRail("ADMIN", { open: true, onOpenChange });
    await userEvent.click(screen.getByRole("link", { name: "Veículos" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
});
