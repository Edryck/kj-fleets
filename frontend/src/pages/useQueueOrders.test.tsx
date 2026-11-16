import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "../test/render";
import { useQueueOrders } from "./useQueueOrders";

const request = vi.hoisted(() => vi.fn());
vi.mock("../api/http", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../api/http")>()),
    request,
}));

beforeEach(() => {
    request.mockReset();
    request.mockImplementation((_method: string, path: string) =>
        Promise.resolve({ publicId: path.split("/").pop() }),
    );
});

describe("useQueueOrders", () => {
    it("fetches at most 50 orders per stage with the shared cache key", async () => {
        const items = Array.from({ length: 60 }, (_, i) => ({
            orderId: `o${i}`,
            trackingNumber: `KJ${i}`,
            pickupName: "A",
            dropoffName: "B",
            minutesInStage: 1,
        }));
        renderHookWithClient(() =>
            useQueueOrders({
                unassigned: { items, total: 60 },
                assignedNotDispatched: {
                    items: items.slice(0, 3).map((x) => ({ ...x, orderId: `a${x.orderId}` })),
                    total: 3,
                },
                inProgress: { items: [], total: 0 },
            }),
        );
        await waitFor(() => expect(request).toHaveBeenCalledTimes(53));
        expect(request).toHaveBeenCalledWith("GET", "/orders/o0");
        expect(request).not.toHaveBeenCalledWith("GET", "/orders/o50");
    });

    it("returns the loaded orders and reports loading until they arrive", async () => {
        const { result } = renderHookWithClient(() =>
            useQueueOrders({
                unassigned: {
                    items: [
                        {
                            orderId: "o1",
                            trackingNumber: "KJ1",
                            pickupName: "A",
                            dropoffName: "B",
                            minutesInStage: 1,
                        },
                    ],
                    total: 1,
                },
                assignedNotDispatched: { items: [], total: 0 },
                inProgress: { items: [], total: 0 },
            }),
        );
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.orders.map((o) => o.publicId)).toEqual(["o1"]);
    });
});
