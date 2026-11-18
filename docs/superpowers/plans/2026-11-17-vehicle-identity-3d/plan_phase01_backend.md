# Fase 1: campos do veículo no backend

**Spec:** `docs/superpowers/specs/2026-11-17-vehicle-identity-3d-design.md`

### Task 1: Campos novos no veículo

**Files:**
- Modify: `src/main/java/br/com/kjfleets/entity/Vehicle.java`, `dto/VehicleDtos.java`, `service/VehicleService.java`
- Test: `src/test/java/br/com/kjfleets/controller/VehicleControllerTest.java`

**Interfaces:**
- Produces: JSON do veículo com `brand`, `model`, `year`, `color`, `capacityKg`, `volumeM3`, `odometerKm` (todos anuláveis).

- [ ] **Step 1: Testes que falham** — `createsVehicleWithIdentityFields` (POST com todos os campos, resposta ecoa os valores aparados), `blankIdentityFieldsBecomeNull`, `rejectsYearTooFarAhead` (ano atual + 2 → 400; ano atual + 1 → 201), `rejectsOutOfRangeCapacity` (capacityKg 0 → 400), `searchMatchesBrandAndModel` (q="fiorino" acha o veículo).
- [ ] **Step 2: Rodar** `./mvnw -q test -Dtest=VehicleControllerTest` — Expected: FAIL nos testes novos.
- [ ] **Step 3: Implementar** colunas (`model_year`, `capacity_kg`, `volume_m3`, `odometer_km`), validação Bean (`@Size`, `@Min`, `@Max`, `@DecimalMin`, `@DecimalMax`) e o teto do ano no serviço (400 `vehicle_year_invalid`), aparo de texto e busca por marca/modelo.
- [ ] **Step 4: Rodar** `./mvnw -q test` — Expected: PASS.
- [ ] **Step 5: Reiniciar a API local** e conferir `GET /vehicles` com os campos.
