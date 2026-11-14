import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Meta, MonthPoint, YearlyTrends } from "../api/types";
import { resetSessionForTests, startSession } from "../auth/session";
import Trends from "./Trends";

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../api/http")>()),
    request: mockRequest,
}));

const meta: Meta = {
    generatedAt: "2026-11-14T12:00:00Z",
    timezone: "America/Sao_Paulo",
    period: "now",
    from: null,
    to: null,
};

// o que o CUSTOMER recebe: contagens e taxa, sem km, economia, ciclo ou motorista
const customerMonths: MonthPoint[] = [
    {
        month: "2026-10",
        created: 4,
        completed: 3,
        failed: 1,
        cancelled: 0,
        successRate: { rate: 0.75, n: 4 },
        avgCycleMinutes: null,
        savedKm: null,
        avgSavingsPct: null,
    },
    {
        month: "2026-11",
        created: 2,
        completed: 2,
        failed: 0,
        cancelled: 0,
        successRate: { rate: 1, n: 2 },
        avgCycleMinutes: null,
        savedKm: null,
        avgSavingsPct: null,
    },
];

const customerPayload: YearlyTrends = { meta, months: customerMonths, byDriver: [] };

const staffPayload: YearlyTrends = {
    meta,
    months: customerMonths.map((m) => ({
        ...m,
        avgCycleMinutes: 42,
        savedKm: 12.5,
        avgSavingsPct: 8.3,
    })),
    byDriver: [{ driverId: "d-1", name: "Ana", month: "2026-10", completed: 3 }],
};

beforeEach(() => {
    resetSessionForTests();
    mockRequest.mockReset();
});

afterEach(cleanup);

const renderWith = async (role: "CUSTOMER" | "ADMIN", payload: YearlyTrends) => {
    startSession({
        token: "t",
        role,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    mockRequest.mockResolvedValue(payload);
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <Trends />
        </QueryClientProvider>,
    );
    await waitFor(() => expect(mockRequest).toHaveBeenCalled());
};

describe("tendência anual", () => {
    it("cliente não vê km, economia, ciclo nem motoristas", async () => {
        await renderWith("CUSTOMER", customerPayload);
        expect(await screen.findByRole("heading", { name: /pedidos por mês/i })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: /km|economia|ciclo|motorista/i })).toBeNull();
    });

    it("equipe vê km, ciclo e entregas por motorista", async () => {
        await renderWith("ADMIN", staffPayload);
        expect(await screen.findByRole("heading", { name: /km economizados/i })).toBeTruthy();
        expect(screen.getByRole("heading", { name: /ciclo médio/i })).toBeTruthy();
        expect(screen.getByRole("heading", { name: /entregas por motorista/i })).toBeTruthy();
    });
});
