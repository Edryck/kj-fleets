# Fase 9 — Área do cliente, rastreio, entrada e páginas de sistema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer o dashboard do cliente, o rastreio público, o login, o cadastro e as páginas 404/403 no padrão novo, sem nenhum dado interno e sem posição de motorista.

**Spec:** §7.9, §7.10.3 (Dashboard do cliente, Rastreio público, Login e cadastro, Páginas de sistema). Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

---

### Task 1: Dashboard do cliente ("Minhas entregas")

**Files:**
- Modify: `src/pages/CustomerDashboard.tsx` (apresentação; query `/dashboard/customer`, cancelamento e invalidações iguais)
- Create: `src/pages/customer/customerDashboard.test.tsx`, `src/styles/customer.css` (reescrita; substitui o atual)

**Interfaces:**
- Consumes: `HeroNumber`, `Glass`, `StatusBadge`, `ConfirmDialog` e o tipo `CustomerPanel`.
- Produces: `StopProgress({ done, total }: { done: number; total: number })`, uma barra de paradas com `role="progressbar"`, `aria-valuenow={done}` e `aria-valuemax={total}`.

- [ ] **Step 1: Write the failing test** (`request` mocado; 2 ativos, um `cancellable`, 1 em atenção e 1 entregue com POD)

```tsx
it("leads with the number of active deliveries", async () => {
    renderAt("/dashboard", <CustomerDashboard />);
    expect(await screen.findByText("Em andamento")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
});

it("renders editorial cards with ETA, stop progress and driver name only", async () => {
    renderAt("/dashboard", <CustomerDashboard />);
    const card = (await screen.findByText("KJ7Q2M9XAB")).closest("article")!;
    expect(within(card).getByText("38")).toBeInTheDocument();
    expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(within(card).getByText("Marcos Vieira")).toBeInTheDocument();
    expect(within(card).queryByText(/km|placa|BRA2E19/i)).toBeNull();
});

it("offers cancel only on cancellable orders", async () => {
    renderAt("/dashboard", <CustomerDashboard />);
    await screen.findByText("KJ7Q2M9XAB");
    expect(screen.getAllByRole("button", { name: "Cancelar pedido" })).toHaveLength(1);
});

it("never publishes a map scene", async () => {
    renderAt("/dashboard", <CustomerDashboard />);
    await screen.findByText("KJ7Q2M9XAB");
    expect(lastSceneOrNull()).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/customer`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - Composição de §7.9:
    - `HeroNumber` "Em andamento" com `active.length`;
    - cartões editoriais com código em mono, status grande, ETA em peso 200 com "min", `StopProgress`, motorista pelo nome e "Cancelar pedido" quando `cancellable`;
    - "Precisa de atenção", com motivo e minutos parados;
    - "Entregues recentemente", com o chip de POD;
    - resumo do período com os campos do `summary` reduzido.
  - O fundo é o ambiente estático (o cliente nunca é imersivo).

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/CustomerDashboard.tsx frontend/src/pages/customer frontend/src/styles/customer.css
```

---

### Task 2: Rastreio público (`/track`)

**Files:**
- Modify: `src/pages/Track.tsx` (apresentação; polling e query iguais, conforme `trackPolling.test.ts`)
- Create: `src/patterns/eventTimeline.ts`, `src/pages/customer/track.test.tsx`

**Interfaces:**
- Consumes: `StopTimeline` e `TimelineStop` (Fase 1), `HeroNumber`, `Glass`, `AmbientBackground` e `STATUS_LABEL` (o mapa de rótulos de `StatusBadge`).
- Produces: `timelineFromEvents(events: { code: string; status: OrderStatus; at: string }[]): TimelineStop[]`. Todos os eventos ficam `done`, menos o último de um pedido não finalizado, que fica `next`. O rótulo é a hora (`formatTime`). O rastreio público não traz paradas, então a linha do tempo é de eventos.

- [ ] **Step 1: Write the failing test**

```tsx
it("maps tracking events to a timeline with the latest one as current", () => {
    const items = timelineFromEvents([
        { code: "CREATED", status: "CREATED", at: "2026-11-16T12:00:00Z" },
        { code: "DISPATCHED", status: "DISPATCHED", at: "2026-11-16T12:20:00Z" },
    ]);
    expect(items.map((i) => i.state)).toEqual(["done", "next"]);
});

