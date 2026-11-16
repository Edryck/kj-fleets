# Fase 10 — Refinamento geral

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar responsividade, acessibilidade e desempenho em todas as telas, remover os aliases de transição e o código morto, e atualizar a documentação de telas.

**Spec:** §8, §10, §5.3 (regra 13), §7.10.1, §11 (etapa 10). Global Constraints e Review Focus estão em `plan_index.md`.

Todos os caminhos de código são relativos a `frontend/`.

---

### Task 1: Responsividade das telas imersivas

**Files:**
- Create: `src/map/responsive.ts`, `src/map/responsive.test.ts`, `src/patterns/BottomSheet.tsx`, `src/patterns/bottomSheet.test.tsx`
- Modify:
  - `src/map/sceneEngine.ts` (aplica `adaptCamera` antes da câmera);
  - `src/patterns/SidePanel.tsx` (vira bottom sheet abaixo de 1024 px e tela cheia abaixo de 768 px);
  - `src/styles/layout.css`, `src/styles/dashboard.css`, `src/styles/live-map.css`, `src/styles/dispatch.css`, `src/styles/order.css` e `src/styles/route-lab.css`.

**Interfaces:**
- Produces:
  - `type Viewport = "full" | "compact" | "tablet" | "phone"`, com as faixas ≥ 1280, 1024–1279, 768–1023 e < 768;
  - `viewportFor(width: number): Viewport`;
  - `adaptCamera(camera: SceneCamera, viewport: Viewport): SceneCamera`. No tablet, inclinação no máximo 60. No celular, terreno 0, inclinação no máximo 45 e `intro: null`;
  - `BottomSheet({ snap, onSnapChange, tabs, children }: { snap: "collapsed" | "half" | "full"; onSnapChange: (snap: "collapsed" | "half" | "full") => void; tabs?: { id: string; label: string }[]; children: ReactNode })`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("responsive camera", () => {
    it.each([[1440, "full"], [1100, "compact"], [900, "tablet"], [390, "phone"]] as const)("%i px → %s", (w, v) => {
        expect(viewportFor(w)).toBe(v);
    });

    it("caps pitch on tablets and drops terrain and intro on phones", () => {
        const dash: SceneCamera = { fit: "points", pitch: 73, terrain: 2.4, intro: "spin" };
        expect(adaptCamera(dash, "tablet")).toMatchObject({ pitch: 60, terrain: 2.4, intro: "spin" });
        expect(adaptCamera(dash, "phone")).toMatchObject({ pitch: 45, terrain: 0, intro: null });
        expect(adaptCamera(dash, "full")).toEqual(dash);
    });
});
```

```tsx
it("moves between snap points with the handle and the keyboard", async () => {
    const onSnapChange = vi.fn();
    render(<BottomSheet snap="collapsed" onSnapChange={onSnapChange}>conteúdo</BottomSheet>);
    const handle = screen.getByRole("button", { name: "Expandir painel" });
    await userEvent.click(handle);
    expect(onSnapChange).toHaveBeenCalledWith("half");
    handle.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onSnapChange).toHaveBeenLastCalledWith("half");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/map/responsive.test.ts src/patterns/bottomSheet.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - Regras de §8 nas folhas de estilo de cada tela imersiva:
    - **1024–1279 px:** painel direito com 320 px, blocos inferiores secundários ocultos, barra de comando abaixo do título, `HeroNumber` hero em 112 px.
    - **768–1023 px:** painel direito dentro do `BottomSheet`, menu lateral sempre recolhido.
    - **< 768 px:** mapa em tela cheia, `BottomSheet` com abas (lista, detalhe), controles do mapa à direita acima da folha, alvos de pelo menos 44 px.
  - O motor de cena lê `viewportFor(window.innerWidth)` e reaplica a câmera adaptada no `resize`, com debounce de 200 ms.
  - O arrasto da alça usa Pointer Events. As teclas para cima e para baixo trocam o ponto de parada.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add frontend/src/map frontend/src/patterns frontend/src/styles
```

---

### Task 2: Acessibilidade

**Files:**
- Create: `src/a11y.test.tsx`
- Modify: os componentes que falharem na verificação.

- [ ] **Step 1: Write the failing test**

```tsx
it("every icon-only button in the shell has an accessible name", () => {
    renderShellAs("ADMIN", "/dashboard");
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAccessibleName();
});

it("status pills always carry a text label, never color alone", () => {
    render(<StatusBadge kind="vehicle" value="MAINTENANCE" />);
    expect(screen.getByText("Manutenção")).toBeInTheDocument();
});

it("reduced transparency renders solid surfaces", () => {
    expect(glassCss).toMatch(/prefers-reduced-transparency:\s*reduce[\s\S]*background:\s*var\(--color-solid-raised\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/a11y.test.tsx`
Expected: FAIL onde houver botão sem nome; o resto pode já passar.

- [ ] **Step 3: Fix and audit**
  - Dar nome aos botões que faltarem.
  - Revisar com o Playwright, nos dois temas, com a ferramenta de contraste (`check_contrast`): texto principal e muted sobre `--color-bg` e sobre o vidro com o mapa atrás, ao menos 4,5:1 para texto normal e 3:1 para números grandes.
  - Navegar cada tela só pelo teclado: foco visível limão, ordem lógica, `SidePanel` com foco preso só enquanto aberto, Esc fecha.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add -A frontend/src
```

---

### Task 3: Remoção dos aliases e do código morto

**Files:**
- Modify: `src/styles/tokens.css` (remove o bloco de aliases), `src/styles/tokens.test.ts`, e qualquer CSS ou TSX que ainda use um nome antigo.
- Delete: `Drawer` de `src/components/overlays.tsx` e `KpiCard` de `src/components/blocks.tsx`, se o grep der zero usos. Também as folhas de estilo sem import.

- [ ] **Step 1: Change the test first**

Em `tokens.test.ts`, trocar o caso "keeps legacy aliases" por:

```ts
it("has no legacy aliases left", () => {
    for (const name of ["--color-primary", "--color-surface", "--color-background", "--color-border", "--color-on-primary"]) {
        expect(css).not.toContain(`${name}:`);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/styles/tokens.test.ts`
Expected: FAIL.

- [ ] **Step 3: Remove and replace**

```bash
cd frontend && grep -rnE "var\(--color-(primary|primary-hover|primary-soft|surface|surface-raised|surface-muted|background|border|on-primary)\)" src
```

Expected depois da troca: nenhuma linha. Repetir com `grep -rn "Drawer\b\|KpiCard\|montserrat" src` e remover o que sobrar sem uso.

- [ ] **Step 4: Run tests and build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS e build verde.

- [ ] **Step 5: Stage**

```bash
git add -A frontend/src
```

---

### Task 4: Desempenho final

- [ ] **Step 1: Medir os cinco cenários de §10**, com uma única aba aberta a 1440 × 900 e o snippet da Verificação padrão:
  1. Mapa ao vivo: pan e zoom com todos os painéis;
  2. Dashboard: voo de chegada e giro de entrada;
  3. Detalhe do pedido: câmera de acompanhamento com posições chegando;
  4. Despacho: desenho dos arcos e cometas;
  5. Veículos: rolagem da grade.

  Expected: pelo menos 55 fps em cada um.

- [ ] **Step 2: Se algum cenário ficar abaixo**, aplicar a ordem de corte da spec (§5.3, regra 13), um passo por vez, medindo de novo depois de cada um. Avisar o dono do produto antes de qualquer corte visível.

- [ ] **Step 3: Conferir no Chrome DevTools (Performance)** que nenhuma animação infinita além das três permitidas roda com a tela parada.

- [ ] **Step 4: Stage** o que mudou.

```bash
git add -A frontend/src
```

---

### Task 5: Documentação de telas

**Files:**
- Modify: os arquivos em `../docs/flows/frontend/` cujas telas mudaram de composição (equipe, despacho, cliente e o que mais existir na pasta).

- [ ] **Step 1: Atualizar cada fluxo** para a composição nova: onde cada informação está (painel esquerdo, painel lateral, faixa inferior, cartão), o que abre o `SidePanel`, a câmera de acompanhamento, o "Seguir veículo" e o `?driver=` no Mapa ao vivo. As regras de permissão e de dados do cliente continuam as mesmas, citadas como estão hoje.

- [ ] **Step 2: Conferir o `docs/DESIGN.md`** contra o que foi construído e corrigir o que tiver mudado nas fases 2 a 9.

- [ ] **Step 3: Stage**

```bash
git add docs/flows/frontend docs/DESIGN.md
```

---

### Task 6: Verificação final e commit

- [ ] **Step 1: Verificação padrão completa** em todas as rotas, com todos os perfis, nas três larguras e nos dois temas, conferidas contra §7.10.1. Na passada do cliente, conferir na aba de rede que nenhum dado interno é chamado.

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run format && cd ..
git add -A frontend/src docs
git commit -m "feat(frontend): refinamento do redesign com responsividade, acessibilidade e limpeza

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Revisão final do dono do produto** e, depois dela, `superpowers:finishing-a-development-branch`.
