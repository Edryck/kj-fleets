import { expect, test } from "@playwright/test";
import { apiToken, createOrderViaUi, login, loginAs, registerCustomer, unique } from "./helpers";

test("customerCreatesOrder @mobile", async ({ page, request }) => {
    const customer = await registerCustomer(request);
    await loginAs(page, customer.username, customer.password);
    await createOrderViaUi(page);
    await page.getByRole("button", { name: "Criar pedido" }).click();
    await expect(page).toHaveURL(/\/orders\/order_[a-z0-9]+$/);
    await page.goto("/orders");
    await expect(page.getByText(/Criado|Aguardando/).first()).toBeVisible();
});

test("dispatcherAssignsDriver", async ({ page, request }) => {
    const fleetToken = await apiToken(request, "FLEET_MANAGER");
    const suffix = unique();
    const name = `Motorista E2E ${suffix}`;
    const vehicle = await request.post("/vehicles", {
        headers: { Authorization: `Bearer ${fleetToken}` },
        data: { plate: `E2E${suffix.toUpperCase()}`.slice(0, 7), type: "VAN" },
    });
    expect(vehicle.status()).toBe(201);
    const driver = await request.post("/drivers", {
        headers: { Authorization: `Bearer ${fleetToken}` },
        data: {
            username: `drv${suffix}`,
            password: "password-123",
            name,
            vehicleId: (await vehicle.json()).publicId,
        },
    });
    expect(driver.status()).toBe(201);
    // motorista novo nasce offline; o despacho só oferece quem está disponível
    const available = await request.put(`/drivers/${(await driver.json()).publicId}`, {
        headers: { Authorization: `Bearer ${fleetToken}` },
        data: { name, status: "AVAILABLE", vehicleId: (await vehicle.json()).publicId },
    });
    expect(available.ok()).toBeTruthy();

    await login(page, "DISPATCHER");
    await createOrderViaUi(page);
    const customer = page.getByRole("combobox", { name: "Cliente", exact: true });
    if (await customer.isVisible()) await customer.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Criar pedido" }).click();
    await expect(page).toHaveURL(/\/orders\/order_[a-z0-9]+$/);

    await page.getByRole("button", { name: "Atribuir motorista" }).click();
    await page.getByLabel("Motorista", { exact: true }).selectOption({ label: name });
    await page
        .getByRole("dialog")
        .getByRole("button", { name: /Atribuir/ })
        .click();
    await expect(page.getByText(name).first()).toBeVisible();
});

test("managerSeesFleetDashboard", async ({ page }) => {
    await login(page, "FLEET_MANAGER");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByText("Erro interno")).toHaveCount(0);
});

test("adminCreatesUser", async ({ page }) => {
    await login(page, "ADMIN");
    await page.goto("/users");
    await page.getByRole("button", { name: "Novo usuário" }).click();
    const username = `disp${unique()}`;
    await page.getByLabel("Usuário").last().fill(username);
    await page.getByLabel("Senha", { exact: true }).fill("password-123");
    await page.getByLabel("Perfil").last().selectOption("DISPATCHER");
    await page.getByRole("button", { name: "Criar usuário" }).click();
    await expect(page.getByText(username)).toBeVisible();
});
