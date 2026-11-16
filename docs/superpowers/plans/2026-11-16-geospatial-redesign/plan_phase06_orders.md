# Fase 6 — Pedidos, novo pedido e detalhe do pedido

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer a mesa de pedidos, o novo pedido como "rota sendo montada" e o detalhe do pedido: com câmera de acompanhamento para a equipe e editorial para o cliente.

**Spec:** §7.4, §7.5, §7.6, §7.10.3 (Pedidos, Novo pedido, Detalhe do pedido do cliente), §13, item 11. Referência visual: cena `#order` de `$PROTO/screens.html`. Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

---

### Task 1: Totais por filtro (hook compartilhado)

**Files:**
- Create: `src/hooks/useTotals.ts`, `src/hooks/useTotals.test.tsx`

**Interfaces:**
- Produces: `useTotals(path: string, param: string, values: readonly string[], extra?: Record<string, string | boolean>): Record<string, number | undefined>`. Faz uma `GET path?{param}=v&limit=1` por valor (com `extra`), com a chave `[path, "total", param, v, extra]` e `staleTime: 30_000`, e devolve o `total` de cada uma. A Fase 8 reaproveita o hook para os veículos.

- [ ] **Step 1: Write the failing test** (`request` mocado)

```tsx
it("reads each total with limit=1 and exposes them by value", async () => {
    request.mockImplementation((_m: string, _p: string, _b: unknown, q: { status: string }) =>
        Promise.resolve({ items: [], total: q.status === "CREATED" ? 7 : 2, limit: 1, offset: 0 }),
    );
    const { result } = renderHookWithClient(() => useTotals("/orders", "status", ["CREATED", "FAILED"], { active: true }));
    await waitFor(() => expect(result.current).toEqual({ CREATED: 7, FAILED: 2 }));
    expect(request).toHaveBeenCalledWith("GET", "/orders", undefined, { status: "CREATED", active: true, limit: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/useTotals.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** com `useQueries` e `select: (page) => page.total`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/useTotals.test.tsx`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/hooks
```

---

### Task 2: Cena do detalhe do pedido e regra de acompanhamento (funções puras)

**Files:**
- Create: `src/pages/order/orderScene.ts`, `src/pages/order/orderScene.test.ts`

**Interfaces:**
- Consumes: `MapScene`, `SceneMarker`, `Padding` (Fase 2); `legsFromStops` e `stopMarkers` (código existente); os tipos `OrderDetail`, `OrderRoute`, `Driver` e `OrderStatus`.
- Produces:
  - `shouldFollow(status: OrderStatus, position: { lat: number | null; lng: number | null } | null): boolean`. Verdadeiro só para `DRIVER_ENROUTE` e `IN_PROGRESS` com as duas coordenadas;
  - `orderScene(input: { order: OrderDetail; route: OrderRoute | null; driver: Driver | null; following: boolean; padding: Padding }): MapScene`.

- [ ] **Step 1: Write the failing test**

```ts
describe("shouldFollow", () => {
    it.each([
        ["DRIVER_ENROUTE", { lat: -24.86, lng: -54.33 }, true],
        ["IN_PROGRESS", { lat: -24.86, lng: -54.33 }, true],
        ["DISPATCHED", { lat: -24.86, lng: -54.33 }, false],
        ["IN_PROGRESS", { lat: null, lng: null }, false],
        ["IN_PROGRESS", null, false],
        ["COMPLETED", { lat: -24.86, lng: -54.33 }, false],
    ] as const)("%s with %o → %s", (status, position, expected) => {
        expect(shouldFollow(status, position)).toBe(expected);
    });
});

