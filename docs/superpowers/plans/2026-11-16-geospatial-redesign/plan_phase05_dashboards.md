# Fase 5 — Dashboards (vista aérea)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer os dashboards de administrador, despachante e gestor de frota com número de destaque sobre o relevo 3D, painel direito, doca inferior e giro de entrada.

**Spec:** §7.3, §5.6 (câmera dos dashboards), §13, itens 16, 21, 22 e 26. Referência visual: cena `#dash` de `$PROTO/screens.html`. Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

---

### Task 1: Cena e moldura compartilhadas

**Files:**
- Create:
  - `src/pages/dashboard/dashboardScene.ts`;
  - `src/pages/dashboard/dashboardScene.test.ts`;
  - `src/pages/dashboard/DashboardFrame.tsx`;
  - `src/styles/dashboard.css` (reescrita; o arquivo atual é substituído).

**Interfaces:**
- Consumes: `MapScene`, `SceneMarker`, `Padding` (Fase 2); o tipo `DriverRow`; `HeroNumber` e `Glass` (Fase 1).
- Produces:
  - `staleLabel(lastSeenAt: string | null, now: number): string`. Devolve `"9 min"`, `"2 h"` ou `"sem sinal"` quando nulo;
  - `dashboardScene(input: { drivers: DriverRow[]; now: number; padding: Padding }): MapScene`;
  - `DashboardFrame({ hero, right, dock }: { hero: ReactNode; right: ReactNode; dock: ReactNode })`. Renderiza o degradê atrás do destaque (`.hero-scrim`), o destaque sem vidro, o painel direito e a doca de três colunas.

- [ ] **Step 1: Write the failing test**

```ts
const row = (id: string, extra: Partial<DriverRow> = {}): DriverRow => ({
    driverId: id, name: "Rafael Lima", status: "BUSY", vehiclePlate: "RHN7C02", vehicleStatus: "IN_USE",
    activeOrderId: null, queueSize: 0, lastSeenAt: "2026-11-16T12:51:00Z", pingStale: false,
    lat: -24.56, lng: -54.06, ...extra,
});
const now = Date.parse("2026-11-16T13:00:00Z");

describe("dashboardScene", () => {
    it("labels stale pings in minutes or hours", () => {
        expect(staleLabel("2026-11-16T12:51:00Z", now)).toBe("9 min");
        expect(staleLabel("2026-11-16T10:40:00Z", now)).toBe("2 h");
        expect(staleLabel(null, now)).toBe("sem sinal");
    });

    it("adds a 'Sem sinal' HUD over stale drivers only", () => {
        const scene = dashboardScene({ drivers: [row("d3", { pingStale: true }), row("d4")], now, padding: ZERO });
        expect(scene.markers.find((m) => m.id === "hud-d3")?.hud).toEqual({ label: "Sem sinal", value: "9 min", warn: true });
        expect(scene.markers.find((m) => m.id === "hud-d4")).toBeUndefined();
    });

    it("drops drivers without position", () => {
        const scene = dashboardScene({ drivers: [row("d1", { lat: null, lng: null, pingStale: true })], now, padding: ZERO });
        expect(scene.markers).toEqual([]);
    });

    it("uses the aerial camera with terrain and the intro spin", () => {
        expect(dashboardScene({ drivers: [row("d1")], now, padding: ZERO }).camera).toMatchObject({
            fit: "points", pitch: 73, bearing: -24, terrain: 2.4, intro: "spin", maxZoom: 10.4,
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/dashboard`
Expected: FAIL.

- [ ] **Step 3: Implement the scene, frame and CSS**

Valores de `$PROTO/screens.html`:
- `.hero` com 148 px, peso 200 e −0,055 em;
- `.hero-scrim` com os gradientes exatos da spec §7.3;
- `.dash-right`;
- `.dash-bottom` com três colunas `1.3fr 1fr 1fr`;
- `.flist` com fade na base;
- `.hbars`;
- `.cmp`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/dashboard`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/dashboard frontend/src/styles/dashboard.css
```

---

### Task 2: Dashboard do administrador

**Files:**
- Modify: `src/pages/Dashboard.tsx` (reescrita da apresentação, com as mesmas queries `/dashboard/admin` por período e `/dashboard/fleet/status`), `src/pages/dashboardParts.tsx` (o `DashHeader` sai; `DeltaHint` e `STAGE_LABEL` ficam)
- Create: `src/pages/dashboard/adminDashboard.test.tsx`

**Interfaces:**
- Consumes: `DashboardFrame`, `dashboardScene`, `HeroNumber`, `DotMatrix`, `useMapScene`, `useTitleBlock`, `usePeriod`, `PeriodSelect` e `DeltaHint`.

- [ ] **Step 1: Write the failing test** (movimento reduzido; `request` e `useMapScene` mocados; `AdminPanel` com `successRate: { rate: 0.93, n: 120 }`, `cancelled: 6`, `cancelledByCustomer: 4`, `cancelledByStaff: 2`, `podRate: { rate: 0.91, n: 98 }` e `funnel.byStage.UNASSIGNED: 30`)

