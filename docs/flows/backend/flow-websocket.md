# Fluxos — WebSocket

Conexão STOMP, autorização das assinaturas, publicação com throttle e expiração de sessão. Índice em [flow-index.md](flow-index.md). Payloads e regras em [ARCHITECTURE.md](../../../ARCHITECTURE.md#websocket).

## 22. Conexão e assinatura

```mermaid
sequenceDiagram
    actor U as Cliente ou equipe
    participant I as StompAuthInterceptor
    participant DB as PostgreSQL
    participant B as Broker em memória

    U->>I: CONNECT (header Authorization Bearer JWT)
    alt sem Bearer, JWT inválido ou vencido, usuário inativo ou role DRIVER
        I-->>U: ERROR, conexão recusada
    else sessão já autenticada
        I-->>U: ERROR
    else ok
        I->>I: guarda o exp do token na sessão
        I-->>U: CONNECTED
    end

    U->>I: SUBSCRIBE destino
    I->>DB: busca o usuário pelo username e confere se está ativo
    alt sem CONNECT ou usuário inativo
        I-->>U: ERROR
    else /topic/fleet/locations ou /topic/orders
        alt equipe (ADMIN, DISPATCHER, FLEET_MANAGER)
            I->>B: libera a assinatura
        else cliente
            I-->>U: ERROR
        end
    else /topic/orders/id
        alt equipe
            I->>B: libera a assinatura
        else CUSTOMER dono do pedido
            I->>DB: confere se o pedido é do cliente
            I->>B: libera a assinatura
        else outro cliente
            I-->>U: ERROR
        end
    else qualquer outro destino
        I-->>U: ERROR
    end

    U->>I: SEND ou outro comando (exceto SUBSCRIBE, UNSUBSCRIBE, DISCONNECT)
    I-->>U: ERROR, recusado
```

## 23. Publicação depois do commit, com throttle de posição

```mermaid
flowchart TD
    A["Commit de mudança de pedido, status de motorista ou posição"] --> B{"Evento de pedido (OrderTracked)?"}
    B -- sim --> C["Lê pedido e rota em transação própria (readOnly)"]
    C --> D["Publica em /topic/orders (equipe)"]
    D --> E{"Código é assigned, unassigned ou route_failed?"}
    E -- sim --> F["Não publica no tópico do pedido"]
    E -- não --> G["Calcula ETA vivo, stopsDone e stopsTotal e publica em /topic/orders/id"]
    B -- não --> H{"Mudança de status do motorista?"}
    H -- sim --> I["Publica em /topic/fleet/locations na hora e grava como último envio"]
    H -- não --> J{"Ping de posição (DriverMoved)?"}
    J -- sim --> K{"Primeiro envio, ou passou WS_LOCATION_MIN_INTERVAL_S desde o último e andou mais de WS_LOCATION_MIN_DISTANCE_M?"}
    K -- não --> L["Não envia (a posição já está gravada no banco)"]
    K -- sim --> M["Publica em /topic/fleet/locations sem consultar o banco e grava como último envio"]
```

Rollback não gera nada: os listeners são `AFTER_COMMIT`. Falha no envio só gera log e não afeta a resposta da API.

## 24. Varredura de expiração

```mermaid
flowchart TD
    A["Varredura a cada 30 s (fixedDelay)"] --> B["Para cada socket aberto"]
    B --> C{"Sessão tem JWT registrado?"}
    C -- sim --> D{"exp já passou?"}
    D -- sim --> E["Fecha com código 1008 e motivo Sessão expirada"]
    D -- não --> F["Mantém aberto"]
    C -- não --> G{"Abriu há mais de 10 s sem CONNECT válido?"}
    G -- sim --> E
    G -- não --> F
    E --> H["afterConnectionClosed remove a sessão dos mapas"]
```
