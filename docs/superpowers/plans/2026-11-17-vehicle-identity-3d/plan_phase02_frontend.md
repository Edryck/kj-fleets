# Fase 2: catálogo, formulário e exibição

**Spec:** `docs/superpowers/specs/2026-11-17-vehicle-identity-3d-design.md`

### Task 1: Catálogo, render e nome

**Files:**
- Create: `frontend/src/vehicles/catalog.ts`, `frontend/src/vehicles/VehicleRender.tsx`
- Modify: `frontend/src/vehicles/vehicleRender.ts`, `frontend/src/api/types.ts`
- Test: `frontend/src/vehicles/vehicleRender.test.ts`, `frontend/src/vehicles/vehicleRenderView.test.tsx`

**Interfaces:**
- Produces: `VEHICLE_TYPES`, `VEHICLE_MODELS`, `VEHICLE_COLORS`, `findModel(brand, model)`, `colorHex(name)`, `vehicleRender(v: VehicleLike, view): { src, paint, width, height } | null`, `vehicleName(v): string`, `<VehicleRender vehicle view className? alt? />`.

- [ ] **Step 1: Testes que falham** — "Fiat"/"fiorino" → `/renders/fiorino-side.webp`; "mercedes benz"/"Sprinter" → sprinter; marca desconhecida + tipo "Furgão" → fiorino; tipo "Moto" → cg-cargo; tipo "Bicicleta" → null; `vehicleName` com e sem marca/modelo; `VehicleRender` com cor "Vermelho" põe `--paint: #b8312f` e a máscara; sem cor, sem camada de pintura.
- [ ] **Step 2: Rodar** `npx vitest run src/vehicles` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — Expected: PASS.

### Task 2: Formulário, detalhe e coesão nas telas

**Files:**
- Modify: `frontend/src/pages/Vehicles.tsx`, `pages/vehicles/VehicleGarageCard.tsx`, `patterns/VehicleCard.tsx`, `pages/LiveMap.tsx`, `pages/Drivers.tsx`, `pages/drivers/DriverPanel.tsx`, `pages/DriverDetail.tsx`, `pages/order/StaffOrderView.tsx`, estilos
- Test: `frontend/src/pages/vehicles.test.tsx` (ou o teste existente do formulário de veículo)

- [ ] **Step 1: Testes que falham** — o formulário envia os sete campos novos; escolher "Fiorino" ajusta o tipo para Furgão; ano fora da faixa mostra erro; tipo antigo "Utilitário" continua selecionado; o detalhe mostra "Não informado" sem dados; o cartão da garagem mostra "Fiat Fiorino" no lugar do tipo.
- [ ] **Step 2: Rodar** — Expected: FAIL.
- [ ] **Step 3: Implementar** e trocar as chamadas de `vehicleRender(type, …)` por `<VehicleRender vehicle=…>`.
- [ ] **Step 4: Rodar** `npx vitest run` — Expected: PASS.
