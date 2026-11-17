import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "../test/render";
import { useTotal, useTotals } from "./useTotals";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../api/http")>()),
    request,
}));

beforeEach(() => {
    request.mockReset();
});

describe("useTotals", () => {
    it("reads each total with limit=1 and exposes them by value", async () => {
        request.mockImplementation((_m: string, _p: string, _b: unknown, q: { status: string }) =>
            Promise.resolve({
                items: [],
                total: q.status === "CREATED" ? 7 : 2,
                limit: 1,
                offset: 0,
            }),
        );
        const { result } = renderHookWithClient(() =>
            useTotals("/orders", "status", ["CREATED", "FAILED"], { active: true }),
        );
        await waitFor(() => expect(result.current).toEqual({ CREATED: 7, FAILED: 2 }));
        expect(request).toHaveBeenCalledWith("GET", "/orders", undefined, {
            status: "CREATED",
            active: true,
            limit: 1,
        });
    });

    it("leaves a value undefined while it loads or when it fails", async () => {
        request.mockImplementation((_m: string, _p: string, _b: unknown, q: { status: string }) =>
            q.status === "CREATED"
                ? Promise.resolve({ items: [], total: 3, limit: 1, offset: 0 })
                : Promise.reject(new Error("boom")),
        );
        const { result } = renderHookWithClient(() =>
            useTotals("/orders", "status", ["CREATED", "FAILED"]),
        );
        expect(result.current).toEqual({ CREATED: undefined, FAILED: undefined });
        await waitFor(() => expect(result.current.CREATED).toBe(3));
        expect(result.current.FAILED).toBeUndefined();
    });
});

describe("useTotal", () => {
    it("reads the unfiltered total with limit=1", async () => {
        request.mockResolvedValue({ items: [], total: 12, limit: 1, offset: 0 });
        const { result } = renderHookWithClient(() => useTotal("/vehicles"));
        await waitFor(() => expect(result.current).toBe(12));
        expect(request).toHaveBeenCalledWith("GET", "/vehicles", undefined, { limit: 1 });
    });
});
