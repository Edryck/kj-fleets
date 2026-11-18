# Fase 4: figuras das pessoas

**Spec:** `docs/superpowers/specs/2026-11-17-vehicle-identity-3d-design.md`

### Task 1: Gerador, figuras e lugares

**Files:**
- Create: `docs/design/people/build_people.py`, `frontend/public/people/{admin,dispatcher,fleet-manager,driver,customer}{,-bust}.webp`, `frontend/src/people/personFigure.ts`, `frontend/src/people/PersonFigure.tsx`
- Modify: painéis de motorista, cliente e usuário, `pages/Account.tsx`, `pages/Drivers.tsx`, chip do usuário
- Test: `frontend/src/people/personFigure.test.ts`

- [ ] **Step 1: Teste que falha** — `personFigure("DRIVER", "bust")` → `/people/driver-bust.webp`; papel desconhecido → null; `<PersonFigure role>` com `alt=""` e iniciais de reserva.
- [ ] **Step 2:** Gerar as figuras no Blender e conferir.
- [ ] **Step 3: Implementar** e colocar nos lugares da spec.
- [ ] **Step 4: Rodar** `npx vitest run` — Expected: PASS; conferir no app.