describe("orderScene", () => {
    it("shows the route overview at 30° with terrain 1.3 and animated legs", () => {
        const scene = orderScene({ order, route, driver: null, following: false, padding: ZERO });
        expect(scene.camera).toMatchObject({ fit: "legs", pitch: 30, terrain: 1.3, follow: null });
        expect(scene.animateLegs).toBe(true);
    });

    it("falls back to the stop markers when the route is missing", () => {
        const scene = orderScene({ order, route: null, driver: null, following: false, padding: ZERO });
        expect(scene.legs ?? []).toEqual([]);
        expect(scene.markers.map((m) => m.kind)).toEqual(["pickup", "dropoff"]);
        expect(scene.camera?.fit).toBe("markers");
    });

    it("labels the next stop with a HUD", () => {
        const scene = orderScene({ order, route, driver: null, following: false, padding: ZERO });
        expect(scene.markers.find((m) => m.kind === "hud")?.hud).toEqual({ label: "Próxima parada", value: "Bom Preço" });
    });

    it("follows the vehicle marker when following", () => {
        const driver = { publicId: "d1", lat: -24.86, lng: -54.33, status: "BUSY" } as Driver;
        const scene = orderScene({ order: { ...order, status: "IN_PROGRESS" }, route, driver, following: true, padding: ZERO });
        expect(scene.markers.find((m) => m.id === "vehicle")).toMatchObject({ kind: "vehicle", lat: -24.86, lng: -54.33 });
        expect(scene.camera?.follow).toEqual({ markerId: "vehicle", zoom: 15.4, pitch: 68 });
    });

    it("never adds a vehicle marker without a position", () => {
        const driver = { publicId: "d1", lat: null, lng: null, status: "BUSY" } as Driver;
        const scene = orderScene({ order: { ...order, status: "IN_PROGRESS" }, route, driver, following: true, padding: ZERO });
        expect(scene.markers.some((m) => m.kind === "vehicle")).toBe(false);
        expect(scene.camera?.follow).toBeNull();
    });
});
```

Fixtures: `order` com retirada "Armazém", uma parada "Bom Preço" e entrega "CD Medianeira". `route` com a retirada visitada, a perna 1 com `path` e a perna 2 sem `path`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/order/orderScene.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - A próxima parada é a primeira sem `visitedAt`, e o marcador dela leva `next: true`.
  - As pílulas de km seguem a regra do `liveMapScene` (Fase 3).
  - `follow` só existe quando `following && shouldFollow(order.status, driver)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/order/orderScene.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/order
```

---

### Task 3: Mesa de pedidos (`/orders`)

**Files:**
- Modify:
  - `src/pages/OrdersList.tsx` (apresentação; queries, filtros na URL, ordenação e paginação iguais);
  - `src/components/DataTable.tsx` (visual chapado, `onRowClick` e `selectedKey` opcionais, lista de registros abaixo de 768 px só por CSS: o markup continua `<table>`, e cada `<td>` leva `data-label` com o cabeçalho);
  - `src/components/CatalogFilters.tsx` (barra de vidro em pílula).
- Create: `src/pages/order/ordersList.test.tsx`, `src/styles/orders.css` (reescrita)

**Interfaces:**
- Consumes: `useTotals` (Task 1), `MiniRoute`, `StopTimeline`, `timelineFromRoute`, `SidePanelLayout`, `SidePanel`, `StatusBadge`, `HeroNumber` e `useTitleBlock`.
- Produces: `DataTable` com as props novas opcionais `onRowClick?: (row: T) => void` e `selectedKey?: string | null`. O resto da API não muda.

- [ ] **Step 1: Write the failing test** (`request` mocado; sessão de despachante; 2 pedidos)

```tsx
it("shows status counts in the filter segment", async () => {
    renderAt("/orders", <OrdersList />);
    expect(await screen.findByRole("button", { name: /Criado\s*7/ })).toBeInTheDocument();
});

