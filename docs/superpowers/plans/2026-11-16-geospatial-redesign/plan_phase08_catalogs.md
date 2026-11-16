# Fase 8 — Garagem de Veículos, gestão e cadastros

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer as telas de gestão no padrão novo: a garagem de Veículos com renders e painel lateral, e as demais telas, cada uma com o ponto de vista próprio da spec, trocando o drawer opaco pelo `SidePanel`.

**Spec:** §7.8, §7.10.1, §7.10.2, §7.10.3 (linhas de Motoristas a Minha conta). Referência visual: cena `#fleet` de `$PROTO/screens.html`. Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

**Regra comum a todas as tarefas desta fase:**
- O drawer de cada tela vira `SidePanelLayout` + `SidePanel`, com modo detalhe e modo formulário (o formulário atual, com campos chapados). Os modais de confirmação continuam (`ConfirmDialog`).
- Queries, mutações, invalidações, validações e mensagens não mudam.
- Cada tela usa `useTitleBlock` com a linha de contagens e a ação primária.
- Os estados (skeleton, vazio, erro) seguem §7.10.1, item 6.
- Os testes existentes (`driverForm.test.tsx`, `forms.test.tsx`, `usersTable.test.tsx`, `trendsCustomer.test.tsx`, `graphStatus.test.tsx`) só mudam onde o markup mudou, sem perder asserções.

---

### Task 1: Garagem de Veículos (`/vehicles`)

