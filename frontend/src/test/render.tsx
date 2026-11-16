import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    render,
    renderHook,
    type RenderHookResult,
    type RenderResult,
} from "@testing-library/react";
import { useEffect, type ReactElement, type ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Role } from "../api/types";
import { startSession } from "../auth/session";

let lastPath = "";

function LocationProbe() {
    const location = useLocation();
    useEffect(() => {
        lastPath = location.pathname + location.search;
    }, [location]);
    return null;
}

export function currentPath(): string {
    return lastPath;
}

const newClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

function tree(client: QueryClient, path: string, ui: ReactElement): ReactElement {
    return (
        <QueryClientProvider client={client}>
            <MemoryRouter key={path} initialEntries={[path]}>
                <LocationProbe />
                {ui}
            </MemoryRouter>
        </QueryClientProvider>
    );
}

export function renderAt(
    path: string,
    ui: ReactElement,
    options: { role?: Role } = {},
): RenderResult & { rerenderAt(path: string, ui: ReactElement): void } {
    if (options.role) {
        startSession({
            token: "test",
            role: options.role,
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        });
    }
    lastPath = path;
    const client = newClient();
    const result = render(tree(client, path, ui));
    return {
        ...result,
        rerenderAt(nextPath: string, nextUi: ReactElement) {
            lastPath = nextPath;
            result.rerender(tree(client, nextPath, nextUi));
        },
    };
}

export function renderHookWithClient<T>(hook: () => T): RenderHookResult<T, unknown> {
    const client = newClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(hook, { wrapper });
}
