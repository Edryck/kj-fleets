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

    U->>C: POST /orders
    C->>S: create(request, usuário)
    alt payload sem pickup ou sem dropoff
        S-->>U: 422 ORDER_PAYLOAD_INCOMPLETE
    else mais de 50 waypoints ou campo inválido
        S-->>U: 400
    else payload válido
        opt usuário é cliente
            S->>S: define o cliente dono como o próprio usuário
        end
        S->>DB: INSERT orders (CREATED) + payload
        S->>DB: INSERT tracking_status (created)
        S-->>U: 201 com publicId e trackingNumber
    end
```

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
    H -- sim --> T["Transação: status = DISPATCHED, dispatchedAt = agora, motorista BUSY, INSERT tracking_status"]
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
    else ok
        S->>DB: UPDATE orders.status
        S->>DB: INSERT tracking_status (status, code, lat, lng)
        opt estado terminal
            S->>DB: UPDATE orders.finishedAt e driver.status = AVAILABLE
        end
        S->>DB: COMMIT
        S->>WS: convertAndSend /topic/orders/id (order.updated)
        S-->>A: 200
    end
```

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
    S->>DB: UPDATE orders SET driver = A, vehicle = veículo de A, status = DISPATCHED WHERE id = X AND driver IS NULL AND status = CREATED
    DB-->>S: 1 linha afetada
    S-->>D1: 200 pedido é seu
    S->>DB: UPDATE orders SET driver = B, vehicle = veículo de B, status = DISPATCHED WHERE id = X AND driver IS NULL AND status = CREATED
    DB-->>S: 0 linhas afetadas
    S-->>D2: 409 ORDER_ALREADY_TAKEN
```

## 9. Atribuir motorista e veículo (antes do despacho)

```mermaid
flowchart TD
    A["POST /orders/id/assign (driverId, vehicleId opcional)"] --> B{"Status = CREATED?"}
    B -- não --> E1["422 ORDER_INVALID_TRANSITION"]
    B -- sim --> C{"Motorista existe e está AVAILABLE?"}
    C -- não --> E2["422 DRIVER_NOT_AVAILABLE"]
    C -- sim --> D{"Motorista sem pedido ativo?"}
    D -- não --> E3["422 DRIVER_HAS_ACTIVE_ORDER"]
    D -- sim --> V{"Veículo informado ou do motorista?"}
    V -- nenhum --> E4["422 ORDER_DISPATCH_REQUIRES_VEHICLE"]
    V -- tem --> F{"Veículo sem pedido ativo?"}
    F -- não --> E5["422 VEHICLE_NOT_AVAILABLE"]
    F -- sim --> G["UPDATE orders: driver e vehicle (status segue CREATED)"]
    G --> OK["200 com pedido atualizado"]
```

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
        S->>DB: INSERT tracking_status (cancelled)
        opt motorista estava BUSY neste pedido
            S->>DB: UPDATE driver.status = AVAILABLE
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
        S->>DB: INSERT tracking_status (pod_registered)
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

## 13. Otimizar a rota de um pedido

```mermaid
sequenceDiagram
    actor Op as Operador (JWT)
    participant C as OrderController
    participant R as RouteService
    participant O as RouteOptimizer
    participant DB as PostgreSQL

    Op->>C: POST /orders/id/route (algorithm e seed opcionais)
    C->>R: optimize(id, algorithm, seed)
    R->>DB: carrega payload e posição do motorista, se houver
    R->>R: monta a matriz de distâncias (Haversine com fator, ou menor caminho no grafo)
    alt modo road sem grafo carregado
        R-->>Op: 422 GRAPH_NOT_LOADED
    else modo road sem caminho entre dois pontos
        R-->>Op: 422 NO_PATH_FOUND
    else HELD_KARP com mais de 15 waypoints
        R-->>Op: 422 ROUTE_TOO_LARGE_FOR_EXACT
    else ok
        R->>O: ordena os waypoints (início no pickup, fim no dropoff)
        O-->>R: ordem e totalKm
        R->>R: calcula baselineKm na ordem de cadastro, savingsPct e ETA
        R->>DB: UPSERT route e route_stop
        R-->>Op: 200 com paradas, totais e economia
    end
    Note over Op,DB: POST /routes/optimize segue o mesmo caminho, mas recebe os pontos no corpo e não grava route nem route_stop
```

## 14. Despacho em lote (plano e aplicação)

```mermaid
sequenceDiagram
    actor Op as Operador (JWT)
    participant D as DispatchController
    participant S as DispatchService
    participant A as AssignmentSolver
    participant DB as PostgreSQL

    Op->>D: POST /dispatch/plan (algorithm, orderIds opcional, apply)
    D->>S: plan(algorithm, orderIds, apply)
    S->>DB: pedidos CREATED sem motorista
    S->>DB: motoristas AVAILABLE com posição, veículo e sem pedido ativo
    S->>S: matriz de custo = distância do motorista até o pickup
    S->>A: resolve com HUNGARIAN ou GREEDY
    A-->>S: pares, sobras e totalKm
    S->>A: resolve também o outro algoritmo para comparar
    opt apply = true
        S->>DB: UPDATE orders (driver e vehicle) em uma transação, revalidando as regras
        alt alguma regra falha
            S-->>Op: 422 com o código da regra violada, nada aplicado
        end
    end
    S-->>Op: 200 com pares, unassigned, totalKm e comparison
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
    B -- sim --> C["Lê o histórico em tracking_status"]
    C --> D{"Tem rota gravada?"}
    D -- sim --> F["Inclui etaMinutes"]
    D -- não --> G["Sem ETA"]
    F --> H["200 com status e linha do tempo, sem dados pessoais nem coordenadas"]
    G --> H
```
