import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const API_TARGET = "http://localhost:8080";
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

export default defineConfig({
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
    },
});
