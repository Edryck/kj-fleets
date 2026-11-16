# Fase 4 — Central de despacho

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer `/dispatch` como mesa de planejamento: mapa plano com retiradas, motoristas e arcos do plano, fila em cartões com mini-rota, barra de comando e bandeja inferior.

**Spec:** §7.2, §5.4 (arcos), §6.5 (arcos e cometas), §13, itens 10 e 18. Referência visual: cena `#dispatch` de `$PROTO/screens.html`. Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

---

### Task 1: Cena do despacho (função pura)

**Files:**
- Create: `src/pages/dispatchScene.ts`, `src/pages/dispatchScene.test.ts`

**Interfaces:**
- Consumes: `MapScene`, `SceneMarker`, `SceneArc` e `Padding` (Fase 2); os tipos `OrderDetail`, `PlanResponse` e `StaleOrder` (os minutos parados vêm de `DispatchQueue.stale`). Os motoristas são os que `Dispatch.tsx` já carrega, normalizados pela tela para `{ id, name, status, lat, lng }`.
- Produces: `dispatchScene(input: { orders: OrderDetail[]; staleIds: ReadonlyMap<string, number>; drivers: { id: string; name: string; status: DriverStatus; lat: number | null; lng: number | null }[]; selectedOrderId: string | null; plan: PlanResponse | null; selection: ReadonlySet<string>; padding: Padding }): MapScene`.

- [ ] **Step 1: Write the failing test**

```ts
describe("dispatchScene", () => {
    it("shows each queued pickup, flags stale orders and adds a 'Parado' HUD", () => {
        const scene = dispatchScene({ ...base, orders: [order("o1"), order("o2")], staleIds: new Map([["o1", 42]]) });
        const o1 = scene.markers.find((m) => m.id === "o1")!;
        expect(o1).toMatchObject({ kind: "order", label: "R", stale: true });
        expect(scene.markers.find((m) => m.id === "hud-o1")?.hud).toEqual({ label: "Parado", value: "42 min", warn: true });
    });

    it("draws the selected order's stops without a line between them", () => {
        const scene = dispatchScene({ ...base, orders: [order("o1", { waypoints: [place(-24.9, -54.3)] })], selectedOrderId: "o1" });
        expect(scene.markers.filter((m) => m.kind === "waypoint")).toHaveLength(1);
        expect(scene.markers.some((m) => m.kind === "dropoff")).toBe(true);
        expect(scene.legs ?? []).toEqual([]);
    });

    it("adds plan arcs with km pills for selected orders only after planning", () => {
        const plan = { applied: false, assignments: [{ orderId: "o1", driverId: "d1", vehicleId: "v1", km: 16.4 }] } as PlanResponse;
        const scene = dispatchScene({ ...base, orders: [order("o1")], drivers: [drv("d1")], plan, selection: new Set(["o1"]) });
        expect(scene.arcs).toEqual([{ id: "o1", from: [drv("d1").lat, drv("d1").lng], to: [order("o1").pickup.lat, order("o1").pickup.lng], label: "16,4 km" }]);
        expect(scene.comets).toBe(2);
        expect(scene.markers.find((m) => m.id === "pill-o1")?.pill?.text).toBe("16,4 km");
    });

    it("is a flat planning table", () => {
        expect(dispatchScene(base).camera).toMatchObject({ pitch: 0, terrain: 0, fit: "points" });
    });

    it("skips orders and drivers without coordinates", () => {
        const scene = dispatchScene({ ...base, orders: [order("o1", { pickup: place(null, null) })], drivers: [drv("d1", { lat: null, lng: null })] });
        expect(scene.markers).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/dispatchScene.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `dispatchScene`**

Padding a partir dos insets da tela: `{ top: 120, bottom: 210, left: 580, right: 90 }` a 1440 × 900, recebido por parâmetro. A pílula fica no ponto médio de `arcPoints`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/dispatchScene.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/dispatchScene.ts frontend/src/pages/dispatchScene.test.ts
```

---

### Task 2: Coordenadas da fila com limite por etapa

**Files:**
- Create: `src/pages/useQueueOrders.ts`, `src/pages/useQueueOrders.test.tsx`

