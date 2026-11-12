# Fluxos — Motoristas

Posição do motorista e busca dos mais próximos. Índice em [flow-index.md](flow-index.md).

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
        S->>WS: publica em /topic/fleet/locations depois do commit, com throttle (fluxo 23)
        S-->>D: 204
    end
```

## 12. Motoristas mais próximos

```mermaid
flowchart LR
    A["GET /drivers/nearest (lat, lng, limit)"] --> B["SELECT motoristas AVAILABLE com lat e lng preenchidos"]
    B --> C["Calcula Haversine até o ponto"]
    C --> D["Ordena por distância e aplica limit (padrão 5, máximo 20)"]
    D --> E["200 com lista e distanceKm"]
```

## 28. Reativação de motorista e veículo

```mermaid
sequenceDiagram
    actor E as ADMIN ou FLEET_MANAGER (JWT)
    participant C as DriverController
    participant S as DriverService
    participant DB as PostgreSQL

    E->>C: POST /drivers/{id}/reactivate
    C->>S: reactivate(publicId)
    S->>DB: trava o motorista (PESSIMISTIC_WRITE)
    alt motorista não existe
        S-->>E: 404 NOT_FOUND
    else já está ativo
        S-->>E: 200 sem mudança
    else inativo
        S->>DB: active = true (motorista e usuário), status OFFLINE e linha de histórico reactivate
        S-->>E: 200 com o motorista
    end
```

O motorista volta `OFFLINE`, sem veículo e sem frotas. O veículo segue a mesma ideia com `POST /vehicles/{id}/reactivate`, mas mantém o status que tinha e não recebe motorista de volta. A reativação não colide com outro cadastro, porque `username` e `plate` continuam reservados enquanto o cadastro está inativo.
