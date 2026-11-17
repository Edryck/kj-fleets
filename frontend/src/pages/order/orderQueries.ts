import { useQuery } from "@tanstack/react-query";
import { ApiError, request } from "../../api/http";
import type { OrderDetail, OrderRoute } from "../../api/types";

export function useOrder(id: string | undefined) {
    return useQuery({
        queryKey: ["order", id],
        queryFn: () => request<OrderDetail>("GET", `/orders/${id}`),
        enabled: !!id,
    });
}

export function useOrderRoute(id: string | undefined, enabled: boolean) {
    return useQuery({
        queryKey: ["order", id, "route"],
        queryFn: () =>
            request<OrderRoute>("GET", `/orders/${id}/route`).catch((e: ApiError) => {
                if (e.code === "ROUTE_NOT_FOUND") return null;
                throw e;
            }),
        enabled: enabled && !!id,
    });
}
