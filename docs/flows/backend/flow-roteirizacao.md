# Fluxos — Roteirização

Rota do pedido, conclusão de paradas, despacho em lote e grafo viário. Índice em [flow-index.md](flow-index.md).

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
