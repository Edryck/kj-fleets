import { useQueries } from "@tanstack/react-query";
import { request } from "../api/http";
import type { DispatchQueue, OrderDetail } from "../api/types";

export const QUEUE_DETAIL_LIMIT = 50;

export function useQueueOrders(queue: DispatchQueue | undefined): {
    orders: OrderDetail[];
    loading: boolean;
} {
    const ids = [
        ...(queue?.unassigned.items ?? []).slice(0, QUEUE_DETAIL_LIMIT),
        ...(queue?.assignedNotDispatched.items ?? []).slice(0, QUEUE_DETAIL_LIMIT),
    ].map((item) => item.orderId);
    return useQueries({
        queries: ids.map((id) => ({
            queryKey: ["order", id],
            queryFn: () => request<OrderDetail>("GET", `/orders/${id}`),
            staleTime: 30_000,
        })),
        combine: (results) => ({
            orders: results.flatMap((r) => (r.data ? [r.data] : [])),
            loading: results.some((r) => r.isPending),
        }),
    });
}