**Files:**
- Modify: `src/pages/Vehicles.tsx` (reescrita da apresentação)
- Create: `src/pages/vehicles/VehicleGarageCard.tsx`, `src/pages/vehicles/vehicles.test.tsx`, `src/styles/garage.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `useTotals` (Fase 6), `vehicleRender`, `SidePanelLayout`, `SidePanel`, `StatusBadge`, `Glass` e `useTitleBlock`.
- Produces: `VehicleGarageCard({ vehicle, selected, onSelect }: { vehicle: Vehicle; selected: boolean; onSelect: () => void })`.

- [ ] **Step 1: Write the failing test** (`request` mocado; sessão de gestor de frota; 3 veículos: "Van" disponível com motorista, "Moto" em manutenção, "Caminhão" inativo)

```tsx
it("shows the count line from the API totals", async () => {
    renderAt("/vehicles", <Vehicles />);
    expect(await screen.findByText(/12 veículos · 5 disponíveis · 4 em uso · 3 em manutenção/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("GET", "/vehicles", undefined, expect.objectContaining({ status: "MAINTENANCE", limit: 1 }));
});

it("renders the side view for known types and a fallback for unknown ones", async () => {
    renderAt("/vehicles", <Vehicles />);
    expect(await screen.findByAltText("Van BRA2E19")).toHaveAttribute("src", "/vehicles/van-side.webp");
    expect(screen.getByText("Sem imagem para “Moto”")).toBeInTheDocument();
    expect(screen.queryByAltText(/Moto/)).toBeNull();
});

it("dims inactive vehicles with the 'Inativo' chip", async () => {
    renderAt("/vehicles?includeInactive=true", <Vehicles />);
    const card = (await screen.findByText("RHN7C02")).closest("button")!;
    expect(card).toHaveClass("is-inactive");
    expect(within(card).getByText("Inativo")).toBeInTheDocument();
});

it("opens and closes the detail panel by clicking the same card again", async () => {
    renderAt("/vehicles", <Vehicles />);
    const card = (await screen.findByText("BRA2E19")).closest("button")!;
    await userEvent.click(card);
    expect(screen.getByRole("dialog", { name: "BRA2E19" })).toBeInTheDocument();
    await userEvent.click(card);
    expect(screen.queryByRole("dialog")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/vehicles`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - Composição de §7.8 (Veículos), com os valores de `.garage`, `.vcard`, `.vdetail` e `.has-detail` de `$PROTO/screens.html`:
    - contagens de `useTotals("/vehicles", "status", ["AVAILABLE", "IN_USE", "MAINTENANCE"])` e o total da lista sem filtro;
    - barra em pílula com segmento, busca `q` e "Novo veículo";
    - grade `repeat(auto-fill, minmax(262px, 1fr))` com cartões de 238 px e raio de 26 px;
    - painel com render 3/4, placa em 40 px, linhas "Motorista atual", "Status" e "Cadastro", e as ações de hoje.
  - O cartão é um `<button>` com `aria-pressed` e a classe `is-inactive` quando `!active`.
  - O render lateral usa `loading="lazy"` e o `width`/`height` de `vehicleRender`.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Vehicles.tsx frontend/src/pages/vehicles frontend/src/styles/garage.css frontend/src/main.tsx
```

---

### Task 2: Equipe e perfil do motorista (`/drivers`, `/drivers/:id`)

**Files:**
- Modify: `src/pages/Drivers.tsx`, `src/pages/DriverDetail.tsx`, `src/pages/driverForm.test.tsx`
- Create: `src/patterns/Avatar.tsx`, `src/pages/drivers/drivers.test.tsx`

**Interfaces:**
- Consumes: `useTotals`, `VehicleCard`, `GlassMapFrame`, `MiniRoute`, `HeroNumber`, `SidePanel` e `vehicleRender`.
- Produces: `Avatar({ name, size }: { name: string; size?: "sm" | "md" | "lg" })`, com iniciais de até 2 letras e `aria-hidden`. As Tasks 3 e 5 e a Fase 9 reaproveitam.

- [ ] **Step 1: Write the failing test** (`request` mocado; 2 motoristas: um com veículo "Van" e posição, outro sem veículo e sem posição)

```tsx
it("lists drivers with avatar, status, small side render and last signal", async () => {
    renderAt("/drivers", <Drivers />);
    const row = (await screen.findByText("Marcos Vieira")).closest("tr")!;
    expect(within(row).getByText("MV")).toBeInTheDocument();
    expect(within(row).getByAltText("Van BRA2E19")).toHaveAttribute("src", "/vehicles/van-side.webp");
});

it("shows the side panel with the vehicle card and a mini map only when there is a position", async () => {
    renderAt("/drivers", <Drivers />);
    await userEvent.click(await screen.findByText("Marcos Vieira"));
    expect(within(screen.getByRole("dialog", { name: "Marcos Vieira" })).getByTestId("glass-map-frame")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Ana Souza"));
    const panel = screen.getByRole("dialog", { name: "Ana Souza" });
    expect(within(panel).queryByTestId("glass-map-frame")).toBeNull();
    expect(within(panel).getByText("Sem posição")).toBeInTheDocument();
    expect(within(panel).getByText("Sem veículo atribuído")).toBeInTheDocument();
});
```

O `GlassMapFrame` é mocado no teste como `<div data-testid="glass-map-frame" />`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/drivers`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - **Motoristas** ("Equipe"):
    - contagens de `useTotals("/drivers", "status", ["AVAILABLE", "BUSY", "OFFLINE"])` no segmento;
    - linhas com `Avatar`, status, placa com render lateral de 56 px (tipo de `Driver.vehicle.type`) e último sinal (`formatAgo`);
    - `SidePanel` com avatar grande, nome, status, `VehicleCard` e `GlassMapFrame` da última posição.
  - **Detalhe** ("Perfil do motorista"):
    - nome e status grandes;
    - `VehicleCard`;
    - `GlassMapFrame` com a última posição;
    - pedidos recentes com `MiniRoute`;
    - números de desempenho em `HeroNumber size="stat"`, só quando a query atual de desempenho existe para o perfil.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Drivers.tsx frontend/src/pages/DriverDetail.tsx frontend/src/pages/driverForm.test.tsx frontend/src/patterns/Avatar.tsx frontend/src/pages/drivers
```

---

### Task 3: Frotas (`/fleets`, `/fleets/:id`)

**Files:**
- Modify: `src/pages/Fleets.tsx`, `src/pages/FleetDetail.tsx`
- Create: `src/pages/fleets/fleets.test.tsx`

**Interfaces:**
- Consumes: `Avatar`, `GlassMapFrame`, `SidePanel` e `StatusBadge`. Os cartões buscam `["fleet", id]` (`GET /fleets/:id`) para os motoristas da frota, com `useQueries` limitado às frotas da página atual.

- [ ] **Step 1: Write the failing test** (2 frotas; a primeira com 3 motoristas: 2 disponíveis e 1 ocupado)

```tsx
it("shows each fleet as a card with a stacked status bar and overlapping avatars", async () => {
    renderAt("/fleets", <Fleets />);
    const card = (await screen.findByText("Oeste")).closest("article")!;
    expect(within(card).getByText("3 motoristas")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: "2 disponíveis, 1 ocupado, 0 offline" })).toBeInTheDocument();
    expect(within(card).getAllByText(/^[A-Z]{1,2}$/)).toHaveLength(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/fleets`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - **Frotas** ("Grupos da operação"):
    - cartões de vidro com o nome, `driverCount` em peso 200, barra empilhada por status com `role="img"` e `aria-label` descritivo, e até 5 avatares sobrepostos (com "+N");
    - `SidePanel` com os membros e a edição atual.
  - **Detalhe** ("A frota no território"):
    - nome e contagem;
    - `GlassMapFrame` com os motoristas que têm posição;
    - lista de membros com status.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Fleets.tsx frontend/src/pages/FleetDetail.tsx frontend/src/pages/fleets
```

---

### Task 4: Lugares e Meus endereços (`/places`, `/my/places`)

**Files:**
- Modify: `src/pages/Places.tsx`, `src/pages/MyPlaces.tsx`, `src/pages/forms.test.tsx` (onde o markup mudar)
- Create: `src/pages/places/places.test.tsx`

**Interfaces:**
- Consumes: `GlassMapFrame` com `focusId` (prop existente do `MapView`), `SidePanel` e `HeroNumber`.

- [ ] **Step 1: Write the failing test** (`GlassMapFrame` mocado guardando as props)

```tsx
it("pins every place with coordinates and flies to the selected one", async () => {
    renderAt("/places", <Places />);
    await screen.findByText("CD Medianeira");
    expect(lastMapProps().markers.map((m: MapMarker) => m.id)).toEqual(["p1", "p2"]);
    await userEvent.click(screen.getByText("CD Medianeira"));
    expect(lastMapProps().focusId).toBe("p2");
});

it("picks the point on the map while creating", async () => {
    renderAt("/places", <Places />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo lugar" }));
    act(() => lastMapProps().onPick(-25.29, -54.09));
    expect(screen.getByLabelText("Latitude")).toHaveValue(-25.29);
});
```

Ajustar os nomes do botão e dos campos aos textos atuais de `Places.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/places`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - **Lugares** ("Pontos da operação"):
    - a contagem em `HeroNumber size="large"`;
    - lista à esquerda e `GlassMapFrame` grande à direita com todos os pinos;
    - selecionar na lista define `focusId`;
    - criação e edição no `SidePanel`, com a escolha de ponto no mesmo mapa.
  - **Meus endereços:** a mesma composição, sem dados internos.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Places.tsx frontend/src/pages/MyPlaces.tsx frontend/src/pages/forms.test.tsx frontend/src/pages/places
```

---

### Task 5: Clientes e Usuários (`/customers`, `/users`)

**Files:**
- Modify: `src/pages/Customers.tsx`, `src/pages/Users.tsx`, `src/pages/usersTable.test.tsx`
- Create: `src/pages/people/people.test.tsx`

**Interfaces:**
- Consumes: `Avatar`, `SidePanel`, `HeroNumber` e `ROLE_LABEL`.

- [ ] **Step 1: Write the failing test**

```tsx
it("counts users by role only when the whole list is on the page", async () => {
    mockUsers({ total: 4, items: [admin, dispatcher, dispatcher, customer] });
    renderAt("/users", <Users />);
    expect(await screen.findByText("2 despachantes")).toBeInTheDocument();
    mockUsers({ total: 40, items: [admin, dispatcher] });
    rerenderAt("/users", <Users />);
    expect(await screen.findByText("40 usuários")).toBeInTheDocument();
    expect(screen.queryByText(/despachantes/)).toBeNull();
});

it("shows customers with initials and opens the side panel", async () => {
    renderAt("/customers", <Customers />);
    await userEvent.click(await screen.findByText("Mercado Bom Preço"));
    expect(screen.getByRole("dialog", { name: "Mercado Bom Preço" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/people`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - **Clientes** ("Carteira"): o total em `HeroNumber size="large"`, linhas com `Avatar`, e um `SidePanel` com os dados e as ações atuais.
  - **Usuários** ("Acesso"):
    - pílulas de perfil;
    - `SidePanel` para editar o perfil, desativar e reativar, como hoje;
    - contagem por perfil só quando `total <= items.length`. `GET /users` não filtra por perfil, e contar só a página seria mentir.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Customers.tsx frontend/src/pages/Users.tsx frontend/src/pages/usersTable.test.tsx frontend/src/pages/people
```

---

### Task 6: Alertas, Tendência anual, Economia de rotas, Mapa viário e Minha conta

**Files:**
- Modify:
  - `src/pages/Alerts.tsx`, `src/pages/Trends.tsx`, `src/pages/Routing.tsx`, `src/pages/RoadGraph.tsx` e `src/pages/Account.tsx`;
  - `src/pages/trendsCustomer.test.tsx` e `src/pages/graphStatus.test.tsx` (onde o markup mudar).
- Create: `src/pages/insights/insights.test.tsx`, `src/styles/insights.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `HeroNumber`, `Avatar`, `GlassMapFrame`, `useChartColors` (atualizado para os tokens novos) e `Glass`.

- [ ] **Step 1: Write the failing test**

```tsx
it("Alerts leads with the total and groups by type with a severity stripe", async () => {
    renderAt("/alerts", <Alerts />);
    expect(await screen.findByText("Alertas ativos")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    const group = screen.getByRole("region", { name: /Motorista sem sinal/ });
    expect(group).toHaveAttribute("data-severity", "HIGH");
});

it("Trends leads with the year total", async () => {
    renderAt("/analytics/trends", <Trends />);
    expect(await screen.findByText("Pedidos no ano")).toBeInTheDocument();
});

it("Routing leads with saved km", async () => {
    renderAt("/analytics/routing", <Routing />);
    expect(await screen.findByText("km economizados")).toBeInTheDocument();
});

it("Account shows a large avatar with the initials", async () => {
    renderAt("/account", <Account />);
    expect(await screen.findByText("AD")).toHaveClass("avatar-lg");
});
```

Fixtures com os payloads atuais (`Alerts`, `YearlyTrends`, `RoutingReport`, `Me`). O total de "Pedidos no ano" é a soma de `months[].created`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/insights`
Expected: FAIL.

- [ ] **Step 3: Rewrite**
  - **Alertas** ("Central de atenção"):
    - total em `HeroNumber`;
    - grupos por tipo como `<section aria-label>` com `data-severity` e faixa de cor;
    - o link e a ação sugerida de cada alerta.
  - **Tendência anual** ("O ano em uma curva"):
    - `HeroNumber` "Pedidos no ano";
    - gráfico de área Recharts com gradiente limão (`--color-accent` de 40% a 0%), `isAnimationActive` com 1200 ms (desligado com movimento reduzido);
    - a tabela por motorista chapada.
  - **Economia de rotas** ("Quanto as rotas pouparam"):
    - `HeroNumber` "km economizados" (`savedKm`);
    - barras planejado contra original por algoritmo (`byAlgorithm`);
    - `batchDispatchPct`.
  - **Mapa viário** ("O grafo de ruas"):
    - status do grafo grande (Carregado ou Não carregado, com nós e arestas em peso 200);
    - `GlassMapFrame` grande com o teste ponto a ponto atual;
    - a rota do teste desenha o `path` devolvido por `/graph/route`.
  - **Minha conta** ("Perfil"): `Avatar size="lg"` com a classe `avatar-lg` e seções em vidro com a troca de senha atual.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/Alerts.tsx frontend/src/pages/Trends.tsx frontend/src/pages/Routing.tsx frontend/src/pages/RoadGraph.tsx frontend/src/pages/Account.tsx frontend/src/pages/trendsCustomer.test.tsx frontend/src/pages/graphStatus.test.tsx frontend/src/pages/insights frontend/src/styles/insights.css frontend/src/main.tsx frontend/src/pages/dashboardParts.tsx
```

---

### Task 7: Verificação e commit da fase

- [ ] **Step 1: Verificação padrão**
  - Telas: todas as rotas desta fase, com o perfil certo (gestor de frota para Veículos, Frotas e Motoristas; administrador para Usuários, Mapa viário, Tendência e Economia; cliente para Meus endereços).
  - fps: rolagem da grade de Veículos com 12 cartões. Pelo menos 55.
  - Conferir cada tela contra a linha dela em §7.10.3.

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src
git commit -m "feat(frontend): garagem de veículos e telas de gestão no padrão de vidro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão do dono do produto.**
