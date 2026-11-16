# Redesign geoespacial imersivo — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer toda a apresentação do frontend do KJ Fleets como uma plataforma geoespacial imersiva com vidro líquido, mapa 3D contínuo e acabamento Apple, sem mudar backend, contratos ou permissões.

**Architecture:** Um mapa MapLibre único (`MapStage`) vive no Shell atrás das telas de operação. Cada tela publica uma cena declarativa (`useMapScene`), e o motor aplica só a diferença, viaja a câmera e roda animações finitas. Por cima, os painéis usam o componente `Glass`, que gera filtros SVG de refração por tamanho de elemento. As telas sem mapa usam o fundo ambiente estático. Toda a lógica de cena, câmera, estilo e vidro fica em funções puras testadas. Os componentes React só montam.

**Tech Stack:** React 18.3, TypeScript 5.9, Vite 6, React Router 7, TanStack Query 5, React Hook Form 7, Recharts 3, MapLibre GL 6.16, OpenFreeMap, Lucide React, CSS puro, Vitest 3 com jsdom e Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-geospatial-redesign-design.md`. Cada tarefa cita as seções que implementa; quem executa lê as duas coisas.

## Fases

Cada fase tem seu próprio arquivo e termina com um commit e a revisão do dono do produto.

| Ordem | Arquivo | Entrega |
|---|---|---|
| 1 | `plan_phase01_identity.md` | Tokens, fontes, motor de vidro, fundo ambiente, movimento, primitivas, renders de veículos, padrões compartilhados, novo DESIGN.md |
| 2 | `plan_phase02_shell_map.md` | Estilo do mapa (relevo, prédios, céu), camadas, marcadores, animações do mapa, câmera, `MapStage`, `useMapScene`, `Rail`, `ShellControls`, `TitleBlock`, transição de página |
| 3 | `plan_phase03_live_map.md` | Dados de verificação e o Mapa ao vivo |
| 4 | `plan_phase04_dispatch.md` | Central de despacho |
| 5 | `plan_phase05_dashboards.md` | Dashboards de administrador, despachante e gestor de frota |
| 6 | `plan_phase06_orders.md` | Lista de pedidos, novo pedido e detalhe do pedido (equipe e cliente) |
| 7 | `plan_phase07_route_lab.md` | Simulador de rota |
| 8 | `plan_phase08_catalogs.md` | Garagem de Veículos e as demais telas de gestão e cadastros |
| 9 | `plan_phase09_customer_entry.md` | Área do cliente, rastreio, login, cadastro e páginas de sistema |
| 10 | `plan_phase10_polish.md` | Responsividade, acessibilidade, desempenho, limpeza dos aliases e documentação |

## Global Constraints

- Nenhuma mudança fora de `frontend/`, `docs/` e `frontend/public/`. Backend, contratos REST e tópicos STOMP intactos.
- Nenhuma dependência nova. Sai `@fontsource/montserrat`; `@fontsource/inter` fica, com os pesos 200, 300, 400, 500, 600 e 700.
- Nenhum comentário em código novo ou reescrito (CLAUDE.md do usuário).
- Nomes de variáveis, funções, componentes e arquivos em inglês. Textos de interface em português.
- Matriz de perfis de `src/routes.ts` e `src/auth/guards.tsx` intacta.
- Só dados que a API devolve. Nada de custo, CO₂, manutenção agendada, documentos, geocodificação, histórico de posição ou posição de motorista para o cliente.
- Semântica do mapa: sólida = ruas, tracejada = estimado, R / número / E, concluída a 45% de opacidade, posição nula = "sem posição".
- Rotas pelas ruas de verdade: toda linha de rota desenhada vem do `path` que a API devolve (GraphHopper, modo `road`). Nenhuma geometria inventada ou suavizada no frontend. Perna sem `path` vira o trecho tracejado "estimado" em linha reta, com o rótulo. Os arcos do despacho não são rotas: são a ligação motorista → retirada do plano e levam a legenda "Atribuição do plano".
- Sem vidro sobre vidro: dentro de `Glass`, tudo chapado. Popover, tooltip, modal, toast e menu expandido opacos (`--color-solid-raised`).
- Nada anima sem parar atrás do vidro. As únicas animações infinitas permitidas são o pulso do marcador selecionado, o anel do veículo seguido e o ponto de "Tempo real".
- Ancestral de vidro não anima (opacidade, `filter`, `transform`, máscara): a animação vai no próprio `.glass`, com `animation-fill-mode: backwards`.
- `prefers-reduced-motion: reduce` desliga animação, contagem e viagem de câmera.
- Desempenho: pelo menos 55 fps no Chrome deste Mac, a 1440 × 900, com uma única aba aberta.
- Testes: os 72 testes atuais continuam passando (atualizados só onde o markup mudou, sem perder asserções de comportamento).
- Formatação: `npm run format` antes de cada commit (`printWidth` 100).
- Um commit por fase, no estilo do repositório (`tipo(escopo): descrição em português`), terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. As tarefas preparam as mudanças com `git add`, e a última tarefa de cada fase faz o commit.
- Branch: `feat/geospatial-redesign`.

## Review Focus

1. **Posição nula ou rota ausente:** motorista com `lat`/`lng` nulos, ou pedido sem rota calculada, não pode quebrar a cena. O motorista some do mapa e mostra "Sem posição" na lista, e a câmera de acompanhamento não liga. Testes: Fase 3, Tarefa 2 (`liveMapScene`); Fase 6, Tarefa 2 (`orderScene` e `shouldFollow`).
2. **Tipo de veículo vazio, nulo ou desconhecido:** `type` é texto livre. `""`, `"Moto"` e `"  "` devolvem `null`, e a interface mostra o ícone com "Sem imagem para “…”", sem imagem quebrada. Testes: Fase 1, Tarefa 7 (`vehicleRender`); Fase 8, Tarefa 1 (cartão sem render).
3. **Troca de tema com uma cena ativa:** depois do `setStyle`, as camadas próprias, as fontes GeoJSON com os dados atuais e o terreno voltam. Teste: Fase 2, Tarefa 6 (`sceneEngine.reapplyAfterStyle` reaplica camadas, dados e terreno; o `MapStage` chama esse método no `style.load`).
4. **Navegar no meio de uma animação** (giro de entrada, voo da câmera de acompanhamento, cometas): a cena antiga para tudo, e a nova enquadra com o padding zerado. Testes: Fase 2, Tarefa 5 (`flyToScene` chama `stop` e `setPadding` antes de `cameraForBounds`); Fase 2, Tarefa 6 (a troca de dono da cena chama os `stop` do giro e dos cometas; a cena removida limpa marcadores e dados).
5. **Contagens grandes:** funil com mais de 12 pedidos numa etapa e fila com mais de 50 itens. A matriz escala ("1 ponto = k pedidos"), e o despacho busca no máximo 50 `GET /orders/:id` por etapa. Testes: Fase 1, Tarefa 8 (`dotScale`); Fase 4, Tarefa 2 (limite de 50).

## Referências locais

- `$PROTO` = `/Volumes/SSD JORGE CAMARGO/Mesa/KJ Fleets/.superpowers/brainstorm/9650-1794846045/content`. A pasta é ignorada pelo Git, então use o caminho absoluto mesmo trabalhando numa worktree.
  - `$PROTO/screens.html`: protótipo v2 (composição, movimento, molas `linear()`, tokens de tema extras);
  - `$PROTO/live-map-v6.html`: Mapa ao vivo;
  - `$PROTO/kj-map.js`: `PALETTES`, `transformStyle`, camadas, `animateLegs`, `startComets`, `arcPoints`;
  - `$PROTO/kj-glass.js`: motor de vidro de referência;
  - `$PROTO/kj-base.css`: CSS do vidro (`.lg*`), tokens `--lg-*` e classes de marcador;
  - `$PROTO/vehicle-studio.html` e `$PROTO/vehicle-*.png`: estúdio e renders.
- Ambiente de desenvolvimento: API em `http://localhost:8081` (`VITE_PROXY_TARGET` no `frontend/.env.local`), Vite em `http://localhost:5173`.
  - A API roda sempre em modo `road`: `ROUTING_MODE=road`, com o extrato em `data/osm/sul-latest.osm.pbf` (README, "Rotas pelas ruas"). Na primeira subida, `JAVA_TOOL_OPTIONS=-Xmx6g` para o import. Depois, o cache em `data/graph-cache` carrega com `-Xmx2g`.
  - Rotas calculadas em modo `haversine` ficam sem `path`. Depois de trocar de modo, use "Recalcular" ou recrie os dados com o script da Fase 3. Os logins de desenvolvimento estão em `VITE_DEV_LOGINS` no `.env.local`. Use os botões de login de desenvolvimento da tela de login e nunca imprima nem faça commit das credenciais.

