import { expect, test, type Page } from "@playwright/test";
import { createOrderViaUi, login, loginAs, registerCustomer } from "./helpers";

async function countOrders(page: Page, token: string) {
    const response = await page.request.get("/orders?limit=1", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return (await response.json()).total as number;
}

const tokenOf = (page: Page) => page.evaluate(() => sessionStorage.getItem("kjfleets.token") ?? "");

test.describe("usuário desatento", () => {
    test("doubleClickCreatesOneOrder", async ({ page, request }) => {
        const customer = await registerCustomer(request);
        await loginAs(page, customer.username, customer.password);
        const token = await tokenOf(page);
        const before = await countOrders(page, token);
        await createOrderViaUi(page);
        await page.getByRole("button", { name: "Criar pedido" }).dblclick();
        await expect(page).toHaveURL(/\/orders\/order_[a-z0-9]+$/);
        await page.waitForTimeout(1500);
        expect(await countOrders(page, token)).toBe(before + 1);
    });

    test("emptyRequiredFieldsShowMessage", async ({ page, request }) => {
        const customer = await registerCustomer(request);
        await loginAs(page, customer.username, customer.password);
        await page.goto("/orders/new");
        const serverErrors: number[] = [];
        page.on("response", (r) => r.status() >= 500 && serverErrors.push(r.status()));
        await page
            .getByRole("group", { name: "Retirada" })
            .getByRole("button", { name: "Novo ponto" })
            .click();
        await page.getByRole("button", { name: "Criar pedido" }).click();
        await expect(page.locator(".field-error").first()).toBeVisible();
        await expect(page).toHaveURL(/\/orders\/new/);
        const focused = await page.evaluate(() => document.activeElement?.tagName);
        expect(["INPUT", "SELECT", "TEXTAREA"]).toContain(focused);
        expect(serverErrors).toEqual([]);
    });

    test("registerEmptyAndMismatched", async ({ page }) => {
        await page.goto("/register");
        await page.getByRole("button", { name: "Criar conta" }).click();
        await expect(page.locator(".field-error, [role=alert]").first()).toBeVisible();
        await expect(page).toHaveURL(/\/register/);
    });

    test("garbagePaste", async ({ page, request }) => {
        const customer = await registerCustomer(request);
        await loginAs(page, customer.username, customer.password);
        await createOrderViaUi(page);
        const garbage = "🚚💥ção".repeat(1000);
        await page.getByLabel("Observações").fill(garbage);
        await page.getByRole("group", { name: "Retirada" }).getByLabel("Nome").fill(garbage);
        await page.getByRole("button", { name: "Criar pedido" }).click();
        // ou o form barra no campo, ou a API recusa com mensagem; nunca tela branca nem "Erro interno"
        await expect(
            page.locator(".field-error, [role=alert], .notice-danger").first(),
        ).toBeVisible();
        await expect(page.getByText("Erro interno")).toHaveCount(0);
        await expect(page.locator("body")).not.toBeEmpty();
    });

    test("backAndReloadMidForm", async ({ page, request }) => {
        const customer = await registerCustomer(request);
        await loginAs(page, customer.username, customer.password);
        await createOrderViaUi(page);
        await page.reload();
        await expect(page.getByRole("button", { name: "Criar pedido" })).toBeVisible();
        await page.goBack();
        await expect(page.locator("main")).toBeVisible();
    });

    test("expiredSessionRedirects", async ({ page }) => {
        await login(page, "ADMIN");
        await page.evaluate(() => sessionStorage.setItem("kjfleets.token", "lixo.lixo.lixo"));
        await page.goto("/orders");
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByText(/sessão|expir|entre de novo/i).first()).toBeVisible();
    });

    test("wrongPasswordFeedback", async ({ page, request }) => {
        const customer = await registerCustomer(request);
        await page.goto("/login");
        for (let i = 0; i < 5; i++) {
            await page.getByLabel("Usuário").fill(customer.username);
            await page.getByLabel("Senha", { exact: true }).fill(`errada-${i}`);
            await page.getByRole("button", { name: "Entrar", exact: true }).click();
            await expect(page.getByRole("alert")).toContainText(/inválid/i);
        }
        await page.getByLabel("Senha", { exact: true }).fill(customer.password);
        await page.getByRole("button", { name: "Entrar", exact: true }).click();
        await expect(page.getByRole("alert")).toContainText(/Muitas tentativas/i);
    });

    test("keyboardOnly", async ({ page, request }) => {
        const customer = await registerCustomer(request);
        await page.goto("/login");
        await page.getByLabel("Usuário").focus();
        await page.keyboard.type(customer.username);
        await page.keyboard.press("Tab");
        await page.keyboard.type(customer.password);
        await page.keyboard.press("Enter");
        await expect(page).not.toHaveURL(/\/login/);
        for (let i = 0; i < 6; i++) {
            await page.keyboard.press("Tab");
            const outline = await page.evaluate(() => {
                const el = document.activeElement as HTMLElement | null;
                if (!el || el === document.body) return "body";
                const style = getComputedStyle(el);
                return style.outlineStyle !== "none" || style.boxShadow !== "none"
                    ? "ok"
                    : el.outerHTML.slice(0, 80);
            });
            expect(outline, "foco visível").toMatch(/ok|body/);
        }
    });

    test("noRawStatusCodes", async ({ page }) => {
        await login(page, "ADMIN");
        for (const path of ["/orders", "/drivers", "/vehicles", "/dashboard", "/dispatch"]) {
            await page.goto(path);
            // mapa e WebSocket nunca deixam a rede ociosa; espera os dados chegarem
            await page.locator("main").waitFor();
            await page.waitForTimeout(2500);
            const text = await page.locator("main").innerText();
            const raw = text.match(
                /\b(CREATED|DISPATCHED|DRIVER_ENROUTE|ARRIVED|IN_PROGRESS|COMPLETED|CANCELLED|FAILED|AVAILABLE|BUSY|OFFLINE|IN_USE|MAINTENANCE)\b/,
            );
            expect(raw, `código cru em ${path}`).toBeNull();
        }
    });

    test("destructiveActionsConfirm", async ({ page, request }) => {
        const customer = await registerCustomer(request);
        await loginAs(page, customer.username, customer.password);
        await createOrderViaUi(page);
        await page.getByRole("button", { name: "Criar pedido" }).click();
        await expect(page).toHaveURL(/\/orders\/order_/);
        await page
            .getByRole("button", { name: /Cancelar/ })
            .first()
            .click();
        await expect(page.getByRole("dialog")).toBeVisible();
    });
});

test("mobileNoHorizontalScroll @mobile", async ({ page, request }) => {
    const customer = await registerCustomer(request);
    await loginAs(page, customer.username, customer.password);
    for (const path of ["/dashboard", "/orders", "/orders/new", "/account"]) {
        await page.goto(path);
        await page.locator("main").waitFor();
        await page.waitForTimeout(1500);
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `rolagem lateral em ${path}`).toBeLessThanOrEqual(1);
    }
});