it("shows a glass card with status, ETA and timeline over the ambient background", async () => {
    renderAt("/track?code=KJ7Q2M9XAB", <Track />);
    expect(await screen.findByRole("heading", { name: "Despachado" })).toBeInTheDocument();
    expect(screen.getByText("Chegada estimada")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Eventos" })).toBeInTheDocument();
    expect(document.querySelector(".ambient")).not.toBeNull();
});
```

Ajustar o parâmetro de código da URL ao que `Track.tsx` usa hoje. A lista usa `<StopTimeline stops={...} label="Eventos" />`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/customer/track.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - Composição "Consulta por código": um cartão de vidro regular centrado sobre o `AmbientBackground`, com o campo do código, o status grande como `h1`, `HeroNumber` da ETA quando houver e a linha do tempo.
  - Estados: código não encontrado (`EmptyState` com "Conferir o código") e erro.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS, inclusive `trackPolling.test.ts`.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Track.tsx frontend/src/patterns/eventTimeline.ts frontend/src/pages/customer/track.test.tsx
```

---

### Task 3: Login e cadastro com o mapa estático

**Files:**
- Create: `src/map/StaticMapBackdrop.tsx`, `src/map/staticMapBackdrop.test.tsx`
- Modify: `src/pages/Login.tsx` (o `AuthBrandPanel` dá lugar ao cartão de vidro; formulário, atalhos de desenvolvimento e redirecionamentos iguais), `src/pages/Register.tsx`

**Interfaces:**
- Consumes: `loadStyle` (Fase 2), `Glass` e `Wordmark`.
- Produces: `StaticMapBackdrop()`. O mapa é criado com `interactive: false`, `attributionControl` compacto, centro `[-54.18, -24.93]`, zoom 9,6, inclinação 0 e sem terreno. Ele troca de estilo com o tema.

- [ ] **Step 1: Write the failing test** (`maplibre-gl` mocado com um `Map` falso que guarda as opções)

```tsx
it("creates a non-interactive flat map without terrain", async () => {
    render(<StaticMapBackdrop />);
    await waitFor(() => expect(mapInstances).toHaveLength(1));
    expect(mapInstances[0].options).toMatchObject({ interactive: false, center: [-54.18, -24.93], zoom: 9.6, pitch: 0 });
    expect(mapInstances[0].setTerrain).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/map/staticMapBackdrop.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - `StaticMapBackdrop` em tela cheia, atrás de um véu com `--color-bg` a 35%.
  - Login e cadastro: um cartão de vidro regular de 420 px, centrado, com a marca, o formulário com campos chapados e os atalhos de login de desenvolvimento atuais.
  - Abaixo de 768 px, o cartão ocupa a largura com 16 px de margem.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS, inclusive `forms.test.tsx`.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/map/StaticMapBackdrop.tsx frontend/src/map/staticMapBackdrop.test.tsx frontend/src/pages/Login.tsx frontend/src/pages/Register.tsx
```

---

### Task 4: Páginas de sistema (404, 403 e espera)

**Files:**
- Modify: `src/pages/SystemPages.tsx`
- Create: `src/pages/systemPages.test.tsx`

**Interfaces:**
- Consumes: `AmbientBackground` e `Glass`.

- [ ] **Step 1: Write the failing test**

```tsx
it.each([
    [<NotFound />, "404", "Página não encontrada"],
    [<Forbidden />, "403", "Sem permissão"],
])("shows the big code, a sentence and a way back", (page, code, title) => {
    renderAt("/x", page);
    expect(screen.getByText(code)).toHaveClass("system-code");
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar/ })).toBeInTheDocument();
});
```

Ajustar os títulos aos textos atuais de `SystemPages.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/systemPages.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - Composição "Fora do caminho":
    - código em 148 px, peso 200 (`.system-code`);
    - frase;
    - ação de volta para a página inicial do perfil;
    - curvas de nível do fundo ambiente.
  - `PendingScreen` vira um skeleton chapado dentro de vidro.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/SystemPages.tsx frontend/src/pages/systemPages.test.tsx
```

---

### Task 5: Verificação e commit da fase

- [ ] **Step 1: Verificação padrão**
  - Telas: `/dashboard` e `/orders/:id` como cliente, `/track` sem login, `/login`, `/register`, uma rota inexistente e uma rota proibida.
  - Confirmar na aba de rede que o cliente não chama `/drivers`, `/vehicles` nem `/topic/fleet/locations`.

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src
git commit -m "feat(frontend): área do cliente, rastreio e entrada no padrão novo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão do dono do produto.**
