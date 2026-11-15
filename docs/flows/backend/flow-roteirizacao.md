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
        R->>DB: matriz simétrica (Haversine com fator, ou GraphHopper no modo road)
        Note over R: no modo road, cada par sem caminho pelas ruas cai para linha reta e fica marcado HAVERSINE
        alt HELD_KARP com mais de 15 waypoints
            R-->>Op: 422 ROUTE_TOO_LARGE_FOR_EXACT
        else ok
            R->>O: ordena os waypoints (padrão: HELD_KARP até 15, senão TWO_OPT)
            O-->>R: ordem
            R->>R: totalKm, baselineKm na ordem de cadastro, savingsPct e etaMinutes
            R->>DB: apaga a rota anterior e grava route e route_stops, com distance_source por perna
            R-->>Op: 200 com paradas, totais, fallbackLegs e ETA vivo
        end
    end
    Note over R,DB: No despacho e no aceite a mesma rotina roda sozinha. Se falhar por regra, o pedido segue e grava route_failed no histórico.
    Note over Op,DB: POST /routes/optimize usa o mesmo cálculo, mas recebe os pontos no corpo e não grava nada. Com compare = true roda os quatro algoritmos.
```

Decisão de cada perna no modo `road`. A perna nunca falha: ou vem das ruas, ou cai para linha reta e é contada em `fallbackLegs`. Um waypoint fora do grafo gera 2 pernas de fallback (a que chega e a que sai).

```mermaid
flowchart TD
    A["Perna de A para B (modo road)"] --> B{"Grafo carregado?"}
    B -- não --> F["Linha reta × desvio, distance_source = HAVERSINE"]
    B -- sim --> C{"A e B estão a até 500 m de uma via para carro?"}
    C -- não --> F
    C -- sim --> D{"Há caminho para carro entre A e B?"}
    D -- não --> F
    D -- sim --> R["Distância pelas ruas, distance_source = ROAD"]
    R --> P{"Leitura da rota com o grafo carregado?"}
    P -- sim --> PATH["path com os pontos da rota"]
    P -- não --> NP["path nulo, o front desenha tracejado"]
    F --> FB["Conta em fallbackLegs"]
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

## 15. Grafo viário: status, importação e rota ponto a ponto

Só `road` tem dados. Os três fluxos abaixo são de staff (ADMIN, DISPATCHER, FLEET_MANAGER).

```mermaid
flowchart TD
    A["Subida da API no modo road"] --> T["Thread graph-import, em segundo plano"]
    T --> C{"Cache em ROUTING_GRAPH_DIR?"}
    C -- sim --> L1["Carrega o cache (cerca de 2,7 s medido)"]
    C -- não --> L2["Importa ROUTING_OSM_FILE e grava o cache (cerca de 350 s medido)"]
    L1 --> OK["loaded = true, reason = null"]
    L2 --> OK
    T -- falha --> ERR["loaded = false, reason = erro com a mensagem"]
    A --> IMP["Enquanto importa: loaded = false, reason = importando, e as pernas caem para linha reta"]
```

```mermaid
flowchart TD
    A["GET /graph/status"] --> B{"Modo road?"}
    B -- não --> S1["200 com loaded = false e reason = modo haversine"]
    B -- sim --> S2["200 com loaded, nodes, edges, importedAt, loadMillis e reason"]
```

```mermaid
flowchart TD
    A["GET /graph/route com fromLat, fromLng, toLat e toLng"] --> B{"Grafo carregado?"}
    B -- não --> E1["422 GRAPH_NOT_LOADED"]
    B -- sim --> C{"Snap de até 500 m nos dois pontos e caminho para carro?"}
    C -- sim --> OK1["200 com km, path pelas ruas e distanceSource = ROAD"]
    C -- não --> OK2["200 com km em linha reta × desvio, path com os dois pontos e distanceSource = HAVERSINE"]
```
