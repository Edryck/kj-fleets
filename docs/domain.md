# Modelo de dados

Diagrama ER e dicionário das tabelas. As regras de negócio estão em [ARCHITECTURE.md](../ARCHITECTURE.md#fluxo-e-regras-do-pedido); aqui fica só a forma dos dados.

> Os nomes e campos são **proposta deste projeto**. Os campos reais do Fleetbase não foram verificados (ver [CREDITS.md](../CREDITS.md)). Itens marcados com `*` são decisões minhas para fechar o desenho e podem mudar.

## Diagrama

```mermaid
erDiagram
    USERS ||--o| CUSTOMER : "perfil"
    USERS ||--o| DRIVER : "perfil"
    CUSTOMER |o--o{ ORDERS : "faz"
    DRIVER |o--o{ ORDERS : "entrega"
    VEHICLE |o--o{ ORDERS : "usado em"
    VEHICLE |o--o| DRIVER : "dirigido por"
    FLEET }o--o{ DRIVER : "driver_fleet"
    ORDERS ||--|| PAYLOAD : "tem"
    PLACE ||--o{ PAYLOAD : "pickup"
    PLACE ||--o{ PAYLOAD : "dropoff"
    PAYLOAD ||--o{ PAYLOAD_WAYPOINT : "paradas"
    PLACE ||--o{ PAYLOAD_WAYPOINT : "local"
    PAYLOAD ||--o{ PAYLOAD_ITEM : "itens"
    CONTACT |o--o{ PLACE : "contato"
    ORDERS ||--o{ TRACKING_STATUS : "histórico"
    ORDERS ||--o| ROUTE : "rota"
    ROUTE ||--|{ ROUTE_STOP : "paradas"
    PLACE |o--o{ ROUTE_STOP : "local"
    ROAD_NODE ||--o{ ROAD_EDGE : "from_node"
    ROAD_NODE ||--o{ ROAD_EDGE : "to_node"

    USERS {
        uuid id PK
        string username UK
        string password_hash
        string role
        boolean active
    }
    CUSTOMER {
        uuid id PK
        string public_id UK
        uuid user_id FK
        string name
        string phone
        string email
    }
    DRIVER {
        uuid id PK
        string public_id UK
        uuid user_id FK
        uuid vehicle_id FK
        string name
        string phone
        string license_number
        string status
        double lat
        double lng
        timestamptz last_seen_at
    }
    VEHICLE {
        uuid id PK
        string public_id UK
        string plate UK
        string type
        string status
    }
    FLEET {
        uuid id PK
        string public_id UK
        string name
    }
    ORDERS {
        uuid id PK
        string public_id UK
        string tracking_number UK
        string status
        uuid customer_id FK
        uuid driver_id FK
        uuid vehicle_id FK
        boolean pod_required
        string pod_value
        timestamptz pod_at
        string reason
        string notes
        jsonb meta
        timestamptz created_at
        timestamptz dispatched_at
        timestamptz finished_at
        bigint version
    }
    PAYLOAD {
        uuid id PK
        uuid order_id FK
        uuid pickup_id FK
        uuid dropoff_id FK
    }
    PAYLOAD_WAYPOINT {
        uuid payload_id FK
        uuid place_id FK
        int position
    }
    PAYLOAD_ITEM {
        uuid id PK
        uuid payload_id FK
        string name
        int quantity
    }
    PLACE {
        uuid id PK
        string public_id UK
        uuid contact_id FK
        string name
        string address
        double lat
        double lng
    }
    CONTACT {
        uuid id PK
        string name
        string phone
        string email
    }
    TRACKING_STATUS {
        uuid id PK
        uuid order_id FK
        string status
        string code
        string details
        double lat
        double lng
        timestamptz created_at
    }
    ROUTE {
        uuid id PK
        uuid order_id FK
        string algorithm
        string mode
        double total_km
        double baseline_km
        double savings_pct
        int eta_minutes
        timestamptz computed_at
    }
    ROUTE_STOP {
        uuid id PK
        uuid route_id FK
        uuid place_id FK
        int seq
        string type
        double lat
        double lng
        double leg_km
    }
    ROAD_NODE {
        bigint id PK
        double lat
        double lng
    }
    ROAD_EDGE {
        uuid id PK
        bigint from_node FK
        bigint to_node FK
        double length_m
    }
```

## Dicionário

### Enums (gravados como string)

| Enum | Valores |
|---|---|
| `users.role` | `ADMIN`, `DISPATCHER`, `FLEET_MANAGER`, `CUSTOMER`, `DRIVER` |
| `orders.status` e `tracking_status.status` | `CREATED`, `DISPATCHED`, `DRIVER_ENROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `FAILED` |
| `driver.status` | `AVAILABLE`, `BUSY`, `OFFLINE` |
| `vehicle.status` | `AVAILABLE`, `IN_USE`, `MAINTENANCE` `*` |
| `route.algorithm` | `NEAREST_NEIGHBOR`, `TWO_OPT`, `HELD_KARP`, `SIMULATED_ANNEALING` |
| `route.mode` | `HAVERSINE`, `ROAD` |
| `route_stop.type` | `START`, `PICKUP`, `WAYPOINT`, `DROPOFF` |

### Tabelas

| Tabela | Observações |
|---|---|
| `users` | Todos os perfis na mesma tabela. `password_hash` em BCrypt. O primeiro ADMIN vem das variáveis de ambiente. |
| `customer` | 1:1 com `users` (role `CUSTOMER`). Criado em `POST /auth/register`. |
| `driver` | 1:1 com `users` (role `DRIVER`), criado em `POST /drivers`. `vehicle_id` é único: um veículo por motorista e vice-versa `*`. `lat`, `lng` e `last_seen_at` guardam só a última posição. |
| `vehicle` | `plate` único. |
| `fleet` e `driver_fleet` | N:N entre frota e motorista. `driver_fleet(driver_id, fleet_id)` tem chave composta. |
| `orders` | `tracking_number` é o código do rastreio público. `reason` só é preenchido em `CANCELLED` e `FAILED`. `version` existe para o aceite ad hoc (lock otimista). Sem `updated_at` porque o histórico fica em `tracking_status`. |
| `payload` | 1:1 com `orders` e **imutável** depois da criação. Exige `pickup_id` e `dropoff_id`. |
| `payload_waypoint` | Paradas intermediárias na ordem de cadastro (`position`), no máximo 50 por payload. Chave `(payload_id, position)`. |
| `payload_item` | Itens transportados `*`: nome e quantidade. |
| `place` | Local reutilizável. `contact_id` é opcional. |
| `contact` | Pessoa de contato de um local. |
| `tracking_status` | Uma linha por transição, **inclusive a criação**. Nunca é alterada nem apagada. Guarda a posição quando houver. |
| `route` | 1:1 com `orders` (`order_id` único). Recalcular substitui a rota anterior. |
| `route_stop` | Paradas já na ordem final (`seq`). `place_id` é nulo no `START` (posição do motorista). |
| `road_node` | Vem de `nodes.csv`. O `id` é o do arquivo, não um UUID. |
| `road_edge` | Vem de `edges.csv`. Via de mão dupla vira duas linhas. |

### Índices e restrições

- Índices de desempenho: `orders(status)`, `orders(created_at)`, `orders(finished_at)`, `tracking_status(order_id, created_at)`, `driver(status)`, `road_edge(from_node)`.
- Únicos: `users.username`, `orders.public_id`, `orders.tracking_number`, `route.order_id`, `vehicle.plate`, `driver.vehicle_id`, `driver.user_id`, `customer.user_id`, `payload.order_id`.
- Chaves estrangeiras sem `ON DELETE CASCADE` nos dados de pedido: o histórico não é apagado. Excluir motorista ou veículo com pedidos associados deve falhar (ou desativar em vez de excluir).

### Regras que o banco não garante sozinho

Ficam no `service` e têm teste (ver [SYSTEM.md](../SYSTEM.md#10-testes)):
- um motorista só ter um pedido ativo por vez;
- a transição de status ser permitida;
- o máximo de 50 waypoints;
- `pod_value` preenchido antes de `COMPLETED` quando `pod_required`;
- `reason` obrigatório em cancelamento e falha.