```tsx
it("leads with the success rate as the hero number", async () => {
    renderDashboard();
    expect(await screen.findByText("Taxa de sucesso · Hoje")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
    expect(screen.getByText("120 pedidos finalizados")).toBeInTheDocument();
});

it("splits cancellations by origin and shows the POD denominator", async () => {
    renderDashboard();
    expect(await screen.findByText(/4 pelo cliente · 2 pela equipe/)).toBeInTheDocument();
    expect(screen.getByText(/Prova de entrega · 98/)).toBeInTheDocument();
});

it("scales the funnel dot matrix and links each stage", async () => {
    renderDashboard();
    expect(await screen.findByText("1 ponto = 3 pedidos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sem motorista/ })).toHaveAttribute("href", "/dispatch");
});

it("sends a clicked driver to the live map", async () => {
    renderDashboard();
    await screen.findByText("93");
    act(() => lastScene().onMarkerClick?.("d1"));
    expect(currentPath()).toBe("/map?driver=d1");
});

it("never renders a row of KPI cards", async () => {
    const { container } = renderDashboard();
    await screen.findByText("93");
    expect(container.querySelector(".kpi-grid, .kpi-card")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/dashboard/adminDashboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite `Dashboard.tsx`**
  - Composição da spec §7.3 (Administrador):
    - **título:** seletor de período em vidro e a subnavegação atual ("Visão geral", "Despacho", "Frota") como segmento em `actions`;
    - **destaque e grade 3 × 2:** com `DeltaHint` em cada indicador, como hoje;
    - **painel direito "Frota agora":** duas barras empilhadas (motoristas e veículos), lista com fade, link "Mapa ao vivo" e alertas em chips;
    - **doca:** funil (`DotMatrix` com `stageLink`), motivos de falha e economia de rotas.
  - `CustomerDashboard` continua sendo escolhido para CUSTOMER, como hoje.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/pages/dashboardParts.tsx frontend/src/pages/dashboard/adminDashboard.test.tsx
```

---

### Task 3: Dashboard do despachante

**Files:**
- Modify: `src/pages/DispatchDashboard.tsx` (reescrita da apresentação, com a query `/dashboard/dispatch`)
- Create: `src/pages/dashboard/dispatchDashboard.test.tsx`

- [ ] **Step 1: Write the failing test** (`DispatchPanel` com `counts.waitingOrders: 7` e `counts.availableDrivers: 5`)

```tsx
it("leads with waiting orders and available drivers", async () => {
    renderAt("/dashboard/dispatch", <DispatchDashboard />);
    expect(await screen.findByText("Pedidos aguardando")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("5 motoristas disponíveis")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir despacho/ })).toHaveAttribute("href", "/dispatch");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/dashboard/dispatchDashboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - Destaque: `counts.waitingOrders`.
  - Grade: indicadores de `summary`.
  - Painel direito: `availableDrivers` e alertas.
  - Doca: fila resumida (sem motorista, atribuídos, parados) com "Abrir despacho" e funil.
  - Mapa: `dashboardScene` com os `availableDrivers`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/dashboard`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/DispatchDashboard.tsx frontend/src/pages/dashboard/dispatchDashboard.test.tsx
```

---

### Task 4: Dashboard do gestor de frota

**Files:**
- Modify: `src/pages/FleetDashboard.tsx` (reescrita da apresentação, com a query `/dashboard/fleet` e os `searchParams` atuais)
- Create: `src/pages/dashboard/fleetDashboard.test.tsx`

- [ ] **Step 1: Write the failing test** (`FleetPanel` com `fleet.availableDrivers: 5` e `driversByStatus` somando 14)

```tsx
it("leads with available drivers over the fleet total", async () => {
    renderAt("/dashboard/fleet", <FleetDashboard />);
    expect(await screen.findByText("Disponíveis agora")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("de 14 motoristas")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/dashboard/fleetDashboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - Painel direito: frota por status, sem sinal e alertas.
  - Doca: tabela de desempenho chapada e gráfico `sizing.perDay` (Recharts com o tema novo: eixos `--color-text-subtle`, série limão, tooltip opaco).
  - Mapa: `fleet.drivers`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/FleetDashboard.tsx frontend/src/pages/dashboard/fleetDashboard.test.tsx
```

---

### Task 5: Verificação e commit da fase

- [ ] **Step 1: Verificação padrão**
  - Telas: `/dashboard` (administrador, despachante, gestor de frota), `/dashboard/dispatch` e `/dashboard/fleet` (administrador).
  - Conferir:
    - céu visível no horizonte;
    - giro de entrada que para;
    - destaque legível sobre os rótulos do mapa nos dois temas.
  - fps: durante o voo de chegada e o giro, e parado. Pelo menos 55.

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src
git commit -m "feat(frontend): dashboards em vista aérea com número de destaque e relevo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão do dono do produto.**