## Verificação padrão de fase

Toda fase termina com esta rotina, citada como "Verificação padrão". A Fase 1 começa pela Tarefa 0 (base de testes), da qual dependem os testes de todas as fases.

0. Nas fases com rota no mapa, confirmar em `/graph` (logado como administrador) que o modo é `road` e o grafo está carregado. Com grafo descarregado, as rotas saem retas e as capturas não valem.
1. Em `frontend/`, rodar `npm run build`, `npm run lint` e `npx vitest run`. Esperado: os três verdes, com o total de testes igual a 72 mais os testes novos acumulados.
2. Com o Playwright, a 1440 × 900, 1024 × 768 e 390 × 844, nos dois temas, abrir cada tela da fase logado com o perfil certo e salvar as capturas em `.playwright-mcp/phaseNN-<tela>-<tema>-<largura>.png`.
3. Conferir cada tela contra o critério de pronto (spec §7.10.1). Corrigir o que falhar antes de seguir.
4. Nas fases com mapa, medir fps com uma única aba aberta:

   ```js
   await page.evaluate(() => new Promise((done) => { let frames = 0; const start = performance.now(); const tick = () => { frames++; if (performance.now() - start < 3000) requestAnimationFrame(tick); else done(Math.round(frames / ((performance.now() - start) / 1000))); }; requestAnimationFrame(tick); }));
   ```

   Esperado: pelo menos 55 em cada cenário da fase. Abaixo disso, aplicar a ordem de corte da spec (§5.3, regra 13) e avisar o dono do produto antes de qualquer corte visível.
5. Mostrar as capturas ao dono do produto e esperar a aprovação antes da próxima fase.
