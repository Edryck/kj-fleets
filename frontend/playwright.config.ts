import { defineConfig, devices } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

// roda contra o app já de pé (docker compose + npm run dev); não sobe servidor sozinho
export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        trace: "retain-on-failure",
        locale: "pt-BR",
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
    ],
});