**Interfaces:**
- Produces: `useQueueOrders(queue: DispatchQueue | undefined): { orders: OrderDetail[]; loading: boolean }`. Faz `useQueries` com a chave `["order", id]` (a mesma do detalhe do pedido) para os itens de `unassigned` e `assignedNotDispatched`, no máximo 50 por etapa.

- [ ] **Step 1: Write the failing test** (`request` mocado)

```tsx
it("fetches at most 50 orders per stage with the shared cache key", async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ orderId: `o${i}`, trackingNumber: `KJ${i}`, pickupName: "A", dropoffName: "B", minutesInStage: 1 }));
    renderHookWithClient(() => useQueueOrders({ unassigned: { items, total: 60 }, assignedNotDispatched: { items: items.slice(0, 3).map((x) => ({ ...x, orderId: `a${x.orderId}` })), total: 3 }, inProgress: { items: [], total: 0 } }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(53));
    expect(request).toHaveBeenCalledWith("GET", "/orders/o0");
    expect(request).not.toHaveBeenCalledWith("GET", "/orders/o50");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/useQueueOrders.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** com `useQueries`, `queryKey: ["order", id]` e `queryFn: () => request<OrderDetail>("GET", \`/orders/${id}\`)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/useQueueOrders.test.tsx`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/useQueueOrders.ts frontend/src/pages/useQueueOrders.test.tsx
```

---

### Task 3: Tela da central de despacho

**Files:**
- Modify: `src/pages/Dispatch.tsx` (reescrita da apresentação; mutações, `planError`, mensagens e invalidações iguais)
- Create: `src/pages/dispatch.test.tsx`, `src/styles/dispatch.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `dispatchScene`, `useQueueOrders`, `useMapScene`, `useTitleBlock`, `Glass`, `MiniRoute`, `StatusBadge`, `ConfirmDialog` e `planComparison`.

- [ ] **Step 1: Write the failing test** (`request` e `useMapScene` mocados; fila com 2 sem motorista e 1 atribuído)

```tsx
it("offers selection only in 'Sem motorista'", async () => {
    renderDispatch();
    expect(await screen.findAllByRole("checkbox")).toHaveLength(2);
    await userEvent.click(screen.getByRole("tab", { name: /Atribuídos/ }));
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
});

it("enables 'Despachar todos' only after the plan is applied", async () => {
    renderDispatch();
    const dispatchAll = await screen.findByRole("button", { name: "Despachar todos" });
    expect(dispatchAll).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Calcular plano" }));
    expect(await screen.findByText("17,8 km")).toBeInTheDocument();
    expect(dispatchAll).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Aplicar plano" }));
    await userEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(dispatchAll).toBeEnabled());
});

it("shows '+N paradas' once the order detail arrives", async () => {
    renderDispatch();
    expect(await screen.findByText("+2 paradas")).toBeInTheDocument();
});
```

Ajustar o nome do botão de confirmação do modal ao texto atual de `Dispatch.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/dispatch.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite the presentation**
  - Composição da spec §7.2 com os valores de `.disp-cmd`, `.queue`, `.ocard`, `.tray` e `.assign` de `$PROTO/screens.html`:
    - barra de comando ao lado do título, com algoritmo, contagens livres e "Calcular plano";
    - painel esquerdo com abas e totais da API e cartões com `MiniRoute`;
    - bandeja com "Seleção · N pedidos", comparação, pílulas de atribuição, não atribuídos, estado por linha no lote, "Aplicar plano" e "Despachar todos".
  - A grade de pontos fica mais visível nesta tela (`body.flat`, equivalente a `data-scene="flat"` no Shell).
  - O aviso de nenhum motorista elegível e os textos atuais continuam.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS, inclusive `planComparison.test.ts`.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Dispatch.tsx frontend/src/pages/dispatch.test.tsx frontend/src/styles/dispatch.css frontend/src/main.tsx
```

---

### Task 4: Verificação e commit da fase

- [ ] **Step 1: Verificação padrão**
  - Tela: `/dispatch` como despachante.
  - fps: medir durante os 900 ms dos arcos mais as duas passadas dos cometas, e depois parado. Pelo menos 55 nos dois.
  - Conferir que os cometas param.

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src
git commit -m "feat(frontend): central de despacho como mesa de planejamento sobre o mapa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão do dono do produto.**
