import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer, Me, Page, UserAccount } from "../../api/types";
import { setReducedMotion } from "../../test/motion";
import { renderAt } from "../../test/render";
import { WithTitleBlock } from "../../test/titleBlock";
import Customers from "../Customers";
import Users from "../Users";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../api/http")>()),
    request: mockRequest,
}));

const admin: UserAccount = { publicId: "u-1", username: "admin", role: "ADMIN", active: true };
const dispatcher = (n: number): UserAccount => ({
    publicId: `u-d${n}`,
    username: `desp${n}`,
    role: "DISPATCHER",
    active: true,
});
const customer: UserAccount = {
    publicId: "u-c",
    username: "cliente",
    role: "CUSTOMER",
    active: true,
};
const ana: UserAccount = { publicId: "u-2", username: "ana", role: "DISPATCHER", active: true };

const me: Me = {
    publicId: null,
    username: "admin",
    role: "ADMIN",
    name: null,
    email: null,
    phone: null,
};

const CUSTOMERS: Customer[] = [
    {
        publicId: "c1",
        name: "Mercado Bom Preço",
        email: "compras@bompreco.com",
        phone: "45 3333-0000",
    },
    { publicId: "c2", name: "Ana Lima", email: null, phone: null },
];

let usersPage: Page<UserAccount>;

const mockUsers = (page: { total: number; items: UserAccount[] }) => {
    usersPage = { ...page, limit: 20, offset: 0 };
};

beforeEach(() => {
    setReducedMotion(true);
    mockUsers({ total: 2, items: [admin, ana] });
    mockRequest.mockReset();
    mockRequest.mockImplementation((method: string, path: string) => {
        if (path === "/me") return Promise.resolve(me);
        if (method === "GET" && path === "/users") return Promise.resolve(usersPage);
        if (method === "PUT" && path === "/users/u-2")
            return Promise.resolve({ ...ana, role: "FLEET_MANAGER" });
        if (path === "/customers")
            return Promise.resolve({ items: CUSTOMERS, total: 2, limit: 20, offset: 0 });
        if (path === "/customers/c1") return Promise.resolve(CUSTOMERS[0]);
        return Promise.reject(new Error(`unexpected ${method} ${path}`));
    });
});

const renderUsers = () =>
    renderAt(
        "/users",
        <WithTitleBlock>
            <Users />
        </WithTitleBlock>,
        { role: "ADMIN" },
    );

const renderCustomers = () =>
    renderAt(
        "/customers",
        <WithTitleBlock>
            <Customers />
        </WithTitleBlock>,
        { role: "ADMIN" },
    );

describe("Users", () => {
    it("counts users by role when the whole list is on the page", async () => {
        mockUsers({ total: 4, items: [admin, dispatcher(1), dispatcher(2), customer] });
        renderUsers();
        expect(await screen.findByText("2 despachantes")).toBeInTheDocument();
        expect(screen.getByText("1 administrador")).toBeInTheDocument();
        expect(screen.getByText("1 cliente")).toBeInTheDocument();
    });

    it("shows only the total when the list spans several pages", async () => {
        mockUsers({ total: 40, items: [admin, dispatcher(1)] });
        renderUsers();
        expect(await screen.findByText("40 usuários")).toBeInTheDocument();
        expect(screen.queryByText(/despachantes?$/)).toBeNull();
    });

    it("edits another team member's role in the side panel", async () => {
        renderUsers();
        await userEvent.click(await screen.findByText("ana"));
        const panel = screen.getByRole("dialog", { name: "ana" });
        expect(panel).toHaveAttribute("aria-modal", "false");
        const save = within(panel).getByRole("button", { name: "Salvar perfil" });
        expect(save).toBeDisabled();
        await userEvent.selectOptions(within(panel).getByLabelText("Perfil"), "FLEET_MANAGER");
        await userEvent.click(save);
        expect(mockRequest).toHaveBeenCalledWith("PUT", "/users/u-2", { role: "FLEET_MANAGER" });
    });

    it("creates users in the side panel", async () => {
        renderUsers();
        await userEvent.click(await screen.findByRole("button", { name: "Novo usuário" }));
        const panel = screen.getByRole("dialog", { name: "Novo usuário" });
        expect(panel).toHaveAttribute("aria-modal", "false");
        expect(within(panel).getByLabelText("Senha")).toBeInTheDocument();
    });
});

describe("Customers", () => {
    it("shows customers with initials and opens the side panel", async () => {
        renderCustomers();
        const name = await screen.findByText("Mercado Bom Preço");
        expect(within(name.closest("tr")!).getByText("MP")).toBeInTheDocument();
        await userEvent.click(name);
        const panel = screen.getByRole("dialog", { name: "Mercado Bom Preço" });
        expect(await within(panel).findByText("compras@bompreco.com")).toBeInTheDocument();
        expect(within(panel).getByRole("link", { name: "Ver pedidos" })).toHaveAttribute(
            "href",
            "/orders?customerId=c1",
        );
    });

    it("leads with the total as a large number", async () => {
        renderCustomers();
        await screen.findByText("Mercado Bom Preço");
        const hero = screen.getByText("clientes cadastrados").closest(".hero-number")!;
        expect(hero).toHaveClass("is-large");
        expect(hero.textContent).toContain("2");
    });
});
