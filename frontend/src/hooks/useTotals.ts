import { useQueries, useQuery } from "@tanstack/react-query";
import { request } from "../api/http";
import type { Page } from "../api/types";

export function useTotals(
    path: string,
    param: string,
    values: readonly string[],
    extra: Record<string, string | boolean> = {},
): Record<string, number | undefined> {
    return useQueries({
        queries: values.map((value) => ({
            queryKey: [path, "total", param, value, extra],
            queryFn: () =>
                request<Page<unknown>>("GET", path, undefined, {
                    [param]: value,
                    ...extra,
                    limit: 1,
                }),
            select: (page: Page<unknown>) => page.total,
            staleTime: 30_000,
        })),
        combine: (results) =>
            Object.fromEntries(values.map((value, i) => [value, results[i]?.data])),
    });
}

export function useTotal(path: string): number | undefined {
    return useQuery({
        queryKey: [path, "total", "all"],
        queryFn: () => request<Page<unknown>>("GET", path, undefined, { limit: 1 }),
        select: (page: Page<unknown>) => page.total,
        staleTime: 30_000,
    }).data;
}
