import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

// sem @types/node no projeto; só lemos uma variável de ambiente
declare const process: { env: Record<string, string | undefined>; cwd: () => string };

const API_PATHS = [
    "/auth",
    "/me",
    "/users",
    "/orders",
    "/drivers",
    "/vehicles",
    "/fleets",
    "/places",
    "/customers",
    "/customer",
    "/dispatch",
    "/routes",
    "/dashboard",
    "/track",
    "/graph",
];

// Navegação do navegador (Accept: text/html) em /orders/:id é rota do SPA, não chamada de API
const spaRoute = (req: { headers: { accept?: string } }) =>
    req.headers.accept?.includes("text/html") ? "/index.html" : undefined;

export default defineConfig(({ mode }) => {
    // o vite.config não recebe o .env.local em process.env, então lê com loadEnv
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const API_TARGET =
        process.env.VITE_PROXY_TARGET ?? env.VITE_PROXY_TARGET ?? "http://localhost:8080";
    return {
        plugins: [react()],
        server: {
            proxy: {
                ...Object.fromEntries(
                    API_PATHS.map((path) => [path, { target: API_TARGET, bypass: spaRoute }]),
                ),
                "/ws": { target: API_TARGET, ws: true },
            },
        },
        test: {
            environment: "jsdom",
            setupFiles: ["./src/test/setup.ts"],
            exclude: [...configDefaults.exclude, "e2e/**"],
            css: { include: [/\.css\?raw$/] },
        },
    };
});
