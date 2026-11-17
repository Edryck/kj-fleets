import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Driver, DriverStatus } from "../api/types";
import DriverForm from "./drivers/DriverForm";

vi.mock("../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../api/http")>()),
    request: vi.fn(async () => ({ items: [], total: 0, limit: 100, offset: 0 })),
}));

afterEach(cleanup);

const driver = (status: DriverStatus): Driver => ({
    publicId: "drv-1",
    username: "ana",
    name: "Ana Souza",
    phone: null,
    licenseNumber: null,
    status,
    lat: null,
    lng: null,
    lastSeenAt: null,
    fleets: [],
    vehicle: null,
    active: true,
});

const renderDrawer = (d: Driver) =>
    render(
        <QueryClientProvider client={new QueryClient()}>
            <DriverForm driver={d} onClose={() => {}} />
        </QueryClientProvider>,
    );

describe("formulário de motorista", () => {
    it("status oferece só Disponível e Offline", () => {
        renderDrawer(driver("OFFLINE"));
        const select = screen.getByLabelText("Status") as HTMLSelectElement;
        const labels = within(select)
            .getAllByRole("option")
            .map((o) => o.textContent);
        expect(labels).toEqual(["Disponível", "Offline"]);
        expect(select.disabled).toBe(false);
    });

    it("status fica travado quando o motorista está ocupado", () => {
        renderDrawer(driver("BUSY"));
        const select = screen.getByLabelText("Status") as HTMLSelectElement;
        expect(select.disabled).toBe(true);
        expect(select.value).toBe("BUSY");
    });
});
