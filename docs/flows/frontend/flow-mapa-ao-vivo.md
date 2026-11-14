# Fluxos — Mapa ao vivo

Como a tela S08 e as listas de despacho e frota se atualizam: REST para o estado inicial, STOMP para as mudanças. Índice em [flow-index.md](flow-index.md). Os tópicos estão no [fluxo 22 do backend](../backend/flow-websocket.md).

## Conexão e assinaturas

```mermaid
flowchart TD
    A["Sessão válida, após login (fluxo 7)"] --> B["Abre STOMP em /ws com Authorization Bearer no CONNECT (fluxo 22)"]
    B --> C{"Conectou?"}
    C -- não --> D["Indicador: Reconectando ou Offline no topo"]
    D --> E["Backoff e nova tentativa"]
    E --> B
    C -- sim --> F["Indicador: Conectado"]
    F --> G["Assina /topic/fleet/locations (equipe)"]
    F --> H["Assina /topic/orders (equipe)"]
    F --> I["Assina /topic/orders/id, uma por pedido visível, até 20 (cliente e equipe)"]
    I --> J["Cancelamento ou troca de tela remove a assinatura"]
```

Uma conexão por sessão. As assinaturas são refeitas a cada mudança da lista visível, sem duplicar.

## Evento chega

```mermaid
flowchart TD
    M["Mensagem STOMP"] --> T{"Tópico"}
    T -- /topic/fleet/locations --> L["Atualiza no cache o motorista pelo driverId: status, lastSeenAt, lat e lng"]
    T -- /topic/orders --> R["Refetch do painel ou da lista, com debounce de 3 s"]
    T -- /topic/orders/id --> O{"Status ainda ativo?"}
    O -- sim --> U["Atualiza ETA, status e paradas da linha ou do cartão"]
    O -- não --> RF["Refetch do pedido, do painel e da lista"]
    L --> MAP["S08 move o marcador e posição nula não é desenhada"]
```

O evento de localização traz posição e status, e não traz nome nem cliente. Por isso a linha da tabela de motoristas é atualizada pelo `driverId` que já está na lista.

## Reconexão

```mermaid
sequenceDiagram
    participant UI as Tela
    participant WS as STOMP
    participant API as REST
    WS-->>UI: Conexão caiu
    UI->>UI: Indicador Reconectando
    WS-->>UI: Conectou de novo
    UI->>API: GET /dashboard/fleet/status e GET /orders (recarrega por REST, fluxo 16)
    API-->>UI: Estado atual
    UI->>WS: Assina de novo, sem duplicar
```

O servidor não reenvia o que passou (não há replay), então a tela sempre recarrega por REST depois de reconectar.

## Fim da sessão

```mermaid
flowchart TD
    A["Token vence em expiresAt, ou vem 401"] --> B["Limpa sessionStorage"]
    B --> C["Fecha o STOMP"]
    C --> D["Vai para /login?next=rota atual"]
    E["Socket fecha com 1008 Sessão expirada"] --> B
```

Os dois caminhos chegam no mesmo login, sem laço de redirecionamento (fluxo 22 do backend fecha com 1008 quando o token vence).