it("opens the side panel with the stop timeline when a row is selected", async () => {
    renderAt("/orders", <OrdersList />);
    await userEvent.click(await screen.findByText("Armazém Toledo"));
    const panel = screen.getByRole("dialog", { name: "KJ7Q2M9XAB" });
    expect(within(panel).getByRole("list", { name: "Paradas" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Abrir pedido" })).toHaveAttribute("href", "/orders/o1");
});

it("navigates directly when the code is clicked", async () => {
    renderAt("/orders", <OrdersList />);
    await userEvent.click(await screen.findByRole("link", { name: "KJ7Q2M9XAB" }));
    expect(currentPath()).toBe("/orders/o1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/order/ordersList.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - Composição de §7.4 e §7.10.3 ("Mesa de pedidos"):
    - título com "Novo pedido" para quem pode criar;
    - barra de filtros fixa, com os status no segmento e contagens de `useTotals("/orders", "status", STATUSES)`;
    - tabela chapada em vidro, com `MiniRoute` na coluna "Origem e destino".
  - O `SidePanel` busca `["order", id]` e `["order", id, "route"]`. Para o cliente, sem rota: a linha do tempo vem das paradas do `OrderDetail`.
  - Estados: skeleton chapado, vazio com "Novo pedido" ou "Limpar filtros", erro com "Tentar de novo".

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS, inclusive `catalogFilters.test.tsx` e `usersTable.test.tsx`, que usam o `DataTable` e os filtros.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/OrdersList.tsx frontend/src/components/DataTable.tsx frontend/src/components/CatalogFilters.tsx frontend/src/pages/order/ordersList.test.tsx frontend/src/styles/orders.css
```

---

### Task 4: Novo pedido como rota sendo montada (`/orders/new`)

**Files:**
- Modify: `src/pages/NewOrder.tsx` (apresentação; RHF, validações, limite de 50 paradas, escolha no mapa e mensagens iguais), `src/pages/newOrderForm.test.tsx` (só onde o markup mudar)

**Interfaces:**
- Consumes: `StopTimeline` (o formulário de paradas usa o mesmo markup de linha do tempo), `GlassMapFrame`, `Glass` e `useTitleBlock`.

- [ ] **Step 1: Write the failing test** (no `newOrderForm.test.tsx` existente)

```tsx
it("grows the stop timeline as stops are added", async () => {
    renderNewOrder();
    const list = screen.getByRole("list", { name: "Paradas" });
    const before = within(list).getAllByRole("listitem").length;
    await userEvent.click(screen.getByRole("button", { name: /Adicionar parada/ }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(before + 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/newOrderForm.test.tsx`
Expected: FAIL no caso novo.

- [ ] **Step 3: Rewrite the presentation**
  - Composição de §7.6:
    - duas colunas;
    - seções em vidro regular com campos chapados;
    - retirada, paradas e entrega numa `<ol aria-label="Paradas">` com os marcadores R / número / E da `StopTimeline`;
    - à direita, `GlassMapFrame` fixo, com os pontos aparecendo conforme são preenchidos.
  - Abaixo de 1024 px, uma coluna, com a prévia recolhível acima das ações.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/NewOrder.tsx frontend/src/pages/newOrderForm.test.tsx
```

---

### Task 5: Detalhe do pedido da equipe (câmera de acompanhamento)

**Files:**
- Modify:
  - `src/pages/OrderDetail.tsx` (separa equipe e cliente; queries, STOMP, mutações, modais e `orderActions` iguais);
  - `src/pages/RouteBlock.tsx` (vira a faixa inferior; props iguais).
- Create:
  - `src/pages/order/StaffOrderView.tsx`;
  - `src/pages/order/staffOrderView.test.tsx`;
  - `src/styles/order.css`.

**Interfaces:**
- Consumes: `orderScene` e `shouldFollow` (Task 2); `useMapScene`, `useFollowState` e `setFollowState` (Fase 2); `VehicleCard`, `StopTimeline`, `timelineFromRoute`, `HeroNumber`, `Glass`, `FallbackNotice` e `MapLegend`.
- Produces: a query nova `useQuery({ queryKey: ["vehicle", vehicleId], queryFn: () => request<Vehicle>("GET", \`/vehicles/${vehicleId}\`), enabled: isStaff && !!vehicleId })`.

- [ ] **Step 1: Write the failing test** (`request`, `useMapScene` e `useTopic` mocados; sessão de despachante; pedido `IN_PROGRESS` com veículo "v1" e motorista com posição)

```tsx
it("loads the vehicle to show its render, type and status", async () => {
    renderAt("/orders/o1", <OrderDetail />);
    expect(await screen.findByAltText("Van BRA2E19")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("GET", "/vehicles/v1");
});

it("follows the vehicle and offers 'Seguir veículo' after a gesture", async () => {
    renderAt("/orders/o1", <OrderDetail />);
    await waitFor(() => expect(lastScene().camera?.follow).toEqual({ markerId: "vehicle", zoom: 15.4, pitch: 68 }));
    expect(screen.queryByRole("button", { name: "Seguir veículo" })).toBeNull();
    act(() => setFollowState("suspended"));
    await userEvent.click(await screen.findByRole("button", { name: "Seguir veículo" }));
    expect(getFollowState()).toBe("following");
});

it("shows the empty vehicle card without a vehicle", async () => {
    mockOrder({ vehicle: null });
    renderAt("/orders/o1", <OrderDetail />);
    expect(await screen.findByText("Sem veículo atribuído")).toBeInTheDocument();
    expect(request).not.toHaveBeenCalledWith("GET", expect.stringMatching(/^\/vehicles\//));
});

it("keeps the cargo, timeline and customer tabs", async () => {
    renderAt("/orders/o1", <OrderDetail />);
    for (const name of ["Carga", "Linha do tempo", "Cliente"]) expect(await screen.findByRole("tab", { name })).toBeInTheDocument();
});
```

Só o `useMapScene` é mocado. O `sceneStore` real fica, para o botão ler `useFollowState()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/order/staffOrderView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `StaffOrderView` and the strip**
  - Composição de §7.5 (Equipe), com os valores de `.order-left`, `.vt`, `.vehicle-card`, `.ord-tabs`, `.strip` e `.follow-btn` de `$PROTO/screens.html`:
    - o painel esquerdo com o link "Pedidos", o código em mono, o status grande com ponto pulsante nos status ativos, cliente e hora, `StopTimeline` e ações que quebram em linhas;
    - `VehicleCard` em cima à direita;
    - abas embaixo à direita;
    - `RouteBlock` como faixa inferior, com stepper, `FallbackNotice`, totais e ETA em `HeroNumber size="stat"`.
  - O padding da câmera vem dos insets dos painéis, medidos com `ResizeObserver`.
  - `OrderDetail.tsx` escolhe `StaffOrderView` ou `CustomerOrderView` (Task 6) pelo perfil.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS, inclusive `orderActions.test.ts` e `graphStatus.test.tsx`.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/OrderDetail.tsx frontend/src/pages/RouteBlock.tsx frontend/src/pages/order frontend/src/styles/order.css frontend/src/main.tsx
```

---

### Task 6: Detalhe do pedido do cliente (editorial)

**Files:**
- Create: `src/pages/order/CustomerOrderView.tsx`
- Modify: `src/pages/customerOrderView.test.tsx`

**Interfaces:**
- Consumes: `HeroNumber`, `StopTimeline` e `Glass`; os dados atuais do cliente (`["order", id]` e `["track", trackingNumber]`).

- [ ] **Step 1: Write the failing test** (acrescentar ao arquivo existente)

```tsx
it("leads with the API ETA and never shows internal data", async () => {
    renderCustomerOrder({ etaMinutes: 38 });
    expect(await screen.findByText("Chegada estimada")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.queryByText(/km/)).toBeNull();
    expect(screen.queryByText(/Placa|Veículo/)).toBeNull();
    expect(lastSceneOrNull()).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/customerOrderView.test.tsx`
Expected: FAIL no caso novo.

- [ ] **Step 3: Implement**
  - Composição "Onde está meu pedido" (§7.10.3): status grande, ETA em `HeroNumber` com o rótulo "Chegada estimada" e unidade "min", linha do tempo de eventos e `StopTimeline` das paradas.
  - Os cancelamentos e ações do cliente continuam como estão hoje.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/order/CustomerOrderView.tsx frontend/src/pages/customerOrderView.test.tsx
```

---

### Task 7: Verificação e commit da fase

- [ ] **Step 1: Verificação padrão**
  - Telas: `/orders` (despachante e cliente), `/orders/new`, `/orders/:id` de um pedido em andamento (despachante, com o simulador rodando) e `/orders/:id` como cliente.
  - fps: na câmera de acompanhamento, com posições chegando por 3 s. Pelo menos 55.
  - Conferir os prédios 3D na altura de acompanhamento, o deslize do marcador e a retomada com "Seguir veículo".

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src
git commit -m "feat(frontend): pedidos com mesa, rota sendo montada e câmera de acompanhamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão do dono do produto.**
