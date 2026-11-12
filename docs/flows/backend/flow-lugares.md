# Fluxos — Lugares do cliente

Meus endereços: o cliente cadastra e edita os próprios lugares e os usa nos pedidos. Índice em [flow-index.md](flow-index.md).

## 27. Meus endereços e uso no pedido

```mermaid
sequenceDiagram
    actor C as Cliente (JWT)
    participant P as CustomerPlaceController
    participant S as PlaceService
    participant DB as PostgreSQL

    C->>P: POST /customer/places (name, address, lat, lng, contact)
    P->>S: create com o cliente logado como dono
    S->>DB: INSERT places (customer_id = cliente)
    S-->>C: 201 com publicId

    C->>P: PUT /customer/places/{id}
    alt lugar não é do cliente ou está inativo
        S-->>C: 404 NOT_FOUND
    else usado em pedido CREATED, DISPATCHED, DRIVER_ENROUTE, ARRIVED ou IN_PROGRESS
        S-->>C: 409 RESOURCE_IN_USE
    else ok
        S->>DB: UPDATE places
        S-->>C: 200
    end

    C->>P: DELETE /customer/places/{id}
    S->>DB: UPDATE places (active = false)
    S-->>C: 204
```

```mermaid
sequenceDiagram
    actor C as Cliente (JWT)
    participant O as OrderService
    participant DB as PostgreSQL

    C->>O: POST /orders com placeId em pickup, dropoff ou waypoints
    O->>DB: busca o lugar ativo
    alt lugar de outro cliente, inativo ou inexistente
        O-->>C: 404 NOT_FOUND
    else lugar próprio ou da equipe (customer_id nulo)
        O->>DB: INSERT orders (CREATED) usando o lugar
        O-->>C: 201
    end
```

Lugar novo enviado dentro do pedido (name, lat e lng, sem `placeId`) vira lugar do próprio cliente. O `GET /customer/places` lista só os lugares dele, sem os inativos. Lugares da equipe não aparecem aqui.
