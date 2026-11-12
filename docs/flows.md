# Fluxos da KJ Fleets

Diagramas em Mermaid (renderizam no GitHub, no preview de Markdown do IntelliJ e em https://mermaid.live). Nos caminhos, `id` representa o `publicId` do recurso.

## 1. Fluxo geral

```mermaid
flowchart LR
    Cli["Cliente (JWT)"] -->|"REST"| API
    Staff["Admin, Operador e Gestor de frota (JWT)"] -->|"REST"| API
    Drv["Motorista (Basic Auth)"] -->|"REST /driver"| API
    Pub["Qualquer pessoa"] -->|"rastreio público"| API
    subgraph API["Spring Boot API"]
        Core["Pedidos, despacho e cadastros"]
        Rt["Roteirização: TSP, húngaro, Dijkstra e A*"]
        Dash["Dashboard"]
    end
    API --> DB[("PostgreSQL")]
    API -->|"STOMP /ws"| WS["Tópicos WebSocket"]
    WS --> Staff
    WS --> Cli
```

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
    T --> P["Após o commit: publica order.updated"]
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
        S->>WS: convertAndSend /topic/orders/id (order.updated)
        S-->>A: 200
    end
```

O motorista só pede `DRIVER_ENROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED` ou `FAILED`. Quando a equipe avança em nome dele, o `details` registra quem fez (ex.: `por operador1`). `ARRIVED` marca a parada de coleta como visitada, sem checagem de distância. `COMPLETED` marca a de entrega e, para o motorista, só vale dentro do raio do dropoff (ver fluxo 18).

## 6. Ping de localização do motorista

```mermaid
sequenceDiagram
    participant D as Dispositivo do motorista
    participant F as Filtro Basic Auth
    participant C as DriverController
    participant S as DriverService
    participant DB as PostgreSQL
    participant WS as SimpMessagingTemplate

    D->>F: POST /driver/location (Authorization Basic, lat, lng)
    F->>DB: busca usuário DRIVER pelo username
    alt senha inválida, usuário não é motorista ou motorista inativo
        F-->>D: 401
    else autenticado
        F->>C: segue a requisição com o motorista como principal
        C->>S: updateLocation(motorista, lat, lng)
        S->>DB: UPDATE driver (lat, lng, lastSeenAt)
        S->>WS: convertAndSend /topic/drivers/id/location
        S-->>D: 204
    end
```

## 7. Cadastro, login e WebSocket

```mermaid
sequenceDiagram
    actor U as Usuário
    participant A as AuthController
    participant DB as PostgreSQL
    participant I as ChannelInterceptor
    participant B as Broker STOMP

    U->>A: POST /auth/register (username, senha, dados do cliente)
    alt username já existe
        A-->>U: 409 USERNAME_TAKEN
    else ok
        A->>DB: INSERT users (CUSTOMER) + customer
        A-->>U: 201
    end

    U->>A: POST /auth/login (username, senha)
    A->>DB: busca usuário e confere BCrypt
    alt credenciais inválidas, usuário inativo ou role DRIVER
        A-->>U: 401 (mesma resposta para os três casos)
    else ok
        A-->>U: 200 com JWT e role
    end

    U->>I: STOMP CONNECT (header Authorization Bearer)
    I->>I: valida assinatura e expiração
    alt JWT inválido
        I-->>U: conexão recusada
    else JWT válido
        I->>B: libera a sessão
        U->>I: SUBSCRIBE /topic/orders/id
        alt cliente assinando pedido de outra pessoa
            I-->>U: assinatura recusada
        else equipe ou dono do pedido
            I->>B: libera a assinatura
            B-->>U: eventos order.updated
        end
    end
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
        S->>WS: convertAndSend /topic/orders/id (order.updated)
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

## 12. Motoristas mais próximos

```mermaid
flowchart LR
    A["GET /drivers/nearest (lat, lng, limit)"] --> B["SELECT motoristas AVAILABLE com lat e lng preenchidos"]
    B --> C["Calcula Haversine até o ponto"]
    C --> D["Ordena por distância e aplica limit (padrão 5, máximo 20)"]
    D --> E["200 com lista e distanceKm"]
```

## 13. Calcular a rota de um pedido

```mermaid
sequenceDiagram
    actor Op as Operador (JWT)
    participant C as RouteController
    participant R as RouteService
    participant O as RouteOptimizer
    participant DB as PostgreSQL

    Op->>C: POST /orders/id/route (algorithm e seed opcionais)
    C->>R: computeManual(id, algorithm, seed)
    R->>DB: trava o pedido e lê a rota gravada, se houver
    alt pedido terminal
        R-->>Op: 422 ORDER_INVALID_TRANSITION
    else ok
        R->>R: paradas concluídas ficam no início, com as pernas originais
        R->>R: START é a posição do motorista, se houver
        R->>R: só os waypoints pendentes entram na reordenação
        R->>DB: matriz de distâncias (Haversine com fator, ou grafo no modo road)
        alt modo road sem grafo carregado
            R-->>Op: 422 GRAPH_NOT_LOADED
        else HELD_KARP com mais de 15 waypoints
            R-->>Op: 422 ROUTE_TOO_LARGE_FOR_EXACT
        else ok
            R->>O: ordena os waypoints (padrão: HELD_KARP até 15, senão TWO_OPT)
            O-->>R: ordem
            R->>R: totalKm, baselineKm na ordem de cadastro, savingsPct e etaMinutes
            R->>DB: apaga a rota anterior e grava route e route_stops
            R-->>Op: 200 com paradas, totais e ETA vivo
        end
    end
    Note over R,DB: No despacho e no aceite a mesma rotina roda sozinha. Se falhar, o pedido segue e grava route_failed no histórico.
    Note over Op,DB: POST /routes/optimize usa o mesmo cálculo, mas recebe os pontos no corpo e não grava nada. Com compare = true roda os quatro algoritmos.
```

## 14. Despacho em lote (plano e aplicação)

```mermaid
sequenceDiagram
    actor Op as Operador (JWT)
    participant D as DispatchController
    participant S as DispatchService
    participant A as AssignmentSolver
    participant OS as OrderService
    participant DB as PostgreSQL

    Op->>D: POST /dispatch/plan (algorithm, orderIds opcional, apply)
    D->>S: plan(request)
    S->>DB: pedidos CREATED sem motorista (ou os de orderIds, que têm que estar nesse critério)
    S->>DB: motoristas AVAILABLE, ativos, com posição recente, veículo ativo fora de MAINTENANCE e sem pedido ativo
    S->>S: matriz de custo = distância do motorista até o pickup
    S->>A: resolve com HUNGARIAN ou GREEDY, e também com o outro para comparison
    A-->>S: pares, sobras e totalKm
    alt apply = true
        S->>DB: trava pedidos, motoristas e veículos, nessa ordem
        loop cada par
            S->>OS: assign (mesmas validações e travas do assign)
        end
        alt algum par falha
            S-->>Op: 422 com o código da regra, nada gravado
        else todos atribuídos
            S-->>Op: 200 com pares, unassigned, totalKm e comparison
        end
    else apply = false
        S-->>Op: 200 com pares, unassigned, totalKm e comparison
    end
    Note over S,DB: apply = true só atribui. O despacho continua sendo uma ação por pedido.
```

## 15. Menor caminho no grafo viário e importação

```mermaid
flowchart TD
    A["GET /graph/shortest-path (fromLat, fromLng, toLat, toLng, algorithm)"] --> B{"Grafo carregado?"}
    B -- não --> E1["422 GRAPH_NOT_LOADED"]
    B -- sim --> C["Encontra o nó mais próximo da origem e do destino"]
    C --> D{"Algoritmo"}
    D -- DIJKSTRA --> F1["Dijkstra com fila de prioridade"]
    D -- ASTAR --> F2["A estrela com heurística Haversine"]
    F1 --> G{"Achou caminho?"}
    F2 --> G
    G -- não --> E2["422 NO_PATH_FOUND"]
    G -- sim --> OK["200 com nós do caminho, km, nodesExpanded e ms"]

    I["POST /graph/import"] --> J{"CSVs existem e são válidos?"}
    J -- não --> E3["422 GRAPH_IMPORT_FAILED"]
    J -- sim --> K["Limpa road_edge e road_node e grava em lote"]
    K --> L["Monta as listas de adjacência em memória"]
    L --> M["200 com quantidade de nós e arestas"]
```

## 16. Dashboard

```mermaid
flowchart TD
    A["GET /dashboard/summary, GET /dashboard/orders-timeseries, GET /dashboard/drivers-performance, GET /dashboard/routing-savings ou GET /dashboard/live"] --> B{"Perfil ADMIN, DISPATCHER ou FLEET_MANAGER?"}
    B -- não --> E["403"]
    B -- sim --> C["Consultas agregadas no banco: GROUP BY status, date_trunc por dia, médias por motorista"]
    C --> D["Monta o DTO de resposta"]
    D --> OK["200"]
```

## 17. Rastreio público

```mermaid
flowchart TD
    A["GET /track/{trackingNumber}"] --> B{"Pedido com esse código existe?"}
    B -- não --> E["404"]
    B -- sim --> C["Lê o histórico em tracking_statuses"]
    C --> X["Remove eventos assigned, unassigned, stop_completed e route_failed, details, reason e coordenadas"]
    X --> H["200 com status, linha do tempo e etaMinutes vivo (null sem rota ou em pedido terminal)"]
```

## 18. Concluir parada

```mermaid
flowchart TD
    A["POST /orders/id/stops/seq/complete (equipe) ou POST /driver/orders/id/stops/seq/complete (motorista, lat e lng opcionais)"] --> A1{"Se for motorista, é o dono do pedido?"}
    A1 -- não --> E0["404, como em todo /driver"]
    A1 -- sim --> B{"Pedido ativo, de DISPATCHED a IN_PROGRESS?"}
    B -- não --> E1["422 ORDER_INVALID_TRANSITION"]
    B -- sim --> C{"Pedido tem rota?"}
    C -- não --> E2["404 ROUTE_NOT_FOUND"]
    C -- sim --> D{"Parada existe e é WAYPOINT?"}
    D -- não existe --> E3["404"]
    D -- START, PICKUP ou DROPOFF --> E4["422 ORDER_INVALID_TRANSITION"]
    D -- sim --> F{"Parada já concluída?"}
    F -- sim --> OK0["200 sem mudar nada"]
    F -- não --> G{"Quem chama?"}
    G -- equipe --> H["Grava visitedAt, completedBy e distanceM se houver posição, e stop_completed no histórico"]
    G -- motorista --> I{"Posição do corpo, ou a gravada com idade até ROUTING_POSITION_MAX_AGE_S?"}
    I -- não --> E5["422 STOP_TOO_FAR, sem posição recente"]
    I -- sim --> J{"Distância em linha reta até a parada até ROUTING_ARRIVAL_RADIUS_M?"}
    J -- não --> E6["422 STOP_TOO_FAR com a distância"]
    J -- sim --> K["Se veio posição no corpo, atualiza a posição do motorista"]
    K --> H
    H --> OK["200 com a rota e o ETA vivo"]
```

`ARRIVED` marca o `PICKUP` e `COMPLETED` marca o `DROPOFF`, pelo fluxo 5. O `COMPLETED` do motorista usa a mesma checagem de raio, mas contra o dropoff, com ou sem rota calculada.
