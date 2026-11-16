# Fase 3 — Dados de verificação e Mapa ao vivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Popular o banco de desenvolvimento para verificar as telas e refazer o Mapa ao vivo como no mockup v6, sobre o mapa contínuo.

**Spec:** §7.1, §10 (dados para verificar), §5.4. Referência visual: `$PROTO/live-map-v6.html`. Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

---

### Task 1: Script de dados de desenvolvimento (fora do repositório)

**Files:**
- Create: `<scratchpad da sessão>/seed-dev-data.mjs`. Não vai para o repositório (spec §10).

**Interfaces:**
- Produces: banco local com dados realistas na região padrão (lat −25,4 a −24,5; lng −54,4 a −53,8).

Pré-condição: API em modo `road` com o grafo carregado (`plan_index.md`, Referências locais). O script começa com `GET /graph/status` e aborta com uma mensagem clara se `mode !== "ROAD"` ou `loaded !== true`, para nunca gravar pedidos com rotas retas.

- [ ] **Step 1: Write the script** (Node 18+, `fetch` nativo, contra `http://localhost:8081`)

Credenciais:
- Ler a credencial de administrador do `VITE_DEV_LOGINS` em `frontend/.env.local`, que é um JSON de `DevLogin[]`, como em `src/pages/Login.tsx`.
- Nunca imprimir credenciais nem tokens.

Login via `POST /auth/login`. Depois, criar de forma idempotente (pular o que já existe, pela placa, pelo nome ou pelo `username`):
- 14 motoristas;
- 12 veículos com tipos "Van", "Furgão", "Caminhão leve", "Caminhão" e "Moto", e status variados;
- 2 frotas;
- 6 lugares (Santa Helena, Missal, Medianeira, São José das Palmeiras, Itaipulândia, Entre Rios do Oeste);
- 3 clientes;
- 20 pedidos com 0 a 3 paradas.

Em seguida, atribuir e despachar parte dos pedidos com `POST /dispatch/plan` (aplicando) e `POST /orders/:id/dispatch`, para cobrir as etapas do funil. Para as posições dos motoristas, usar a mesma API que `scripts/DriverSimulator.java` usa (ler o arquivo para os endpoints e o Basic Auth).

- [ ] **Step 2: Run it twice**

Run: `node <scratchpad>/seed-dev-data.mjs` (duas vezes).
Expected: a primeira cria, a segunda só relata "já existe", e nenhuma credencial aparece na saída. No fim, o script lê `GET /orders/:id/route` dos pedidos criados e imprime quantas pernas vieram com `distanceSource: "ROAD"` e quantas caíram para estimado. Esperado: todas, ou quase todas, `ROAD`.

- [ ] **Step 3: Start the simulator**

Rodar `scripts/DriverSimulator.java` conforme o README do script, para mover os motoristas.

---

### Task 2: Cena do Mapa ao vivo (função pura)

**Files:**
- Create: `src/pages/liveMapScene.ts`, `src/pages/liveMapScene.test.ts`

**Interfaces:**
- Consumes: `MapScene`, `SceneMarker` (Fase 2); `legsFromStops` e `stopMarkers` (código existente); os tipos `Driver` e `OrderRoute`.
- Produces: `liveMapScene(input: { drivers: Driver[]; staleIds: ReadonlySet<string>; selectedId: string | null; route: OrderRoute | null; padding: Padding }): MapScene`.

- [ ] **Step 1: Write the failing test**

