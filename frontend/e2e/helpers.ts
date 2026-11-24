import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

declare const process: { env: Record<string, string | undefined> };

export type Role = "ADMIN" | "DISPATCHER" | "FLEET_MANAGER" | "CUSTOMER";

const DEV_LABEL: Record<Role, string> = {
    ADMIN: "Admin",
    DISPATCHER: "Despacho",
    FLEET_MANAGER: "Gestor de frota",
    CUSTOMER: "Cliente",
};

// E2E_<ROLE>_USER/PASSWORD vencem; sem elas, reaproveita os logins de teste do .env.local do front
export function credentials(role: Role): { username: string; password: string } {
    const username = process.env[`E2E_${role}_USER`];
    const password = process.env[`E2E_${role}_PASSWORD`];
    if (username && password) return { username, password };
    let raw = "";
    try {
        raw = readFileSync(".env.local", "utf8");
    } catch {
        // sem .env.local: cai no erro abaixo
    }
    const line = raw.split("\n").find((l) => l.startsWith("VITE_DEV_LOGINS=["));
    const logins = line
        ? (JSON.parse(line.slice("VITE_DEV_LOGINS=".length)) as {
              label: string;
              username: string;
              password: string;
          }[])
        : [];
    const found = logins.find((l) => l.label === DEV_LABEL[role]);
    if (!found) throw new Error(`Defina E2E_${role}_USER e E2E_${role}_PASSWORD`);
    return found;
}

export const unique = () => Math.random().toString(36).slice(2, 8);

export async function login(page: Page, role: Role) {
    const { username, password } = credentials(role);
    await loginAs(page, username, password);
}

export async function loginAs(page: Page, username: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Usuário").fill(username);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
}

export async function apiToken(request: APIRequestContext, role: Role): Promise<string> {
    const response = await request.post("/auth/login", { data: credentials(role) });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).token as string;
}

export async function registerCustomer(request: APIRequestContext) {
    const username = `e2e${unique()}`;
    const password = "password-123";
    const response = await request.post("/auth/register", {
        data: { username, password, name: `Cliente E2E ${username}` },
    });
    expect(response.status()).toBe(201);
    return { username, password };
}

export async function fillNewPoint(
    page: Page,
    legend: "Retirada" | "Entrega",
    lat: number,
    lng: number,
) {
    const fieldset = page.getByRole("group", { name: legend });
    await fieldset.getByRole("button", { name: "Novo ponto" }).click();
    await fieldset.getByLabel("Nome").fill(`${legend} ${unique()}`);
    await fieldset.getByLabel("Endereço").fill("Rua das Flores, 100");
    await fieldset.getByLabel("Latitude").fill(String(lat));
    await fieldset.getByLabel("Longitude").fill(String(lng));
}

export async function createOrderViaUi(page: Page) {
    await page.goto("/orders");
    await page
        .getByRole("link", { name: /Novo pedido/ })
        .first()
        .click();
    await expect(page).toHaveURL(/\/orders\/new/);
    await fillNewPoint(page, "Retirada", -24.87, -54.33);
    await fillNewPoint(page, "Entrega", -24.89, -54.35);
}
