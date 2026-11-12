# Fluxos — Pedidos

Ciclo de vida do pedido: criar, atribuir, despachar, avançar, cancelar, POD e aceite ad hoc. Índice em [flow-index.md](flow-index.md).

## 2. Ciclo de vida do pedido

```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> DISPATCHED: dispatch
    CREATED --> CANCELLED: cancel
    DISPATCHED --> DRIVER_ENROUTE: activity
    DISPATCHED --> CANCELLED: cancel
    DRIVER_ENROUTE --> ARRIVED: activity
    DRIVER_ENROUTE --> CANCELLED: cancel
    ARRIVED --> IN_PROGRESS: activity
    ARRIVED --> CANCELLED: cancel
    IN_PROGRESS --> COMPLETED: activity
    IN_PROGRESS --> FAILED: activity
    COMPLETED --> [*]
    CANCELLED --> [*]
    FAILED --> [*]
```

## 3. Criar pedido (equipe ou cliente)

```mermaid
sequenceDiagram
    actor U as Operador ou Cliente (JWT)
    participant C as OrderController
    participant S as OrderService
    participant DB as PostgreSQL

    U->>C: POST /orders (pickup, dropoff, waypoints com placeId ou lugar novo, customerId opcional)
    C->>S: create(request, usuário)
    alt payload sem pickup ou sem dropoff
        S-->>U: 422 ORDER_PAYLOAD_INCOMPLETE
    else mais de 50 waypoints, ponto com placeId e lugar novo juntos (ou nenhum), ou campo inválido
        S-->>U: 400
    else placeId ou customerId inexistente ou inativo
        S-->>U: 404
    else payload válido
        S->>DB: INSERT place para cada lugar novo
        alt usuário é cliente
            S->>S: dono = o próprio cliente (customerId do corpo é ignorado)
        else equipe com customerId
            S->>S: dono = esse cliente
        else equipe sem customerId
            S->>S: pedido sem dono (só a equipe vê)
        end
        S->>DB: INSERT orders (CREATED) + payload
        S->>DB: INSERT tracking_status (status CREATED, code created)
        S-->>U: 201 com publicId e trackingNumber
    end
```

Lugares criados no pedido viram `Place` comum e aparecem em `GET /places`. A equipe acha o `customerId` em `GET /customers` (só leitura).

### Códigos do histórico (`tracking_status.code`)

`status` é o estado do pedido depois do evento (enum em maiúsculas). `code` é o evento, em minúsculas: `created`, `assigned`, `dispatched`, `driver_enroute`, `arrived`, `in_progress`, `pod_registered`, `completed`, `failed`, `cancelled`, `unassigned`, `stop_completed` e `route_failed` (roteirização). `assigned`, `unassigned`, `pod_registered`, `stop_completed` e `route_failed` não mudam o status. `route_failed` traz o código da falha em `details`. `unassigned` aparece quando um motorista ou veículo é desativado e solto de pedidos `CREATED`. O `code` do corpo de `activity` é outra coisa: o estado de destino pedido, em maiúsculas (`"code": "ARRIVED"`).

## 9. Atribuir motorista e veículo (antes do despacho)

```mermaid
flowchart TD
    A["POST /orders/id/assign (driverId, vehicleId opcional)"] --> B{"Status = CREATED?"}
    B -- não --> E1["422 ORDER_INVALID_TRANSITION"]
    B -- sim --> C{"Motorista ativo e AVAILABLE?"}
    C -- não --> E2["422 DRIVER_NOT_AVAILABLE"]
    C -- sim --> D{"Motorista sem pedido ativo?"}
    D -- não --> E3["422 DRIVER_HAS_ACTIVE_ORDER"]
    D -- sim --> V{"Veículo informado ou do motorista?"}
    V -- nenhum --> E4["422 ORDER_DISPATCH_REQUIRES_VEHICLE"]
    V -- tem --> F{"Veículo ativo, fora de MAINTENANCE e sem pedido ativo?"}
    F -- não --> E5["422 VEHICLE_NOT_AVAILABLE"]
    F -- sim --> G["UPDATE orders: driver e vehicle (status segue CREATED) e INSERT tracking_status (code assigned)"]
    G --> OK["200 com pedido atualizado"]
```

Atribuir não ocupa o motorista: o mesmo motorista pode estar em vários pedidos `CREATED` (fila). Só o despacho o torna `BUSY`; enquanto ele estiver ocupado, despachar ou atribuir outro pedido a ele responde 422 `DRIVER_NOT_AVAILABLE`. Um novo `assign` em `CREATED` substitui o anterior.

## 4. Despachar pedido (validações)

```mermaid
flowchart TD
    A["POST /orders/id/dispatch"] --> B{"Pedido existe?"}
    B -- não --> E404["404"]
    B -- sim --> C{"Status = CREATED?"}
    C -- não --> E1["422 ORDER_INVALID_TRANSITION"]
    C -- sim --> D{"Tem motorista?"}
    D -- não --> E2["422 ORDER_DISPATCH_REQUIRES_DRIVER"]
    D -- sim --> F{"Tem veículo?"}
    F -- não --> E3["422 ORDER_DISPATCH_REQUIRES_VEHICLE"]
    F -- sim --> G{"Motorista AVAILABLE?"}
    G -- não --> E4["422 DRIVER_NOT_AVAILABLE"]
    G -- sim --> H{"Motorista sem outro pedido ativo?"}
    H -- não --> E5["422 DRIVER_HAS_ACTIVE_ORDER"]
    H -- sim --> M{"Veículo ativo, fora de MAINTENANCE e sem pedido ativo?"}
    M -- não --> E6["422 VEHICLE_NOT_AVAILABLE"]
    M -- sim --> T["Transação: status = DISPATCHED, dispatchedAt = agora, motorista BUSY, veículo IN_USE, INSERT tracking_status (code dispatched)"]
    T --> P["Após o commit: publica em /topic/orders e /topic/orders/id (fluxo 23)"]
    P --> OK["200 com pedido atualizado"]
```

