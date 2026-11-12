# Fluxos — Dashboard

Tópicos (um número ou lista por vez), painéis por perfil, alertas e histórico de status que alimenta os tempos. Índice em [flow-index.md](flow-index.md). Regras e tabelas em [ARCHITECTURE.md](../ARCHITECTURE.md#dashboard).

## 16. Dashboard: tópicos e painéis

```mermaid
flowchart TD
    A["GET /dashboard/... ou /customer/dashboard ou /driver/dashboard"] --> Au{"Autenticado (JWT ou Basic)?"}
    Au -- não --> U["401"]
    Au -- sim --> B{"Papel permitido nesta rota?"}
    B -- não --> E["403"]
    B -- sim --> P{"period e fleetId válidos, quando informados?"}
    P -- não --> V["400 VALIDATION_ERROR, ou 404 se a frota não existe"]
    P -- sim --> W["Calcula from (início do dia no fuso) e to (agora)"]
    W --> C["Consultas agregadas no banco: GROUP BY, FILTER, LATERAL, date_trunc"]
    C --> R{"Perfil CUSTOMER?"}
    R -- sim --> Q["Filtra pelo customer_id e oculta km, economia, ciclo e motorista"]
    R -- não --> D["Monta o DTO com meta (generatedAt, timezone, period, from, to)"]
    Q --> D
    D --> OK["200"]
```

Endpoints sem `period` (funil, fila, status da frota sem `fleetId`, tendência anual, alertas) pulam a validação de período; o painel do motorista usa sempre o dia de hoje.

## 19. Painel por perfil

Cada painel reúne tópicos do mesmo `DashboardService`. A equipe filtra alertas pelo papel do painel, mesmo quando quem chama é ADMIN.

```mermaid
flowchart LR
    Adm["GET /dashboard/admin (ADMIN)"] --> S["DashboardService"]
    Dsp["GET /dashboard/dispatch (ADMIN, DISPATCHER)"] --> S
    Frt["GET /dashboard/fleet (ADMIN, FLEET_MANAGER)"] --> S
    Cli["GET /customer/dashboard (CUSTOMER)"] --> S
    Mot["GET /driver/dashboard (DRIVER, Basic)"] --> S
    S --> Q["DashboardQueries: SQL agregado"]
    S --> AL["AlertService: alertas do papel do painel"]
    Q --> DB[("PostgreSQL")]
    AL --> DB
```

## 20. Alertas

```mermaid
flowchart TD
    A["GET /dashboard/alerts, ou alertas dos painéis dispatch, fleet e admin"] --> B{"Papel com tipos visíveis (ADMIN, DISPATCHER ou FLEET_MANAGER)?"}
    B -- não --> E["403"]
    B -- sim --> C["Conta os alertas de todos os tipos em uma consulta (UNION ALL)"]
    C --> D{"ADMIN?"}
    D -- sim --> F["counts com os 8 tipos, lista só os 3 tipos do ADMIN"]
    D -- não --> G["counts e lista só dos tipos do papel"]
    F --> H["Lista até 100 alertas com severidade, mensagem e ação sugerida"]
    G --> H
    H --> OK["200 com meta, items e counts"]
```

## 21. Histórico de status

Motorista e veículo guardam o histórico em `status_changes`. Os tempos de ocupação do painel de desempenho leem essa tabela.

```mermaid
flowchart TD
    A["Mudança de status de motorista ou veículo: manual, dispatch, finish ou delete"] --> B["StatusHistoryService.record"]
    B --> C{"Status mudou, ou a gravação é forçada (delete)?"}
    C -- não --> X["Não grava nada"]
    C -- sim --> D["Grava em status_changes com changed_by (usuário ou system) e reason"]
    S["Subida da aplicação (ApplicationReadyEvent)"] --> F["Insere linha baseline com o status atual, para quem ainda não tem histórico"]
    F --> D
    D --> E["Painel de desempenho lê os tempos em BUSY e AVAILABLE"]
```
