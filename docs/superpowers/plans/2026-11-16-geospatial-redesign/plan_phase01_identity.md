# Fase 1 — Identidade visual e fundações

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a base visual que todas as telas usam: tokens, fontes, vidro líquido, fundo ambiente, movimento, primitivas restilizadas, renders de veículos, padrões compartilhados sem mapa e o novo `docs/DESIGN.md`.

**Spec:** §5.1, §5.2, §5.3, §5.7, §6.4, §6.5, §7.10.2, §9. Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

**Aliases de transição:** o `tokens.css` novo mantém os nomes antigos (`--color-primary`, `--color-surface` etc.) como aliases dos novos. Assim, as telas ainda não refeitas já ganham a paleta nova sem quebrar. A Fase 10 remove os aliases.

---

### Task 0: Base de testes (antes de tudo)

O projeto não tem `@testing-library/jest-dom`, e a regra é não adicionar dependências. Os testes de todas as fases usam um conjunto pequeno de matchers de DOM e helpers de render, definidos aqui uma vez.

**Files:**
- Create:
  - `src/test/setup.ts`, `src/test/matchers.ts` e `src/test/vitest.d.ts` (amplia a interface `Assertion` do Vitest com os matchers);
  - `src/test/render.tsx`;
  - `src/test/motion.ts`;
  - `src/test/testKit.test.tsx`.
- Modify: `vite.config.ts` (`test.setupFiles: ["./src/test/setup.ts"]`).

**Interfaces:**
- Produces:
  - matchers `toBeInTheDocument()`, `toHaveAttribute(name, value?)`, `toHaveClass(...names)`, `toBeDisabled()`, `toBeEnabled()`, `toBeChecked()`, `toHaveValue(value)` e `toHaveAccessibleName(name?)`. O nome acessível usa `aria-label`, depois o texto de `aria-labelledby`, depois `alt` e depois o texto do elemento sem espaços sobrando;
  - `setup.ts` registra os matchers e um `afterEach` com `cleanup()`, `vi.unstubAllGlobals()` e `clearSession()`;
  - `renderAt(path: string, ui: ReactElement, options?: { role?: Role }): RenderResult & { rerenderAt(path: string, ui: ReactElement): void }`. Monta `QueryClientProvider` (`retry: false`) e `MemoryRouter` em `path`, com um observador de localização. Com `role`, chama `startSession({ token: "test", role, expiresAt })` com expiração em uma hora;
  - `currentPath(): string`, com `pathname + search` da última localização observada;
  - `renderHookWithClient<T>(hook: () => T): RenderHookResult<T, unknown>`;
  - `setReducedMotion(matches: boolean): void`, que simula `matchMedia` para `(prefers-reduced-motion: reduce)`.
- Convenção: os testes de tela chamam `setReducedMotion(true)` no `beforeEach`, para os números aparecerem com o valor final.

- [ ] **Step 1: Write the failing test** em `src/test/testKit.test.tsx`

```tsx
it("provides the DOM matchers", () => {
    render(<button aria-label="Tema" className="btn is-on" disabled>x</button>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Tema");
    expect(button).toHaveClass("btn", "is-on");
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName("Tema");
});

it("renders at a path with a session and tracks navigation", async () => {
    renderAt("/a?x=1", <Link to="/b?y=2">ir</Link>, { role: "DISPATCHER" });
    expect(getSession()?.role).toBe("DISPATCHER");
    expect(currentPath()).toBe("/a?x=1");
    await userEvent.click(screen.getByRole("link", { name: "ir" }));
    expect(currentPath()).toBe("/b?y=2");
});

it("simulates reduced motion", () => {
    setReducedMotion(true);
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/test`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implement** os arquivos e o `setupFiles`. Cada matcher devolve `{ pass, message }` no formato do `expect.extend` do Vitest e funciona com `.not`.

- [ ] **Step 4: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: PASS, com os 72 atuais mais os 3 novos. Os `afterEach(cleanup)` dos testes antigos continuam valendo.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/test frontend/vite.config.ts
```

---

### Task 1: Tokens, fontes e base

**Files:**
- Modify: `src/styles/tokens.css` (reescrita), `src/styles/base.css`, `src/main.tsx`, `package.json`, `package-lock.json`
- Create: `src/styles/tokens.test.ts`

**Interfaces:**
- Produces:
  - variáveis CSS `--color-*` (spec §5.1, nomes exatos da tabela), `--color-accent-soft`, `--color-pill-bg`, `--color-pill-ink`;
  - `--font-display`, `--font-ui`, `--font-mono`;
  - `--ease-spring`, `--ease-spring-bouncy`, `--ease-out`;
  - `--radius-panel: 22px` e os tokens de vidro `--glass-*` (os `--lg-*` de `$PROTO/kj-base.css`, renomeados);
  - os tokens de tema extras de `$PROTO/screens.html` com prefixo `--color-`: `--color-hud-line`, `--color-hud-bg`, `--color-dot`, `--color-contour`, `--color-amb-a`, `--color-amb-b`, `--color-spot`, `--color-hero-shadow`.

- [ ] **Step 1: Write the failing test** em `src/styles/tokens.test.ts`

```ts
import { describe, expect, it } from "vitest";
import css from "./tokens.css?raw";