## 5. Avançar o fluxo (activity)

```mermaid
sequenceDiagram
    actor A as Operador (JWT) ou Motorista (Basic)
    participant C as Controller
    participant S as OrderService
    participant DB as PostgreSQL
    participant WS as SimpMessagingTemplate

    A->>C: POST /orders/id/activity ou POST /driver/orders/id/activity (code, lat, lng, reason)
    C->>S: advance(id, code, lat, lng, reason, ator)
    S->>DB: SELECT pedido
    alt ator é motorista e o pedido não é dele
        S-->>A: 404
    else transição inválida
        S-->>A: 422 ORDER_INVALID_TRANSITION
    else code = FAILED sem reason
        S-->>A: 400
    else próximo = COMPLETED e podRequired sem prova
        S-->>A: 422 ORDER_POD_REQUIRED
    else ator é motorista e próximo = COMPLETED fora do raio do dropoff
        S-->>A: 422 STOP_TOO_FAR
    else ok
        S->>DB: UPDATE orders.status
        S->>DB: INSERT tracking_status (status novo, code do evento em minúsculas, lat, lng)
        opt próximo = ARRIVED ou COMPLETED
            S->>DB: marca a parada PICKUP ou DROPOFF como visitada
        end
        opt ator é motorista e veio lat e lng
            S->>DB: UPDATE driver (lat, lng, lastSeenAt)
        end
        opt estado terminal
            S->>DB: UPDATE orders.finishedAt, driver.status = AVAILABLE e vehicle.status = AVAILABLE
        end
        S->>DB: COMMIT
        S->>WS: publica /topic/orders e /topic/orders/id, depois do commit (fluxo 23)
        S-->>A: 200
    end
```

O motorista só pede `DRIVER_ENROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED` ou `FAILED`. Quando a equipe avança em nome dele, o `details` registra quem fez (ex.: `por operador1`). `ARRIVED` marca a parada de coleta como visitada, sem checagem de distância. `COMPLETED` marca a de entrega e, para o motorista, só vale dentro do raio do dropoff (ver fluxo 18).

## 10. Cancelar pedido

```mermaid
sequenceDiagram
    actor A as Operador ou Cliente (JWT)
    participant S as OrderService
    participant DB as PostgreSQL
    participant WS as SimpMessagingTemplate

    A->>S: POST /orders/id/cancel (reason)
    alt cliente cancelando pedido de outra pessoa
        S-->>A: 404
    else reason vazio
        S-->>A: 400
    else status depois de ARRIVED, já terminal, ou cliente fora de CREATED
        S-->>A: 422 ORDER_INVALID_TRANSITION
    else ok
        S->>DB: UPDATE orders.status = CANCELLED, reason, finishedAt
        S->>DB: INSERT tracking_status (status CANCELLED, code cancelled, details = reason)
        opt pedido já despachado (motorista BUSY neste pedido)
            S->>DB: UPDATE driver.status = AVAILABLE e vehicle.status = AVAILABLE
        end
        S->>DB: COMMIT
        S->>WS: publica /topic/orders e /topic/orders/id, depois do commit (fluxo 23)
        S-->>A: 200
    end
```

## 11. Registrar prova de entrega (POD)

```mermaid
sequenceDiagram
    actor A as Operador (JWT) ou Motorista (Basic)
    participant S as OrderService
    participant DB as PostgreSQL

    A->>S: POST /orders/id/pod ou POST /driver/orders/id/pod (value)
    alt motorista com pedido que não é dele
        S-->>A: 404
    else value vazio
        S-->>A: 400
    else status diferente de IN_PROGRESS
        S-->>A: 422 ORDER_INVALID_TRANSITION
    else ok
        S->>DB: UPDATE orders (podValue, podAt)
        S->>DB: INSERT tracking_status (status IN_PROGRESS, code pod_registered, details = value)
        S-->>A: 200
    end
    Note over A,DB: Depois disso o activity para COMPLETED passa na regra de POD
```

## 8. Aceite ad hoc concorrente (diferencial opcional)

```mermaid
sequenceDiagram
    participant D1 as Motorista A
    participant D2 as Motorista B
    participant S as OrderService
    participant DB as PostgreSQL

    par aceites quase simultâneos
        D1->>S: POST /driver/orders/id/accept
        D2->>S: POST /driver/orders/id/accept
    end
    S->>DB: trava o pedido (SELECT FOR UPDATE)
    alt pedido não existe
        S-->>D2: 404
    else pedido já tem motorista (o outro aceite venceu)
        S-->>D2: 409 ORDER_ALREADY_TAKEN
    else pedido fora de CREATED
        S-->>D2: 422 ORDER_INVALID_TRANSITION
    else ok
        S->>DB: trava o motorista e depois o veículo dele
        S->>S: validações do assign (ativo, AVAILABLE, sem pedido ativo, veículo fora de MAINTENANCE)
        S->>DB: UPDATE orders (driver, vehicle, DISPATCHED, dispatchedAt), motorista BUSY, veículo IN_USE
        S->>DB: INSERT tracking_status (assigned e dispatched)
        S-->>D1: 200 pedido é seu
    end
```

Só um aceite leva o pedido: quem chega depois encontra o motorista gravado e recebe 409. A trava segue a ordem fixa do sistema (pedido, motorista, veículo).
