# Fase 7 — Simulador de rota

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer `/routes/optimize` como laboratório de rota sobre o mapa plano: escolha exclusiva de pontos, rota otimizada desenhada progressivamente, camada da ordem original e resultado com km em destaque.

**Spec:** §7.7, §7.10.3 (Simulador de rota), §5.4 (camada original). Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

---

### Task 1: Cena do laboratório (função pura)

**Files:**
- Create: `src/pages/routeLab/routeLabScene.ts`, `src/pages/routeLab/routeLabScene.test.ts`

**Interfaces:**
- Consumes: `MapScene`, `SceneMarker`, `Padding` (Fase 2); `LegKind` com `"original"` (Fase 2, Task 2); os tipos `OptimizeResponse` e `OptimizedStop`.
- Produces:
  - `type LabPoint = { lat: number; lng: number }`;
  - `routeLabScene(input: { start: LabPoint | null; pickup: LabPoint | null; waypoints: LabPoint[]; dropoff: LabPoint | null; result: OptimizeResponse | null; showOriginal: boolean; pick: { hint: string; onPick: (lat: number, lng: number) => void }; padding: Padding }): MapScene`.

- [ ] **Step 1: Write the failing test**

```ts
const p = (lat: number, lng: number) => ({ lat, lng });
const base = { start: null, pickup: p(-24.86, -54.33), waypoints: [p(-24.9, -54.3), p(-25.0, -54.2)], dropoff: p(-25.09, -54.24), result: null, showOriginal: true, pick, padding: ZERO };

describe("routeLabScene", () => {
    it("marks typed points and keeps pick mode on", () => {
        const scene = routeLabScene(base);
        expect(scene.markers.map((m) => m.label)).toEqual(["R", "1", "2", "E"]);
        expect(scene.pick?.hint).toBe(pick.hint);
        expect(scene.camera).toMatchObject({ pitch: 0, terrain: 0 });
    });

    it("draws the original order as straight lines in typed order", () => {
        const scene = routeLabScene(base);
        const original = scene.legs?.filter((l) => l.kind === "original") ?? [];
        expect(original).toHaveLength(1);
        expect(original[0].points).toEqual([[-24.86, -54.33], [-24.9, -54.3], [-25.0, -54.2], [-25.09, -54.24]]);
    });

    it("hides the original layer when toggled off", () => {
        expect(routeLabScene({ ...base, showOriginal: false }).legs ?? []).toEqual([]);
    });

    it("draws the optimized route progressively with km pills and renumbers stops by result order", () => {
        const scene = routeLabScene({ ...base, result });
        expect(scene.animateLegs).toBe(true);
        expect(scene.legs?.map((l) => l.kind)).toEqual(["original", "road", "estimated", "road"]);
        expect(scene.markers.filter((m) => m.kind === "pill").map((m) => m.pill?.text)).toEqual(["4,2 km", "8,0 km · estimado", "29,7 km"]);
        expect(scene.markers.filter((m) => m.kind === "waypoint").map((m) => m.label)).toEqual(["1", "2"]);
    });

    it("needs at least pickup and dropoff for the original layer", () => {
        expect(routeLabScene({ ...base, dropoff: null }).legs ?? []).toEqual([]);
    });
});
```

`result` é um `OptimizeResponse` com 4 paradas (`PICKUP`, `WAYPOINT` com `path`, `WAYPOINT` sem `path` e `distanceSource: "HAVERSINE"`, `DROPOFF` com `path`) e `legKm` de 4,2, 8,0 e 29,7.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/routeLab`
Expected: FAIL.

- [ ] **Step 3: Implement**

A camada original vai antes das pernas otimizadas, para ficar por baixo. As pernas otimizadas e as pílulas seguem a regra do `liveMapScene` (Fase 3). A câmera enquadra os pontos (`fit: "points"`), só quando o conjunto de pontos muda.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/routeLab`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/routeLab
```

---

### Task 2: Tela do laboratório

**Files:**
- Modify: `src/pages/RouteLab.tsx` (apresentação; estado, mutações, importação, limite de 50 paradas e mensagens iguais), `src/components/AlgorithmFields.tsx` (visual chapado)
- Create: `src/pages/routeLab/routeLab.test.tsx`, `src/styles/route-lab.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `routeLabScene` (Task 1), `useMapScene`, `useTitleBlock`, `Glass`, `HeroNumber`, `FallbackNotice` e `MapLegend`.

- [ ] **Step 1: Write the failing test** (`request` e `useMapScene` mocados)

```tsx
it("places points through the exclusive pick mode in target order", async () => {
    render(<RouteLab />);
    act(() => lastScene().pick!.onPick(-24.86, -54.33));
    act(() => lastScene().pick!.onPick(-25.09, -54.24));
    expect(screen.getByRole("radio", { name: "Parada" })).toBeChecked();
    expect(screen.getByText("-24.86000, -54.33000")).toBeInTheDocument();
    expect(screen.getByText("-25.09000, -54.24000")).toBeInTheDocument();
});

it("shows the optimized km as the hero number against the original", async () => {
    mockOptimize({ totalKm: 42.1, baselineKm: 51.8, savingsPct: 18.7, etaMinutes: 64 });
    renderWithPoints();
    await userEvent.click(screen.getByRole("button", { name: "Otimizar" }));
    expect(await screen.findByText("42,1")).toBeInTheDocument();
    expect(screen.getByText(/contra 51,8 km na ordem original/)).toBeInTheDocument();
    expect(screen.getByText("18,7%")).toBeInTheDocument();
});

it("toggles the original-order layer", async () => {
    renderWithPoints();
    await userEvent.click(screen.getByRole("switch", { name: "Ordem original (linha reta)" }));
    expect(lastScene().legs?.some((l) => l.kind === "original")).toBe(false);
});
```

As coordenadas mantêm o formato atual (`coords` em `RouteLab.tsx`, `toFixed(5)`). A economia usa `formatPercent`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/routeLab/routeLab.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite the presentation**
  - Composição de §7.7:
    - topo com `AlgorithmFields`, semente, comparar e "Otimizar", ao lado do título;
    - esquerda com o alvo em segmento (`role="radiogroup"`), a lista de pontos em mono com remover, e a importação de pedido;
    - direita, com resultado: `HeroNumber` do km otimizado com a legenda "contra X km na ordem original", economia, ETA, comparação por algoritmo em barras horizontais chapadas (km e ms, crescendo com `.motion-grow`), `FallbackNotice` e `MapLegend` com a camada original.
  - Sem pontos, um `EmptyState` sobre o mapa com a frase "Clique no mapa para marcar a retirada".

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS, inclusive `algorithmForm.test.tsx`.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/pages/RouteLab.tsx frontend/src/components/AlgorithmFields.tsx frontend/src/pages/routeLab frontend/src/styles/route-lab.css frontend/src/main.tsx
```

---

### Task 3: Verificação e commit da fase

- [ ] **Step 1: Verificação padrão**
  - Tela: `/routes/optimize` como administrador e despachante.
  - Cenários: marcar 6 pontos, otimizar com "comparar", importar um pedido e alternar a camada original.
  - fps: durante o desenho da rota. Pelo menos 55.

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src
git commit -m "feat(frontend): simulador de rota como laboratório sobre o mapa plano

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão do dono do produto.**
