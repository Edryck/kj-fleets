# Fase 2 — Mapa contínuo, cena e shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um mapa MapLibre único no Shell, com recoloração, relevo, prédios e céu, um motor de cena declarativo com câmera e animações finitas, e o novo shell (menu lateral, controles globais, bloco de título, transição de página). As telas antigas continuam funcionando dentro dele.

**Spec:** §5.4, §5.5, §5.6, §6.1, §6.2, §6.3, §6.5, §7.10.2 (`HudLabel`, `GlassMapFrame`). Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

---

### Task 1: Estilo do mapa transformado

**Files:**
- Create:
  - `src/map/palettes.ts`;
  - `src/map/mapStyle.ts`;
  - `src/map/mapStyle.test.ts`;
  - `src/map/__fixtures__/libertyMini.json`.

**Interfaces:**
- Produces:
  - `interface MapPalette`: chaves de `PALETTES` em `$PROTO/kj-map.js`, incluindo `buildings`, `buildingOpacity`, `hillshade` e `sky`;
  - `PALETTES: Record<Theme, MapPalette>`;
  - `DEM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"` e `LIBERTY_URL = "https://tiles.openfreemap.org/styles/liberty"`;
  - `transformStyle(base: StyleSpecification, theme: Theme): StyleSpecification`, pura, sem mutar a entrada;
  - `loadStyle(theme: Theme): Promise<StyleSpecification>`. Baixa o liberty uma vez, guarda a promessa no módulo e memoriza o resultado por tema.

- [ ] **Step 1: Create the fixture** `libertyMini.json`

Um estilo mínimo válido, com a fonte `openmaptiles` (vetorial) e estas camadas:
- `background`;
- `water` (fill, `source-layer: water`);
- `landcover_wood` (fill);
- `poi_r1` (symbol, `source-layer: poi`);
- `highway-shield` (symbol);
- `road_motorway` (line);
- `building` (fill);
- `building-3d` (fill-extrusion, `layout.visibility: "none"`).

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import base from "./__fixtures__/libertyMini.json";
import { DEM_URL, PALETTES, transformStyle } from "./mapStyle";
import type { StyleSpecification } from "maplibre-gl";

const style = base as unknown as StyleSpecification;
const layer = (s: StyleSpecification, id: string) => s.layers.find((l) => l.id === id)!;

