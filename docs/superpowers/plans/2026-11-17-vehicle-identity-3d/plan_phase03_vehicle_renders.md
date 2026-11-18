# Fase 3: modelos de veículos no Blender

**Spec:** `docs/superpowers/specs/2026-11-17-vehicle-identity-3d-design.md`

### Task 1: Gerador e renders

**Files:**
- Create: `docs/design/vehicles/build_vehicles.py`, `frontend/public/renders/<key>-{34,side}{,-paint}.webp` para sprinter, ducato, fiorino, kangoo, delivery, accelo, constellation, atego, cg-cargo, biz
- Delete: `frontend/public/renders/{van,truck}-{34,side}.webp`
- Modify: `frontend/src/vehicles/vehicleRender.ts` (larguras e alturas reais)

- [ ] **Step 1:** `blender -b --factory-startup -P docs/design/vehicles/build_vehicles.py -- --out frontend/public/renders --preview` gera prévias de baixa amostragem; conferir cada uma lado a lado com a silhueta do modelo real.
- [ ] **Step 2:** Rodar sem `--preview`. Expected: 40 arquivos WebP, máscara com o mesmo tamanho do render.
- [ ] **Step 3:** Atualizar a tabela de tamanhos; `npx vitest run src/vehicles` — Expected: PASS.
- [ ] **Step 4:** Conferir no app (garagem, detalhe, mapa ao vivo, motoristas, pedido) nos dois temas, com uma cor escura e uma clara.