```ts
const driver = (id: string, extra: Partial<Driver> = {}): Driver => ({
    publicId: id, username: id, name: "Marcos Vieira", phone: null, licenseNumber: null, status: "BUSY",
    lat: -24.865, lng: -54.331, lastSeenAt: null, fleets: [], vehicle: null, active: true, ...extra,
});

describe("liveMapScene", () => {
    it("drops drivers without a position", () => {
        const scene = liveMapScene({ drivers: [driver("d1"), driver("d2", { lat: null, lng: null })], staleIds: new Set(), selectedId: null, route: null, padding: ZERO });
        expect(scene.markers.map((m) => m.id)).toEqual(["d1"]);
    });

    it("marks the selected driver and labels it with initials", () => {
        const scene = liveMapScene({ drivers: [driver("d1")], staleIds: new Set(["d1"]), selectedId: "d1", route: null, padding: ZERO });
        expect(scene.markers[0]).toMatchObject({ kind: "driver", selected: true, status: "BUSY", label: "MV", stale: true });
    });

    it("adds the selected route with stops, legs and km pills only where legKm exists", () => {
        const route = { stops: [
            { seq: 0, type: "PICKUP", name: "A", lat: -24.86, lng: -54.33, legKm: null, visitedAt: "x", path: null },
            { seq: 1, type: "DROPOFF", name: "B", lat: -25.09, lng: -54.24, legKm: 29.7, visitedAt: null, path: [[-24.86, -54.33], [-25.0, -54.3], [-25.09, -54.24]] },
            { seq: 2, type: "DROPOFF", name: "C", lat: -25.29, lng: -54.09, legKm: null, visitedAt: null, path: null },
        ] } as unknown as OrderRoute;
        const scene = liveMapScene({ drivers: [driver("d1")], staleIds: new Set(), selectedId: "d1", route, padding: ZERO });
        expect(scene.legs?.map((l) => l.kind)).toEqual(["road", "estimated"]);
        expect(scene.legs?.[0].points).toEqual([[-24.86, -54.33], [-25.0, -54.3], [-25.09, -54.24]]);
        expect(scene.legs?.[1].points).toEqual([[-25.09, -54.24], [-25.29, -54.09]]);
        expect(scene.markers.filter((m) => m.kind === "pill").map((m) => m.pill?.text)).toEqual(["29,7 km"]);
        expect(scene.markers.find((m) => m.title === "A")?.dimmed).toBe(true);
    });

    it("keeps the camera still for moving drivers and fits markers once", () => {
        const scene = liveMapScene({ drivers: [driver("d1")], staleIds: new Set(), selectedId: null, route: null, padding: ZERO });
        expect(scene.camera).toMatchObject({ fit: "markers", pitch: 0, terrain: 0 });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/liveMapScene.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `liveMapScene`**

Regras:
- a pílula de km fica no ponto médio da geometria da perna, com o texto de `formatKm`;
- a perna estimada leva o sufixo " · estimado" e `estimated: true`;
- o enquadramento usa a chave de "conjunto de pontos" do `MapView` atual, e motorista se movendo não reenquadra.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/liveMapScene.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/liveMapScene.ts frontend/src/pages/liveMapScene.test.ts
```

---

### Task 3: Tela do Mapa ao vivo

**Files:**
- Modify: `src/pages/LiveMap.tsx` (reescrita da apresentação, com as mesmas queries e assinaturas STOMP)
- Create: `src/pages/liveMap.test.tsx`, `src/styles/live-map.css`
- Modify: `src/main.tsx` (CSS)

**Interfaces:**
- Consumes: `liveMapScene` (Task 2), `useMapScene`, `useTitleBlock`, `Glass`, `StatusBadge`, `MapLegend` e `vehicleRender`.
- Produces: suporte a `?driver=<publicId>` na URL, que pré-seleciona o motorista. O Dashboard usa isso na Fase 5.

- [ ] **Step 1: Write the failing test** (`request`, `useMapScene` e `useTopic` mocados; sessão de administrador)

```tsx
it("preselects the driver from the URL and publishes it as selected", async () => {
    renderAt("/map?driver=d1", <LiveMap />);
    expect(await screen.findByRole("heading", { name: "Marcos Vieira" })).toBeInTheDocument();
    const scene = lastScene();
    expect(scene.markers.find((m) => m.id === "d1")?.selected).toBe(true);
});

it("shows 'Sem posição' for drivers without coordinates", async () => {
    renderAt("/map", <LiveMap />);
    expect(await screen.findByText("Sem posição")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/liveMap.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite `LiveMap.tsx`**
  - Composição da spec §7.1, com o markup e os valores de `$PROTO/live-map-v6.html`:
    - barra de comando em vidro no topo, com busca, segmento de status e frota;
    - painel direito com o cartão do selecionado, o pedido ativo e a lista;
    - base com "Frota agora", "Sem sinal" (só quando o perfil recebe `pingStale`) e legenda;
    - controles do mapa embaixo à esquerda (aproximar, enquadrar todos, afastar), que chamam a câmera da cena.
  - O tipo do veículo no cartão vem de `Driver.vehicle.type`.
  - Estados vazio e sem conexão conforme §7.1.
  - `useTitleBlock({ meta })` com as contagens.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/LiveMap.tsx frontend/src/pages/liveMap.test.tsx frontend/src/styles/live-map.css frontend/src/main.tsx
```

---

### Task 4: Verificação e commit da fase

- [ ] **Step 1: Verificação padrão**
  - Tela: `/map` como administrador e como despachante (sem "Sem sinal").
  - fps: pan e zoom contínuos por 3 s com todos os painéis abertos, com o simulador rodando. Pelo menos 55.
  - Comparar a captura a 1440 × 900 com `$PROTO/live-map-v6.html`.

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src
git commit -m "feat(frontend): mapa ao vivo sobre o mapa contínuo com painéis de vidro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão do dono do produto.**