describe("transformStyle", () => {
    it("hides clutter layers", () => {
        const out = transformStyle(style, "dark");
        expect(layer(out, "poi_r1").layout?.visibility).toBe("none");
        expect(layer(out, "highway-shield").layout?.visibility).toBe("none");
    });

    it("adds separate DEM sources for terrain and hillshade", () => {
        const out = transformStyle(style, "dark");
        const dem = { type: "raster-dem", tiles: [DEM_URL], tileSize: 256, maxzoom: 13, encoding: "terrarium" };
        expect(out.sources.dem).toMatchObject(dem);
        expect(out.sources["dem-shade"]).toMatchObject(dem);
    });

    it("inserts the relief hillshade right before water", () => {
        const out = transformStyle(style, "light");
        const i = out.layers.findIndex((l) => l.id === "water");
        expect(out.layers[i - 1]).toMatchObject({ id: "relief", type: "hillshade", source: "dem-shade" });
        expect((out.layers[i - 1] as { paint: Record<string, unknown> }).paint["hillshade-illumination-direction"]).toBe(315);
    });

    it("shows 3D buildings colored by render_height", () => {
        const b = layer(transformStyle(style, "dark"), "building-3d") as { layout?: { visibility?: string }; paint: Record<string, unknown> };
        expect(b.layout?.visibility).toBe("visible");
        expect(JSON.stringify(b.paint["fill-extrusion-color"])).toContain("render_height");
    });

    it("applies the theme palette and sky without mutating the input", () => {
        const snapshot = JSON.stringify(style);
        const dark = transformStyle(style, "dark");
        const light = transformStyle(style, "light");
        expect(dark.sky).toEqual(PALETTES.dark.sky);
        expect(light.sky).toEqual(PALETTES.light.sky);
        expect(JSON.stringify(layer(dark, "background"))).not.toEqual(JSON.stringify(layer(light, "background")));
        expect(JSON.stringify(style)).toBe(snapshot);
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/map/mapStyle.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**
  - Portar `PALETTES` (valores literais) e `transformStyle` de `$PROTO/kj-map.js`, inclusive o bloco de `dem`, `dem-shade`, `relief`, `building-3d` e `sky`.
  - A fonte `dem` leva a atribuição `"Terrain: Mapzen / AWS Terrain Tiles"`.
  - Usar `structuredClone` na entrada.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/map/mapStyle.test.ts`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add frontend/src/map/palettes.ts frontend/src/map/mapStyle.ts frontend/src/map/mapStyle.test.ts frontend/src/map/__fixtures__
```

---

### Task 2: Camadas próprias, pernas e arcos

**Files:**
- Create: `src/map/mapLayers.ts`, `src/map/mapLayers.test.ts`
- Modify:
  - `src/components/RouteLegs.tsx`: `LegKind` ganha `"original"`, com rótulo `"Ordem original (linha reta)"`, e `MapLegend` ganha a prop `arcs?: boolean`, que mostra `"Atribuição do plano"`;
  - `src/components/legend.test.tsx`: um caso novo.

**Interfaces:**
- Produces:
  - `interface SceneArc { id: string; from: [number, number]; to: [number, number]; label?: string }`;
  - `KJ_SOURCES = ["kj-route", "kj-arcs", "kj-comets"] as const`;
  - os ids de camada `kj-route-glow`, `kj-route-casing`, `kj-route-solid`, `kj-route-dashed`, `kj-route-original`, `kj-arcs-glow`, `kj-arcs`, `kj-comets-glow` e `kj-comets`;
  - `legsToGeoJSON(legs: MapLeg[]): GeoJSON.FeatureCollection<GeoJSON.LineString, { kind: LegKind }>`;
  - `arcPoints(from: [number, number], to: [number, number], steps?: number): [number, number][]` (padrão de 48 passos, bezier quadrática);
  - `arcsToGeoJSON(arcs: SceneArc[], progress: number): GeoJSON.FeatureCollection<GeoJSON.LineString>`;
  - `ensureLayers(map: maplibregl.Map, palette: MapPalette): void` (idempotente);
  - `setLegData(map: maplibregl.Map, legs: MapLeg[]): void`;
  - `setArcData(map: maplibregl.Map, arcs: SceneArc[], progress?: number): void`;
  - `setCometData(map: maplibregl.Map, points: [number, number][]): void`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("map layers data", () => {
    it("converts legs to GeoJSON with [lng, lat] and keeps the kind", () => {
        const fc = legsToGeoJSON([{ kind: "original", points: [[-24.86, -54.33], [-25.09, -54.24]] }]);
        expect(fc.features[0].properties.kind).toBe("original");
        expect(fc.features[0].geometry.coordinates[0]).toEqual([-54.33, -24.86]);
    });

    it("draws a curved arc that starts and ends exactly at the endpoints", () => {
        const pts = arcPoints([-24.79, -54.19], [-24.858, -54.329], 48);
        expect(pts).toHaveLength(49);
        expect(pts[0]).toEqual([-24.79, -54.19]);
        expect(pts[48]).toEqual([-24.858, -54.329]);
        const mid = pts[24];
        const straight = [(-24.79 + -24.858) / 2, (-54.19 + -54.329) / 2];
        expect(Math.hypot(mid[0] - straight[0], mid[1] - straight[1])).toBeGreaterThan(0.001);
    });

    it("truncates arcs by progress", () => {
        const fc = arcsToGeoJSON([{ id: "a", from: [0, 0], to: [1, 1] }], 0.5);
        expect(fc.features[0].geometry.coordinates.length).toBeLessThan(49);
        expect(fc.features[0].geometry.coordinates.length).toBeGreaterThan(1);
    });
});
```

In `legend.test.tsx`:

```tsx
it("labels the original-order layer and plan arcs", () => {
    render(<MapLegend legs={[{ kind: "original", points: [[0, 0], [1, 1]] }]} arcs />);
    expect(screen.getByText("Ordem original (linha reta)")).toBeInTheDocument();
    expect(screen.getByText("Atribuição do plano")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/map/mapLayers.test.ts src/components/legend.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - Estilos de linha da spec §5.4: rota de 4 px com contorno de 7 px e brilho de 14 px; estimado tracejado `[2, 1.6]` em `--color-warning`, 3 px; original com 2 px, sólido, `--color-text-subtle` a 45%; arcos de 2 px em limão a 80%.
  - O paint do MapLibre não lê `var()`. As cores vêm da paleta ou de `getComputedStyle`.
  - Portar `arcPoints` de `$PROTO/kj-map.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/map/mapLayers.test.ts src/components/legend.test.tsx`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/map/mapLayers.ts frontend/src/map/mapLayers.test.ts frontend/src/components/RouteLegs.tsx frontend/src/components/legend.test.tsx
```

---

### Task 3: Marcadores DOM, rótulos HUD e deslize

**Files:**
- Create: `src/map/markers.ts`, `src/map/markers.test.ts`
- Modify: `src/styles/map.css` (reescrita)

**Interfaces:**
- Produces:
  - `interface SceneMarker { id: string; lat: number; lng: number; kind: "start" | "pickup" | "waypoint" | "dropoff" | "driver" | "order" | "hud" | "pill" | "vehicle"; label?: string; title?: string; dimmed?: boolean; selected?: boolean; next?: boolean; stale?: boolean; status?: "AVAILABLE" | "BUSY" | "OFFLINE"; hud?: { label: string; value: string; warn?: boolean }; pill?: { text: string; estimated?: boolean } }`;
  - `diffMarkers(current: ReadonlyMap<string, SceneMarker>, next: SceneMarker[]): { add: SceneMarker[]; update: SceneMarker[]; remove: string[] }`;
  - `markerClassName(marker: SceneMarker, clickable: boolean): string`;
  - `renderMarker(el: HTMLElement, marker: SceneMarker): void`, que só usa `textContent`, nunca `innerHTML` com dado;
  - `glidePosition(from: [number, number], to: [number, number], t: number): [number, number]` (ease-in-out quadrático);
  - `createMarkerLayer(map: maplibregl.Map, onClick: (id: string) => void): MarkerLayer`, com `MarkerLayer = { apply(list: SceneMarker[]): void; glideTo(id: string, lat: number, lng: number, ms?: number): void; clear(): void }`.

- [ ] **Step 1: Write the failing test**

```ts
describe("markers", () => {
    const m = (id: string, extra: Partial<SceneMarker> = {}): SceneMarker => ({ id, lat: -24.8, lng: -54.3, kind: "driver", ...extra });

    it("diffs markers by id", () => {
        const current = new Map([["a", m("a")], ["b", m("b")]]);
        const d = diffMarkers(current, [m("b", { lat: -24.9 }), m("c")]);
        expect(d.add.map((x) => x.id)).toEqual(["c"]);
        expect(d.update.map((x) => x.id)).toEqual(["b"]);
        expect(d.remove).toEqual(["a"]);
    });

    it("builds class names from state", () => {
        expect(markerClassName(m("a", { kind: "order", stale: true, selected: true }), true)).toBe(
            "maplibregl-marker map-marker map-marker-order is-selected is-stale is-clickable",
        );
        expect(markerClassName(m("s", { kind: "waypoint", dimmed: true, next: false }), false)).toBe(
            "maplibregl-marker map-marker map-marker-waypoint is-dimmed",
        );
    });

    it("renders HUD labels as text, never HTML", () => {
        const el = document.createElement("div");
        renderMarker(el, m("h", { kind: "hud", hud: { label: "Sem sinal", value: "<b>9 min</b>", warn: true } }));
        expect(el.querySelector(".hud-box")?.textContent).toContain("Sem sinal");
        expect(el.querySelector("b")).toBeNull();
        expect(el.querySelector(".hud-stem")).not.toBeNull();
        expect(el.classList.contains("is-warn")).toBe(true);
    });

    it("eases glide positions", () => {
        expect(glidePosition([0, 0], [10, 20], 0)).toEqual([0, 0]);
        expect(glidePosition([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
        expect(glidePosition([0, 0], [10, 20], 1)).toEqual([10, 20]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/map/markers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `markers.ts` and rewrite `map.css`**
  - **Comportamento:**
    - marcadores novos ganham `is-entering`, que sai depois de dois quadros;
    - `glideTo` anima em 600 ms com `glidePosition` e, com movimento reduzido, faz `setLngLat` direto;
    - `apply` atualiza no lugar (a mesma lógica do `MapView` atual).
  - **`map.css`:**
    - classes de marcador de `$PROTO/kj-base.css` (`.dm`, `.dm-driver[data-s]`, `.dm-stop`, `.dm-pickup`, `.dm-dropoff`, `.leg-pill`);
    - de `$PROTO/screens.html`: `.dm-order`, `.hud*`, `.van-pin` e as transições de entrada;
    - os nomes mapeados para `map-marker-*`;
    - o anel do `.map-marker-vehicle` é a única animação infinita no mapa, além do pulso do selecionado.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/map/markers.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/map/markers.ts frontend/src/map/markers.test.ts frontend/src/styles/map.css
```

---

### Task 4: Animações finitas do mapa

**Files:**
- Create: `src/map/mapMotion.ts`, `src/map/mapMotion.test.ts`

**Interfaces:**
- Consumes: `setLegData`, `setArcData`, `setCometData` e `arcPoints` (Task 2); `prefersReducedMotion` (Fase 1).
- Produces:
  - `partialLine(points: [number, number][], progress: number): [number, number][]`;
  - `animateLegs(map: maplibregl.Map, legs: MapLeg[], duration?: number): () => void` (padrão de 1400 ms);
  - `animateArcs(map: maplibregl.Map, arcs: SceneArc[], duration?: number): Promise<void>` (padrão de 900 ms);
  - `cometPositions(paths: [number, number][][], elapsedMs: number, period?: number, cycles?: number): ([number, number] | null)[]` (padrões de 2200 ms e 2);
  - `cometsDone(count: number, elapsedMs: number, period?: number, cycles?: number): boolean`;
  - `startComets(map: maplibregl.Map, arcs: SceneArc[], options?: { period?: number; cycles?: number }): () => void`;
  - `introSpin(map: maplibregl.Map, degrees?: number, duration?: number): () => void` (padrões de 22° e 12000 ms).

- [ ] **Step 1: Write the failing test**

```ts
describe("map motion math", () => {
    const line: [number, number][] = [[0, 0], [0, 10]];

    it("cuts a line by progress", () => {
        expect(partialLine(line, 0)).toEqual([[0, 0]]);
        expect(partialLine(line, 1)).toEqual(line);
        expect(partialLine(line, 0.5)).toEqual([[0, 0], [0, 5]]);
    });

    it("staggers comets by 0.17 of a period and stops after the cycles", () => {
        const paths = [line, line];
        const at = cometPositions(paths, 1100, 2200, 2);
        expect(at[0]).toEqual([0, 5]);
        expect(at[1]).not.toBeNull();
        expect(cometPositions(paths, 200, 2200, 2)[1]).toBeNull();
        expect(cometsDone(2, 2200 * 2.17 + 1, 2200, 2)).toBe(true);
        expect(cometsDone(2, 2200 * 2.17 - 1, 2200, 2)).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/map/mapMotion.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - Portar `animateLegs` e `startComets` de `$PROTO/kj-map.js`, com o limite de passadas já presente lá.
  - `introSpin` usa `map.easeTo({ bearing: map.getBearing() + degrees, duration, easing: (t) => 1 - (1 - t) ** 3, essential: true })` e devolve `() => map.stop()`.
  - Com movimento reduzido:
    - `animateLegs` e `animateArcs` desenham o estado final;
    - `startComets` e `introSpin` não fazem nada e devolvem uma função vazia.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/map/mapMotion.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/map/mapMotion.ts frontend/src/map/mapMotion.test.ts
```

---

### Task 5: Câmera

**Files:**
- Create: `src/map/camera.ts`, `src/map/camera.test.ts`

**Interfaces:**
- Produces:
  - `interface Padding { top: number; bottom: number; left: number; right: number }` e `const ZERO: Padding` (os quatro lados em 0), importado pelos testes de cena das fases seguintes;
  - `interface SceneCamera { fit: "markers" | "legs" | "points" | null; points?: [number, number][]; padding?: Padding; pitch?: number; bearing?: number; maxZoom?: number; terrain?: number; intro?: "spin" | null; follow?: { markerId: string; zoom: number; pitch: number } | null; duration?: number }`;
  - `type CameraMap = Pick<maplibregl.Map, "stop" | "setPadding" | "cameraForBounds" | "flyTo" | "easeTo" | "setTerrain">`;
  - `headingOf(a: [number, number], b: [number, number]): number` (graus, 0 = norte, 90 = leste);
  - `followBearing(position: [number, number], legs: MapLeg[], ahead?: number): number | null` (padrão de 3);
  - `flyToScene(map: CameraMap, points: [number, number][], camera: SceneCamera, reduce: boolean): void`;
  - `applyTerrain(map: CameraMap, exaggeration: number | undefined): void`;
  - `followTo(map: CameraMap, position: [number, number], legs: MapLeg[], follow: NonNullable<SceneCamera["follow"]>, first: boolean, reduce: boolean): void`.

- [ ] **Step 1: Write the failing test**

```ts
function fakeMap() {
    const calls: string[] = [];
    const map = {
        stop: vi.fn(() => calls.push("stop")),
        setPadding: vi.fn(() => calls.push("setPadding")),
        cameraForBounds: vi.fn(() => (calls.push("cameraForBounds"), { center: [-54.2, -24.9], zoom: 9 })),
        flyTo: vi.fn(() => calls.push("flyTo")),
        easeTo: vi.fn(),
        setTerrain: vi.fn(),
    };
    return { map, calls };
}

describe("camera", () => {
    it("measures headings clockwise from north", () => {
        expect(headingOf([0, 0], [1, 0])).toBeCloseTo(0);
        expect(headingOf([0, 0], [0, 1])).toBeCloseTo(90);
    });

    it("points the follow camera at the route ahead", () => {
        const legs: MapLeg[] = [{ kind: "road", points: [[0, 0], [0.001, 0], [0.002, 0], [0.002, 0.001], [0.002, 0.002]] }];
        expect(followBearing([0.002, 0], legs, 2)).toBeCloseTo(90, 0);
        expect(followBearing([0, 0], legs, 1)).toBeCloseTo(0, 0);
        expect(followBearing([0, 0], [], 3)).toBeNull();
    });

    it("stops and resets padding before fitting", () => {
        const { map, calls } = fakeMap();
        flyToScene(map as unknown as CameraMap, [[-24.8, -54.3], [-25.1, -54.1]], { fit: "points", pitch: 0, padding: { top: 120, bottom: 210, left: 580, right: 90 } }, false);
        expect(calls).toEqual(["stop", "setPadding", "cameraForBounds", "flyTo"]);
        expect(map.setPadding).toHaveBeenCalledWith({ top: 0, bottom: 0, left: 0, right: 0 });
    });

    it("skips the flight when the bounds cannot fit and jumps with reduced motion", () => {
        const { map } = fakeMap();
        map.cameraForBounds.mockReturnValueOnce(undefined as never);
        flyToScene(map as unknown as CameraMap, [[0, 0], [1, 1]], { fit: "points" }, false);
        expect(map.flyTo).not.toHaveBeenCalled();
        flyToScene(map as unknown as CameraMap, [[0, 0], [1, 1]], { fit: "points" }, true);
        expect(map.flyTo.mock.calls[0][0]).toMatchObject({ duration: 0 });
    });

    it("turns terrain on and off", () => {
        const { map } = fakeMap();
        applyTerrain(map as unknown as CameraMap, 2.4);
        applyTerrain(map as unknown as CameraMap, 0);
        expect(map.setTerrain).toHaveBeenNthCalledWith(1, { source: "dem", exaggeration: 2.4 });
        expect(map.setTerrain).toHaveBeenNthCalledWith(2, null);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/map/camera.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - `flyToScene` usa `curve: 1.4`, `essential: true`, duração padrão de 1600 ms e `padding: ZERO` no `flyTo`.
  - `followTo`:
    - no primeiro acionamento, faz `flyTo` com `zoom`, `pitch`, `bearing: followBearing(...) ?? 0`, 3400 ms e curva 1,2;
    - nos seguintes, faz `easeTo` de 800 ms com centro e direção.
  - `headingOf` corrige a longitude por `cos(lat)`, como em `$PROTO/screens.html`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/map/camera.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/map/camera.ts frontend/src/map/camera.test.ts
```

---

### Task 6: Motor de cena, `MapStage`, `useMapScene` e `MapView` embutido

**Files:**
- Create:
  - `src/map/maplibre.ts`, com o `setWorkerUrl` uma única vez, saído do `MapView`;
  - `src/map/immersive.ts` e `src/map/immersive.test.ts`;
  - `src/map/sceneStore.ts` e `src/map/sceneStore.test.ts`;
  - `src/map/sceneEngine.ts` e `src/map/sceneEngine.test.ts`;
  - `src/map/MapStage.tsx`;
  - `src/map/useMapScene.ts`;
  - `src/patterns/GlassMapFrame.tsx`.
  - `src/test/sceneMock.ts`.
- Modify: `src/components/MapView.tsx`. Passa a usar `loadStyle`, `ensureLayers`, `setLegData` e `createMarkerLayer`, sem terreno. Mantém props, `MapMarker` e `stopMarkers` exportados.

**Interfaces:**
- Consumes: as Tasks 1–5.
- Produces:
  - `interface MapScene { markers: SceneMarker[]; legs?: MapLeg[]; animateLegs?: boolean; arcs?: SceneArc[]; comets?: number; camera?: SceneCamera; pick?: { hint: string; onPick: (lat: number, lng: number) => void } | null; onMarkerClick?: (id: string) => void }`;
  - `isImmersive(pathname: string, role: Role): boolean`;
  - `publishScene(owner: symbol, scene: MapScene): void`, `clearScene(owner: symbol): void`, `getScene(): { owner: symbol; scene: MapScene } | null` e `subscribeScene(listener: () => void): () => void`;
  - `type FollowState = "following" | "suspended"`, `getFollowState(): FollowState`, `setFollowState(state: FollowState): void`, `subscribeFollow(listener: () => void): () => void` e `useFollowState(): FollowState` (via `useSyncExternalStore`). Um dono novo volta o estado para `"following"`;
  - `createSceneEngine(map: maplibregl.Map, deps: EngineDeps): SceneEngine`, com `SceneEngine = { apply(entry: { owner: symbol; scene: MapScene } | null): void; reapplyAfterStyle(): void; destroy(): void }`. `EngineDeps` injeta `markers`, `layers`, `motion`, `camera` e `reduce`;
  - `useMapScene(scene: MapScene | null): void`;
  - `default function MapStage({ visible }: { visible: boolean }): JSX.Element`;
  - `GlassMapFrame(props: MapViewProps & { className?: string })`.
  - `src/test/sceneMock.ts`, mock compartilhado para os testes de tela: exporta `useMapScene(scene)`, que registra as cenas, mais `lastScene(): MapScene` (falha se nenhuma cena foi publicada), `lastSceneOrNull(): MapScene | null` e `resetScenes()` (chamado no `afterEach`). Uso: `vi.mock("<caminho>/map/useMapScene", () => import("<caminho>/test/sceneMock"))`.

- [ ] **Step 1: Write the failing tests**

`immersive.test.ts`:

```ts
it.each([
    ["/dashboard", true], ["/dashboard/dispatch", true], ["/dashboard/fleet", true], ["/map", true],
    ["/dispatch", true], ["/routes/optimize", true], ["/orders/KJ7Q2M9XAB", true],
    ["/orders", false], ["/orders/new", false], ["/vehicles", false], ["/account", false],
])("staff %s immersive = %s", (path, expected) => {
    expect(isImmersive(path, "ADMIN")).toBe(expected);
});

it("never shows the continuous map to customers", () => {
    expect(isImmersive("/dashboard", "CUSTOMER")).toBe(false);
    expect(isImmersive("/orders/KJ7Q2M9XAB", "CUSTOMER")).toBe(false);
});
```

`sceneStore.test.ts`:

```ts
it("keeps the last published scene and ignores clears from stale owners", () => {
    const a = Symbol("a"), b = Symbol("b");
    publishScene(a, { markers: [] });
    publishScene(b, { markers: [{ id: "x", lat: 0, lng: 0, kind: "driver" }] });
    clearScene(a);
    expect(getScene()?.owner).toBe(b);
    clearScene(b);
    expect(getScene()).toBeNull();
});

it("resets the follow state when a new owner publishes", () => {
    const a = Symbol("a"), b = Symbol("b");
    publishScene(a, { markers: [] });
    setFollowState("suspended");
    publishScene(a, { markers: [] });
    expect(getFollowState()).toBe("suspended");
    publishScene(b, { markers: [] });
    expect(getFollowState()).toBe("following");
});
```

`sceneEngine.test.ts` (dependências como `vi.fn()` e mapa falso com `once`/`on`/`off`, `getCanvasContainer`, `getBearing` e `getStyle`):

```ts
it("stops the previous scene's animations when the owner changes", () => {
    const stopSpin = vi.fn(), stopComets = vi.fn();
    const deps = makeDeps({ introSpin: () => stopSpin, startComets: () => stopComets });
    const engine = createSceneEngine(fakeMap(), deps);
    engine.apply({ owner: Symbol("dash"), scene: { markers: [], camera: { fit: null, intro: "spin" }, arcs: [arc], comets: 2 } });
    deps.fireMoveEnd();
    engine.apply({ owner: Symbol("dispatch"), scene: { markers: [] } });
    expect(stopSpin).toHaveBeenCalled();
    expect(stopComets).toHaveBeenCalled();
});

it("reapplies layers, current data and terrain after a style change", () => {
    const deps = makeDeps();
    const engine = createSceneEngine(fakeMap(), deps);
    const legs: MapLeg[] = [{ kind: "road", points: [[0, 0], [1, 1]] }];
    engine.apply({ owner: Symbol("o"), scene: { markers: [], legs, camera: { fit: null, terrain: 1.3 } } });
    deps.layers.ensure.mockClear(); deps.layers.setLegs.mockClear(); deps.camera.applyTerrain.mockClear();
    engine.reapplyAfterStyle();
    expect(deps.layers.ensure).toHaveBeenCalled();
    expect(deps.layers.setLegs).toHaveBeenCalledWith(expect.anything(), legs);
    expect(deps.camera.applyTerrain).toHaveBeenCalledWith(expect.anything(), 1.3);
});

it("clears markers and data when the scene is removed", () => {
    const deps = makeDeps();
    const engine = createSceneEngine(fakeMap(), deps);
    engine.apply({ owner: Symbol("o"), scene: { markers: [{ id: "a", lat: 0, lng: 0, kind: "driver" }] } });
    engine.apply(null);
    expect(deps.markers.clear).toHaveBeenCalled();
    expect(deps.layers.setLegs).toHaveBeenLastCalledWith(expect.anything(), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/map/immersive.test.ts src/map/sceneStore.test.ts src/map/sceneEngine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - **`sceneEngine.apply`:**
    1. Com dono novo: para tudo o que está registrado, aplica `flyToScene` e o terreno e, no `moveend`, inicia o giro quando `intro === "spin"`.
    2. Com o mesmo dono: aplica só a diferença.
    3. Com `animateLegs` no primeiro conjunto de pernas daquele dono: `animateLegs`.
    4. Com arcos novos: `animateArcs` e depois `startComets` com `comets` passadas.
    5. `follow`: chama `followTo` quando a posição do marcador seguido muda. Um gesto do usuário (`dragstart`, `wheel` ou `pitchstart` com `originalEvent`) chama `setFollowState("suspended")` e para de seguir. O motor assina `subscribeFollow` e, quando o estado volta a `"following"`, chama `followTo` com `first: true`.
    6. `pick`: cursor de mira e aviso.
  - **`MapStage`:**
    - cria o mapa com `maxPitch: 75` e centro `[-54.18, -24.93]`;
    - carrega `loadStyle(theme)`;
    - no `style.load`, chama `engine.reapplyAfterStyle()`;
    - observa `data-theme` e aplica `setStyle(await loadStyle(next), { diff: true })`;
    - assina o `sceneStore`;
    - com `visible=false`, fica com opacidade 0 e blur numa transição de 700 ms e depois `visibility: hidden`.
  - **`useMapScene`:**
    - um dono estável por componente;
    - publica quando a assinatura da cena muda (JSON sem as funções; as funções vão por `ref`);
    - limpa ao desmontar.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/map src/pages src/components`
Expected: PASS. Os testes que mocam `../components/MapView` continuam verdes.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/map frontend/src/patterns/GlassMapFrame.tsx frontend/src/components/MapView.tsx frontend/src/test/sceneMock.ts
```

---

### Task 7: Shell novo (menu lateral, controles, bloco de título, transição)

**Files:**
- Create:
  - `src/layout/Rail.tsx`, `src/layout/ShellControls.tsx`, `src/layout/TitleBlock.tsx`, `src/layout/titleBlockContext.ts` e `src/layout/PageTransition.tsx`;
  - testes `src/layout/rail.test.tsx`, `src/layout/titleBlock.test.tsx` e `src/layout/pageTransition.test.tsx`.
- Modify:
  - `src/layout/Shell.tsx` (reescrita);
  - `src/layout/AlertsBell.tsx` (o botão vira `Glass as="button" variant="clear" press` e o popover fica opaco);
  - `src/styles/layout.css` (reescrita).
- Delete: `src/layout/Sidebar.tsx`, `src/layout/TopBar.tsx`.

**Interfaces:**
- Consumes: `Glass`, `AmbientBackground`, `MapStage`, `isImmersive`, `useConnectionState`, `APP_ROUTES`, `GROUP_ORDER`, `ROLE_LABEL`, `titleFor` e `toggleTheme`.
- Produces:
  - `Rail({ open, onOpenChange, mobileOpen, onMobileClose }: { open: boolean; onOpenChange: (open: boolean) => void; mobileOpen: boolean; onMobileClose: () => void })`;
  - `ShellControls()`;
  - `useTitleBlock(config: { title?: string; eyebrow?: ReactNode; meta?: ReactNode; actions?: ReactNode }): void`. É a única forma de as telas mexerem no título, e o Shell renderiza um `TitleBlock` só;
  - `TitleBlock()`, que lê o contexto, usa `titleFor(pathname)` como padrão e mostra o chip "Tempo real" com `role="status"` e `aria-label={"Tempo real: " + label}`;
  - `PageTransition()`, que substitui o `<Outlet />` e define `data-phase="leaving" | "entering"` no `<main className="stage-content">`.

- [ ] **Step 1: Write the failing tests**

`rail.test.tsx` (sessão simulada por perfil):

```tsx
it("shows only the routes allowed for the role", () => {
    renderRail("DISPATCHER");
    expect(screen.getByRole("link", { name: "Despacho" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Tendência anual" })).toBeNull();
});

it("closes the expanded overlay on Escape and never persists it", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const onOpenChange = vi.fn();
    renderRail("ADMIN", { open: true, onOpenChange });
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(setItem).not.toHaveBeenCalled();
});

it("closes the overlay after navigating", async () => {
    const onOpenChange = vi.fn();
    renderRail("ADMIN", { open: true, onOpenChange });
    await userEvent.click(screen.getByRole("link", { name: "Veículos" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
});
```

`titleBlock.test.tsx`:

```tsx
it("uses the route title and the page meta", () => {
    renderAt("/vehicles", () => useTitleBlock({ meta: "12 veículos" }));
    expect(screen.getByRole("heading", { level: 1, name: "Veículos" })).toBeInTheDocument();
    expect(screen.getByText("12 veículos")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Tempo real: Conectado" })).toBeInTheDocument();
});
```

`pageTransition.test.tsx` (rotas `/a` e `/b` com `Glass`, timers falsos):

```tsx
it("keeps the leaving page for 220 ms before showing the next one", async () => {
    setReducedMotion(false);
    const { navigate } = renderTransition("/a");
    act(() => navigate("/b"));
    expect(screen.getByText("página A")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-phase", "leaving");
    act(() => vi.advanceTimersByTime(220));
    expect(screen.getByText("página B")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-phase", "entering");
});

it("swaps immediately with reduced motion", () => {
    setReducedMotion(true);
    const { navigate } = renderTransition("/a");
    act(() => navigate("/b"));
    expect(screen.getByText("página B")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/layout`
Expected: FAIL nos três arquivos novos.

- [ ] **Step 3: Implement**
  - **`Rail`:**
    - vidro regular, recolhido em 64 px, com selo "KJ", botão de expandir, grupos com divisores e item ativo em pílula;
    - expandido, um flyout opaco de 240 px (`--color-solid-raised`) que fecha ao clicar fora, com Esc ou ao navegar;
    - abaixo de 768 px, drawer opaco;
    - composição de `$PROTO/live-map-v6.html`.
  - **`ShellControls`:** os controles do `TopBar` atual (sino, tema e menu do usuário com iniciais, `username` e perfil), cada um em vidro como na spec §6.3.
  - **`PageTransition`:**
    - usa `useOutlet()` e `useLocation()`;
    - na troca de caminho, mantém o elemento antigo 220 ms com `data-phase="leaving"` e depois troca para `entering`;
    - no `useLayoutEffect`, numera os `.glass` do `main` com `style.setProperty("--i", index)`;
    - o CSS aplica `glass-in` e `glass-out` só em `.glass`, nunca no `main`.
  - **`Shell`:**
    - `AmbientBackground visible={!immersive}` e `MapStage visible={immersive}`, com `immersive = isImmersive(pathname, role)`;
    - o resto: `Rail`, `ShellControls`, `TitleBlock`, `PageTransition` e a barra móvel abaixo de 768 px;
    - mantém a conexão STOMP e os hooks de invalidação de hoje.
  - **`layout.css`:**
    - nas telas não imersivas, título e controles fixos e só a área de conteúdo (`.scroll-area`) rola, sem barra visível;
    - nas imersivas, o conteúdo é posicionado sobre o mapa.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run`
Expected: PASS (inclusive `alertsBell.test.tsx`).

- [ ] **Step 5: Stage**

```bash
git add -A frontend/src/layout frontend/src/styles/layout.css
```

---

### Task 8: Verificação e commit da fase

- [ ] **Step 1: Verificação padrão** (`plan_index.md`)
  - Telas: todas as rotas de um administrador e de um cliente, ainda com o miolo antigo dentro do shell novo.
  - Esperado:
    - mapa recolorido com relevo nas rotas imersivas e fundo ambiente nas demais;
    - troca de tema sem piscar e com o terreno de volta;
    - menu, título, chip "Tempo real" e controles corretos;
    - transição de 220 ms + 900 ms ao navegar.
  - fps: navegar entre `/dashboard` e `/map` e medir durante a transição. Pelo menos 55.

- [ ] **Step 2: Commit the phase**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src
git commit -m "feat(frontend): mapa contínuo com relevo, motor de cena e shell de vidro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão do dono do produto** com as capturas.