const block = (selector: string) => {
    const start = css.indexOf(selector);
    return css.slice(start, css.indexOf("}", start));
};

describe("design tokens", () => {
    it("defines the forest palette for both themes", () => {
        expect(block('[data-theme="dark"]')).toContain("--color-bg: #0c1511");
        expect(block('[data-theme="light"]')).toContain("--color-bg: #e8ede4");
        expect(block('[data-theme="dark"]')).toContain("--color-route: #b7f52a");
        expect(block('[data-theme="light"]')).toContain("--color-route: #5f9410");
        expect(block('[data-theme="dark"]')).toContain("--color-info: #7cc4e8");
        expect(css).toContain("--color-accent: #b7f52a");
        expect(css).toContain("--color-brand-orange: #ff6a00");
    });

    it("uses the Apple font stacks with Inter as fallback", () => {
        expect(css).toContain(
            '--font-display: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
        );
        expect(css).toContain(
            '--font-ui: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
        );
        expect(css).toContain(
            '--font-mono: "SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        );
    });

    it("keeps legacy aliases pointing at the new tokens", () => {
        expect(css).toContain("--color-primary: var(--color-accent)");
        expect(css).toContain("--color-on-primary: var(--color-accent-ink)");
        expect(css).toContain("--color-background: var(--color-bg)");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/styles/tokens.test.ts`
Expected: FAIL (o `tokens.css` atual não tem `--color-bg`).

- [ ] **Step 3: Rewrite `src/styles/tokens.css`**
  - Os dois temas com todos os valores da tabela da spec §5.1, sob `:root, [data-theme="dark"]` e `[data-theme="light"]`.
  - As molas, copiadas literalmente de `$PROTO/screens.html` (`--spring` vira `--ease-spring` e `--spring-bouncy` vira `--ease-spring-bouncy`). `--ease-out: cubic-bezier(.2,.8,.2,1)`.
  - Bloco de aliases:
    - `--color-background` → `var(--color-bg)`;
    - `--color-surface` e `--color-surface-raised` → `var(--color-solid-raised)`;
    - `--color-surface-muted` → `var(--color-fill)`;
    - `--color-border` → `var(--color-fill-hover)`;
    - `--color-primary` e `--color-primary-hover` → `var(--color-accent)`;
    - `--color-primary-soft` → `var(--color-accent-soft)`;
    - `--color-on-primary` → `var(--color-accent-ink)`.
  - Mantém `--color-scrim`, `--radius-card`, `--radius-control`, `--control-height`, `--motion-fast` e `--motion-base`.

- [ ] **Step 4: Update fonts and base**
  - `src/main.tsx`: importar `@fontsource/inter/{200,300,400,500,600,700}.css` e remover os imports de Montserrat.
  - Rodar `npm uninstall @fontsource/montserrat`.
  - `src/styles/base.css`:
    - `body` com `font-family: var(--font-ui)`, `background: var(--color-bg)`, `color: var(--color-text)`, `font-feature-settings: "tnum" 1` e `letter-spacing: -0.005em`;
    - `h1`–`h3` em `var(--font-display)`;
    - `code`, `.mono` e `.data` em `var(--font-mono)`;
    - foco visível com anel limão de 2 px.

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add frontend/src/styles/tokens.css frontend/src/styles/tokens.test.ts frontend/src/styles/base.css frontend/src/main.tsx frontend/package.json frontend/package-lock.json
```

---

### Task 2: Motor de vidro (funções puras)

**Files:**
- Create: `src/glass/liquidGlass.ts`, `src/glass/liquidGlass.test.ts`

**Interfaces:**
- Produces:
  - `type GlassVariant = "regular" | "clear"`;
  - `interface GlassConfig { bezel?: number; bezelRatio?: number; thickness: number; blur: number; refraction: number; specSaturation: number; specOpacity: number; light: number }`;
  - `const GLASS: Record<GlassVariant, GlassConfig>`;
  - `squircle(x: number): number`;
  - `refractionProfile(bezel: number, thickness: number, samples?: number): { magnitudes: Float32Array; max: number }`;
  - `bezelFor(width: number, height: number, config: GlassConfig): number`;
  - `glassPixels(width: number, height: number, radius: number, bezel: number, magnitudes: Float32Array, lightDeg: number): { displacement: Uint8ClampedArray; specular: Uint8ClampedArray }`;
  - `filterKey(variant: GlassVariant, width: number, height: number, radius: number): string`;
  - `displacementScale(max: number, refraction: number): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { GLASS, bezelFor, displacementScale, filterKey, glassPixels, refractionProfile, squircle } from "./liquidGlass";

describe("liquid glass math", () => {
    it("uses the approved variant parameters", () => {
        expect(GLASS.regular).toMatchObject({ bezel: 26, thickness: 46, blur: 4.5, refraction: 1, specSaturation: 4, specOpacity: 0.85, light: -125 });
        expect(GLASS.clear).toMatchObject({ bezelRatio: 0.42, thickness: 34, blur: 0.6, refraction: 1.15, specSaturation: 5, specOpacity: 0.95, light: -125 });
    });

    it("follows the convex squircle profile", () => {
        expect(squircle(0)).toBe(0);
        expect(squircle(1)).toBe(1);
    });

    it("is zero at the edge and at the inner end, with an interior peak normalized to 1", () => {
        const { magnitudes, max } = refractionProfile(26, 46);
        expect(magnitudes).toHaveLength(128);
        expect(magnitudes[0]).toBeCloseTo(0, 3);
        expect(magnitudes[127]).toBeCloseTo(0, 2);
        const peak = magnitudes.indexOf(Math.max(...magnitudes));
        expect(peak).toBeGreaterThan(0);
        expect(peak).toBeLessThan(127);
        expect(Math.max(...magnitudes)).toBeCloseTo(1, 5);
        expect(max).toBeGreaterThan(0);
    });

    it("sizes the bezel per variant", () => {
        expect(bezelFor(300, 200, GLASS.regular)).toBe(26);
        expect(bezelFor(60, 40, GLASS.regular)).toBe(12);
        expect(bezelFor(44, 44, GLASS.clear)).toBeCloseTo(18.48);
    });

    it("encodes inward displacement and leaves the center neutral", () => {
        const { magnitudes } = refractionProfile(26, 46);
        const w = 100, h = 60;
        const { displacement, specular } = glassPixels(w, h, 20, 26, magnitudes, -125);
        expect(displacement).toHaveLength(w * h * 4);
        const at = (x: number, y: number) => (y * w + x) * 4;
        expect(displacement[at(50, 30)]).toBe(128);
        expect(displacement[at(50, 30) + 1]).toBe(128);
        expect(displacement[at(6, 30)]).toBeGreaterThan(128);
        expect(displacement[at(93, 30)]).toBeLessThan(128);
        expect(specular[at(50, 30) + 3]).toBe(0);
        expect(specular[at(0, 30) + 3]).toBeGreaterThan(0);
    });

    it("builds cache keys and filter scale", () => {
        expect(filterKey("regular", 340, 120, 22.4)).toBe("regular:340x120:22");
        expect(displacementScale(10, 1.15)).toBeCloseTo(23);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/glass/liquidGlass.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement `src/glass/liquidGlass.ts`**

Portar `refractionProfile` e o laço de pixels de `glassMaps` de `$PROTO/kj-glass.js`, sem canvas: o laço escreve direto nos `Uint8ClampedArray`. As regras estão na spec §5.3, itens 5 e 6:
- índice 1,5 e derivada numérica com delta 0,001;
- normalização pelo máximo;
- codificação `128 + v·127`;
- especular com traço de cerca de 1,15 px e brilho de cerca de 5,5 px, a 55% do lado oposto à luz.

`bezelFor` usa `bezelRatio ? min(w,h)·ratio : min(bezel, min(w,h)·0,3)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/glass/liquidGlass.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/glass/liquidGlass.ts frontend/src/glass/liquidGlass.test.ts
```

---

### Task 3: Componente `Glass`, registro de filtros e CSS do vidro

**Files:**
- Create:
  - `src/glass/glassRegistry.ts`;
  - `src/glass/GlassDefs.tsx`;
  - `src/glass/Glass.tsx`;
  - `src/glass/glass.test.tsx`;
  - `src/styles/glass.css`.
- Modify: `src/main.tsx` (import do `glass.css`), `src/App.tsx` (monta `<GlassDefs />` uma vez, ao lado de `<Toasts />`).

**Interfaces:**
- Consumes: tudo de `liquidGlass.ts` (Task 2).
- Produces:
  - `refracts: boolean` e `glassFilter(variant: GlassVariant, width: number, height: number, radius: number): string | null` em `glassRegistry.ts`. Devolve `blur(<blur>px) saturate(1.5) url(#kj-glass-N)`, com cache por `filterKey`, ou `null` fora do Chromium;
  - `mountGlassDefs(svg: SVGSVGElement | null): void`;
  - `GlassContext: React.Context<boolean>`;
  - `default function Glass<T extends ElementType = "div">(props: { as?: T; variant?: GlassVariant; press?: boolean; className?: string; children?: ReactNode } & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">): JSX.Element`;
  - classes CSS `.glass`, `.glass-regular`, `.glass-clear`, `.glass-press` e `.glass-flat`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Glass from "./Glass";

describe("Glass", () => {
    it("renders a regular glass surface by default", () => {
        render(<Glass data-testid="g">conteúdo</Glass>);
        const el = screen.getByTestId("g");
        expect(el).toHaveAttribute("data-glass", "regular");
        expect(el.className).toContain("glass glass-regular");
    });

    it("renders the requested element and variant", () => {
        render(<Glass as="button" variant="clear" press aria-label="Tema" />);
        const el = screen.getByRole("button", { name: "Tema" });
        expect(el).toHaveAttribute("data-glass", "clear");
        expect(el.className).toContain("glass-press");
    });

    it("renders flat when nested and warns in development", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        render(
            <Glass>
                <Glass data-testid="inner">dentro</Glass>
            </Glass>,
        );
        const inner = screen.getByTestId("inner");
        expect(inner).toHaveAttribute("data-glass", "flat");
        expect(inner.className).toContain("glass-flat");
        expect(inner.className).not.toContain("glass-regular");
        expect(warn).toHaveBeenCalledWith("Glass dentro de Glass renderiza chapado");
        warn.mockRestore();
    });

    it("does not set a refraction filter outside Chromium", () => {
        render(<Glass data-testid="g" />);
        expect(screen.getByTestId("g").style.getPropertyValue("--glass-filter")).toBe("");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/glass/glass.test.tsx`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement registry, defs and component**
  - **`glassRegistry.ts`:**
    - converte os `Uint8ClampedArray` em data URL com um `<canvas>`;
    - cria o `<filter>` com a cadeia da spec §5.3, item 4 (portar `filterFor` de `$PROTO/kj-glass.js`) dentro do `<svg>` montado.
  - **`Glass.tsx`:**
    - mede com `ResizeObserver`, agrupado por `requestAnimationFrame` e protegido por `typeof ResizeObserver !== "undefined"`;
    - aplica `style.setProperty("--glass-filter", value)`;
    - o raio vem de `getComputedStyle(el).borderTopLeftRadius`;
    - o brilho do ponteiro escreve `--mx` e `--my` (de `wirePointer`);
    - dentro de `GlassContext`, renderiza chapado e avisa só em `import.meta.env.DEV`.
  - **`glass.css`:**
    - portar `.lg`, `.lg-regular`, `.lg-clear`, `.lg-press`, o contorno de fallback e o brilho do ponteiro de `$PROTO/kj-base.css`, trocando `.lg` por `.glass` e `--lg-*` por `--glass-*`;
    - acrescentar `.glass-flat { background: var(--color-fill); }`;
    - acrescentar `@media (prefers-reduced-transparency: reduce) { .glass { background: var(--color-solid-raised); backdrop-filter: none; } }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/glass`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/glass frontend/src/styles/glass.css frontend/src/main.tsx frontend/src/App.tsx
```

---

### Task 4: Fundo ambiente estático

**Files:**
- Create:
  - `src/layout/contours.ts`;
  - `src/layout/contours.test.ts`;
  - `src/layout/AmbientBackground.tsx`;
  - `src/styles/ambient.css`.
- Modify: `src/main.tsx` (import do CSS).

**Interfaces:**
- Produces:
  - `contourPaths(): string[]`, determinística;
  - `default function AmbientBackground({ visible }: { visible: boolean }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import ambientCss from "../styles/ambient.css?raw";
import { contourPaths } from "./contours";

describe("ambient background", () => {
    it("generates 32 closed topographic rings deterministically", () => {
        const paths = contourPaths();
        expect(paths).toHaveLength(32);
        paths.forEach((d) => {
            expect(d.startsWith("M")).toBe(true);
            expect(d.endsWith("Z")).toBe(true);
        });
        expect(contourPaths()).toEqual(paths);
    });

    it("never animates behind glass", () => {
        expect(ambientCss).not.toMatch(/animation|@keyframes/);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/layout/contours.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - **`contourPaths`:** portar a IIFE `contours()` de `$PROTO/screens.html` (centros `[1180, 260, 1]` e `[320, 820, 0.8]`, 16 anéis, 64 segmentos, mesma fórmula de ondulação).
  - **`AmbientBackground`:** renderiza `<div className="ambient{visible ? " is-on" : ""}" aria-hidden="true">` com o `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">`.
  - **`ambient.css`:** os dois gradientes radiais (`--color-amb-a` e `--color-amb-b`), o traço `--color-contour` e uma transição de opacidade de 800 ms entre visível e oculto. A transição é finita e não fica atrás de vidro em movimento.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/layout/contours.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/layout/contours.ts frontend/src/layout/contours.test.ts frontend/src/layout/AmbientBackground.tsx frontend/src/styles/ambient.css frontend/src/main.tsx
```

---

### Task 5: Movimento (contagem e utilitários CSS)

**Files:**
- Create:
  - `src/motion/reducedMotion.ts`;
  - `src/motion/useCountUp.ts`;
  - `src/motion/useCountUp.test.tsx`;
  - `src/styles/motion.css`.
- Modify: `src/main.tsx`.

**Interfaces:**
- Produces:
  - `prefersReducedMotion(): boolean`;
  - `useCountUp(target: number | null | undefined, options?: { duration?: number; delay?: number; decimals?: number }): string`. O texto sai em pt-BR, com `"—"` para nulo;
  - classes `.motion-rise`, `.motion-grow`, `.motion-pop` e `.motion-drive`, e a variável `--i` (índice de escalonamento);
  - keyframes `glass-in` e `glass-out`, usados pela transição de página da Fase 2.

- [ ] **Step 1: Write the failing test**

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "./useCountUp";

function Probe({ value, decimals }: { value: number | null; decimals?: number }) {
    return <span data-testid="v">{useCountUp(value, { decimals })}</span>;
}


describe("useCountUp", () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance", "setTimeout", "Date"] }));
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("counts from zero to the target", () => {
        setReducedMotion(false);
        render(<Probe value={93} />);
        expect(screen.getByTestId("v").textContent).toBe("0");
        act(() => vi.advanceTimersByTime(1600));
        expect(screen.getByTestId("v").textContent).toBe("93");
    });

    it("shows the final value at once with reduced motion", () => {
        setReducedMotion(true);
        render(<Probe value={606} />);
        expect(screen.getByTestId("v").textContent).toBe("606");
    });

    it("formats decimals in pt-BR and null as a dash", () => {
        setReducedMotion(true);
        const { rerender } = render(<Probe value={15.1} decimals={1} />);
        expect(screen.getByTestId("v").textContent).toBe("15,1");
        rerender(<Probe value={null} />);
        expect(screen.getByTestId("v").textContent).toBe("—");
    });

    it("animates from the previous value when it changes", () => {
        setReducedMotion(false);
        const { rerender } = render(<Probe value={10} />);
        act(() => vi.advanceTimersByTime(1600));
        rerender(<Probe value={20} />);
        act(() => vi.advanceTimersByTime(300));
        const mid = Number(screen.getByTestId("v").textContent);
        expect(mid).toBeGreaterThan(10);
        expect(mid).toBeLessThan(20);
        act(() => vi.advanceTimersByTime(400));
        expect(screen.getByTestId("v").textContent).toBe("20");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/motion`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - **`useCountUp`:**
    - na primeira exibição, conta em 1400 ms (ou em `duration`) com `1 − 2^(−10t)`, depois de `delay`;
    - nas mudanças seguintes, vai do valor antigo ao novo em 600 ms;
    - com movimento reduzido, mostra o valor final na hora.
  - **`motion.css`:**
    - `glass-in`: de opacidade 0, `translateY(22px)`, `scale(.965)` e `blur(10px)` até nada, em 900 ms com `var(--ease-spring)`, `backwards` e atraso `calc(120ms + var(--i, 0) * 70ms)`;
    - `glass-out`: 220 ms com `ease-in`, até 10 px abaixo, `scale(.985)` e `blur(6px)`;
    - `.motion-rise`: 10 px em 800 ms;
    - `.motion-grow`: `scaleX` a partir da esquerda, em 1,1 s;
    - `.motion-pop`: de `scale(.2)` em 700 ms com `var(--ease-spring-bouncy)`;
    - `.motion-drive`: de `translateX(46px)` em 1,2 s;
    - bloco `prefers-reduced-motion` com `animation: none !important` para todos.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/motion`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/motion frontend/src/styles/motion.css frontend/src/main.tsx
```

---

### Task 6: Primitivas restilizadas

**Files:**
- Modify:
  - `src/styles/components.css` (reescrita);
  - `src/components/StatusBadge.tsx` (só markup: ponto antes do rótulo; a API não muda);
  - `src/components/blocks.tsx` (`EmptyState` e `ErrorState` ganham a classe `state-ambient` e a ação em botão primário; `Skeleton` chapado);
  - `src/components/Toasts.tsx` (classes);
  - `src/components/overlays.tsx` (classes do modal opaco).

**Interfaces:**
- Produces, com os nomes de classe atuais preservados para as telas antigas continuarem funcionando:
  - `.btn`, `.btn-primary` (limão, texto `--color-accent-ink`, pílula), `.btn-secondary` e `.btn-ghost` (chapados), `.btn-danger` (tinta de perigo a 14%) e `.btn-icon`;
  - `.field`, `.segmented` (o `seg-flat` do protótipo), `.badge-*` e `.notice-*`;
  - `.popover`, `.panel-modal`, `.panel-drawer` e `.toast`, opacos em `--color-solid-raised`;
  - `.skeleton`, `.state` e `.state-ambient`.
  - `StatusBadge` é o `StatusPill` da spec §7.10.2.

- [ ] **Step 1: Rewrite `components.css` and update the components**

Valores visuais de `$PROTO/screens.html` e `$PROTO/kj-base.css` (`.btn`, `.seg-flat`, `.st`, `.vst`, `.rowline`, `.chip-flat`, `.delta`, `.est-chip`). O `.btn` afunda a 0,93 com mola em `:active`.

- [ ] **Step 2: Run the whole suite**

Run: `cd frontend && npx vitest run`
Expected: PASS. Nenhum teste existente quebra, porque só classes e estilos mudaram.

- [ ] **Step 3: Visual sanity check**

Subir o Vite e capturar `/login` e `/dashboard` (perfil administrador) nos dois temas a 1440 × 900. Esperado: telas antigas legíveis com a paleta nova (botões limão com texto escuro, superfícies opacas sem laranja). Corrigir aliases ou contraste que falhem.

- [ ] **Step 4: Stage**

```bash
git add frontend/src/styles/components.css frontend/src/components/StatusBadge.tsx frontend/src/components/blocks.tsx frontend/src/components/Toasts.tsx frontend/src/components/overlays.tsx
```

---

### Task 7: Renders de veículos

**Files:**
- Create:
  - `public/vehicles/truck-34.webp`, `truck-side.webp`, `van-34.webp` e `van-side.webp`;
  - `src/vehicles/vehicleRender.ts`;
  - `src/vehicles/vehicleRender.test.ts`;
  - `../docs/design/vehicle-studio.html`.
- Modify: `../docs/CREDITS.md`.

**Interfaces:**
- Produces:
  - `type VehicleView = "34" | "side"`;
  - `vehicleRender(type: string | null | undefined, view: VehicleView): { src: string; width: number; height: number } | null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { vehicleRender } from "./vehicleRender";

describe("vehicleRender", () => {
    it("maps trucks and vans by free-text type", () => {
        expect(vehicleRender("Caminhão leve", "side")?.src).toBe("/vehicles/truck-side.webp");
        expect(vehicleRender("truck", "34")?.src).toBe("/vehicles/truck-34.webp");
        expect(vehicleRender("Van", "34")?.src).toBe("/vehicles/van-34.webp");
        expect(vehicleRender("Furgão", "side")?.src).toBe("/vehicles/van-side.webp");
        expect(vehicleRender("Utilitário", "side")?.src).toBe("/vehicles/van-side.webp");
    });

    it("returns null for unknown, empty or missing types", () => {
        expect(vehicleRender("Moto", "side")).toBeNull();
        expect(vehicleRender("", "side")).toBeNull();
        expect(vehicleRender("   ", "34")).toBeNull();
        expect(vehicleRender(null, "34")).toBeNull();
        expect(vehicleRender(undefined, "34")).toBeNull();
    });

    it("declares intrinsic sizes to avoid layout shift", () => {
        expect(vehicleRender("Van", "34")).toMatchObject({ width: 960, height: 541 });
        expect(vehicleRender("Caminhão", "side")).toMatchObject({ width: 900, height: 410 });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/vehicles`
Expected: FAIL.

- [ ] **Step 3: Convert the renders and implement**
  - Para cada `$PROTO/vehicle-*.png`, rodar `cwebp -q 90 -alpha_q 100 "$PROTO/vehicle-<name>.png" -o frontend/public/vehicles/<name>.webp`.
  - Tamanhos: truck-34 960×569, truck-side 900×410, van-34 960×541 e van-side 874×360.
  - Regras de `vehicleRender`: `/caminh|truck/i` → caminhão; `/van|furg|utilit/i` → van. O tipo passa por `trim()` antes.
  - Copiar `$PROTO/vehicle-studio.html` para `docs/design/vehicle-studio.html`, sem mudanças.
  - Acrescentar ao `docs/CREDITS.md` uma seção "Mapa e imagens" com três entradas:
    - OpenFreeMap / OpenStreetMap;
    - Terrain Tiles da AWS (Mapzen, com o link para `https://github.com/tilezen/joerd/blob/master/docs/attribution.md`);
    - renders de veículos próprios, gerados em Three.js com o estúdio de `docs/design`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/vehicles`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/public/vehicles frontend/src/vehicles docs/design/vehicle-studio.html docs/CREDITS.md
```

---

### Task 8: Padrões compartilhados sem mapa

**Files:**
- Create:
  - `src/patterns/HeroNumber.tsx`, `StopTimeline.tsx`, `MiniRoute.tsx`, `DotMatrix.tsx`, `dotScale.ts`, `VehicleCard.tsx` e `SidePanel.tsx`;
  - `src/patterns/patterns.test.tsx`;
  - `src/patterns/dotScale.test.ts`;
  - `src/styles/patterns.css`.
- Modify: `src/main.tsx`.

**Interfaces:**
- Consumes: `useCountUp` (Task 5), `vehicleRender` (Task 7), `Glass` (Task 3), `StatusBadge` e o tipo `RouteStop` de `src/api/types.ts`.
- Produces:
  - `HeroNumber({ label, value, decimals, unit, caption, delta, size }: { label: string; value: number | null; decimals?: number; unit?: string; caption?: ReactNode; delta?: ReactNode; size?: "hero" | "large" | "stat" })`. Tamanhos de §5.2: hero 148 px, large 46 px, stat 34 px;
  - `type TimelineStop = { id: string; kind: "start" | "pickup" | "waypoint" | "dropoff"; label: string; name: string; note?: string; state: "done" | "next" | "todo" }`;
  - `timelineFromRoute(stops: RouteStop[]): TimelineStop[]` e `StopTimeline({ stops, label }: { stops: TimelineStop[]; label?: string })`, uma `<ol>` com `aria-label={label ?? "Paradas"}`;
  - `MiniRoute({ pickup, dropoff, waypoints }: { pickup: string; dropoff: string; waypoints?: number })`;
  - `dotScale(counts: number[], stale: number[], cap?: number): { perDot: number; dots: number[]; staleDots: number[] }`;
  - `DotMatrix({ columns, unit }: { columns: { key: string; label: string; count: number; stale: number; color: string; to?: string }[]; unit: { one: string; many: string } })`;
  - `VehicleCard({ plate, type, status, lastSignal, driver, loading }: { plate: string | null; type?: string | null; status?: string | null; lastSignal?: string | null; driver?: { name: string; status: string } | null; loading?: boolean })`;
  - `SidePanelLayout({ open, panel, children }: { open: boolean; panel: ReactNode; children: ReactNode })` e `SidePanel({ title, onClose, footer, children }: { title: string; onClose: () => void; footer?: ReactNode; children: ReactNode })`.

- [ ] **Step 1: Write the failing tests**

`src/patterns/dotScale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dotScale } from "./dotScale";

describe("dotScale", () => {
    it("uses one dot per order up to the cap", () => {
        expect(dotScale([7, 3, 0], [2, 0, 0])).toEqual({ perDot: 1, dots: [7, 3, 0], staleDots: [2, 0, 0] });
    });

    it("scales every column when one stage exceeds 12", () => {
        expect(dotScale([30, 5, 1], [4, 0, 0])).toEqual({ perDot: 3, dots: [10, 2, 1], staleDots: [2, 0, 0] });
    });

    it("never draws more stale dots than dots", () => {
        expect(dotScale([25], [25]).staleDots[0]).toBe(dotScale([25], [25]).dots[0]);
    });
});
```

`src/patterns/patterns.test.tsx` (com `setReducedMotion(true)` no `beforeEach`):

```tsx
it("HeroNumber shows label, value and unit", () => {
    render(<HeroNumber label="Taxa de sucesso · hoje" value={93} unit="%" />);
    expect(screen.getByText("Taxa de sucesso · hoje")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
    expect(screen.getByText("%").tagName).toBe("SMALL");
});

it("timelineFromRoute marks the first unvisited stop as next", () => {
    const stops = [
        { seq: 0, type: "PICKUP", name: "Armazém", visitedAt: "2026-11-16T13:02:00Z", legKm: null },
        { seq: 1, type: "WAYPOINT", name: "Bom Preço", visitedAt: null, legKm: 1.6 },
        { seq: 2, type: "DROPOFF", name: "CD Medianeira", visitedAt: null, legKm: 29.2 },
    ] as RouteStop[];
    expect(timelineFromRoute(stops).map((s) => [s.label, s.state, s.kind])).toEqual([
        ["R", "done", "pickup"],
        ["1", "next", "waypoint"],
        ["E", "todo", "dropoff"],
    ]);
});

it("StopTimeline renders an ordered list of stops", () => {
    render(<StopTimeline stops={[{ id: "a", kind: "pickup", label: "R", name: "Armazém", state: "done" }]} />);
    expect(screen.getByRole("list", { name: "Paradas" }).tagName).toBe("OL");
});

it("MiniRoute pluralizes the waypoint count", () => {
    const { rerender } = render(<MiniRoute pickup="A" dropoff="B" waypoints={1} />);
    expect(screen.getByText("+1 parada")).toBeInTheDocument();
    rerender(<MiniRoute pickup="A" dropoff="B" waypoints={3} />);
    expect(screen.getByText("+3 paradas")).toBeInTheDocument();
});

it("DotMatrix changes the legend when scaled", () => {
    render(
        <MemoryRouter>
            <DotMatrix unit={{ one: "pedido", many: "pedidos" }} columns={[{ key: "U", label: "Sem motorista", count: 30, stale: 0, color: "var(--color-warning)" }]} />
        </MemoryRouter>,
    );
    expect(screen.getByText("1 ponto = 3 pedidos")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
});

it("VehicleCard shows the render for known types and a fallback otherwise", () => {
    const { rerender } = render(<VehicleCard plate="BRA2E19" type="Van" status="IN_USE" />);
    expect(screen.getByAltText("Van BRA2E19")).toHaveAttribute("src", "/vehicles/van-34.webp");
    rerender(<VehicleCard plate="QQE6A14" type="Moto" status="AVAILABLE" />);
    expect(screen.getByText("Sem imagem para “Moto”")).toBeInTheDocument();
    rerender(<VehicleCard plate={null} />);
    expect(screen.getByText("Sem veículo atribuído")).toBeInTheDocument();
});

it("SidePanel closes with Escape and shifts the layout", async () => {
    const onClose = vi.fn();
    const { container } = render(
        <SidePanelLayout open panel={<SidePanel title="Veículo" onClose={onClose}>x</SidePanel>}>
            <div>lista</div>
        </SidePanelLayout>,
    );
    expect(container.firstElementChild).toHaveClass("has-panel");
    expect(screen.getByRole("dialog", { name: "Veículo" })).toHaveAttribute("aria-modal", "false");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/patterns`
Expected: FAIL.

- [ ] **Step 3: Implement the patterns and `patterns.css`**
  - Composição e valores de `$PROTO/screens.html`:
    - `.hero` e `.stat`: `HeroNumber`;
    - `.vt`: `StopTimeline`;
    - `.mini`: `MiniRoute`;
    - `.matrix` e `.mdots`: `DotMatrix`, com 2 colunas de pontos de 14 px e coluna como `Link` quando `to` existe;
    - `.vehicle-card` e `.shot`: `VehicleCard`, com render 3/4 e classe `motion-drive`;
    - `.vdetail` e `.has-detail`: `SidePanel`, com 450 px e a lista encolhendo com transição `right .55s var(--ease-spring)`.
  - O `SidePanel` é um `Glass as="aside"` com `role="dialog"`, `aria-modal="false"` e `aria-labelledby`. Ele foca o painel ao abrir e devolve o foco ao fechar.
  - Os pontos parados do `DotMatrix` são vazados em `--color-warning`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/patterns`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/patterns frontend/src/styles/patterns.css frontend/src/main.tsx
```

---

### Task 9: Novo DESIGN.md, verificação e commit da fase

**Files:**
- Modify: `../docs/DESIGN.md` (reescrita completa).

- [ ] **Step 1: Rewrite `docs/DESIGN.md`**

Seções:
1. Direção (spec §1 e §1.1–§1.2);
2. Tokens (§5.1);
3. Tipografia (§5.2);
4. Vidro líquido (§5.3, todas as regras, incluindo 11 e 12);
5. Mapa: semântica, recoloração e 3D (§5.4–§5.6);
6. Renders (§5.7);
7. Movimento (§6.5);
8. Padrões compartilhados e critério de pronto (§7.10.1–§7.10.2);
9. Acessibilidade (foco limão, movimento reduzido, transparência reduzida, status com rótulo);
10. Restrições funcionais (o §14 antigo, atualizado conforme a spec §9).

Em português, sem citar a spec como fonte: o DESIGN.md passa a ser o documento vivo.

- [ ] **Step 2: Verificação padrão** (`plan_index.md`)

Telas: `/login` e `/dashboard` (ainda antigas, com tokens novos). Esperado: testes 72 + os novos verdes; build e lint verdes.

- [ ] **Step 3: Commit the phase**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src frontend/public docs/DESIGN.md docs/design docs/CREDITS.md
git commit -m "feat(frontend): fundações do redesign com tokens, vidro líquido, movimento e renders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Revisão do dono do produto** com as capturas (Verificação padrão, item 5).
