# Fluxos — Mapa ao vivo

Como a tela S08 e as listas de despacho e frota se atualizam: REST para o estado inicial, STOMP para as mudanças. Índice em [flow-index.md](flow-index.md). Os tópicos estão no [fluxo 22 do backend](../backend/flow-websocket.md).

## Composição da S08

A S08 fica sobre o mapa contínuo, plano (inclinação 0°, sem relevo). Os motoristas vêm de `GET /drivers`, página a página.

```mermaid
flowchart LR
    S["S08 /map"] --> TB["Bloco de título: data, hora, total de motoristas e aviso de posições desatualizadas"]
    S --> CMD["Barra de comando: busca por motorista ou placa, status com contagem e frota"]
    S --> RP["Painel direito: cartão do motorista escolhido acima da lista"]
    S --> ZM["Controles do mapa: Aproximar, Enquadrar todos e Afastar"]
    S --> BT["Faixa inferior: Frota agora, Sem sinal e Legenda"]
    RP --> L["Lista: iniciais, nome, placa, último sinal e status"]
    RP --> C["Cartão do motorista escolhido"]
```

- **Barra de comando:** a busca e a frota filtram a lista e os marcadores. O segmento de status (Todos, Disponível, Ocupado, Offline) mostra a contagem dentro do recorte atual.
- **Cartão do motorista escolhido:**
  - o render do veículo em 3/4, na cor cadastrada, saindo do cartão, quando o modelo tem render;
  - nome, status e o selo "Sem sinal";
  - Placa, Veículo (`vehicleName` e o tipo), Último sinal e Frota;
  - o pedido ativo, com código, status, passos das paradas, total, ETA e próxima parada;
  - os botões "Abrir pedido" (S11) e "Ver motorista".
- **Mapa:** com um motorista escolhido em rota, o mapa desenha a rota do pedido ativo, com paradas e pílulas de distância, e enquadra a rota. Sem rota, enquadra os motoristas visíveis.
- **Faixa inferior:**
  - "Frota agora": barra empilhada por status;
  - "Sem sinal": total acima do limite e os nomes, para quem não é DISPATCHER;
  - "Legenda": os tipos de linha da rota em foco.
- **Larguras:**
  - de 1024 a 1279 px: o bloco "Sem sinal" some;
  - no tablet: o cartão e a lista vão para a folha inferior, e a faixa inferior some;
  - no celular: a folha inferior tem as abas "Lista" e "Detalhe", e "Detalhe" fica desligada até escolher um motorista. Os controles do mapa ficam à direita, acima da folha, e somem com a folha cheia.

O Mapa ao vivo não tem câmera de acompanhamento nem botão "Seguir veículo". Essa câmera é do detalhe do pedido ([flow-pedido-telas.md](flow-pedido-telas.md)). "Enquadrar todos" enquadra todos os marcadores da cena.

## Motorista escolhido e `?driver=`

```mermaid
sequenceDiagram
    participant O as Origem
    participant UI as S08
    participant API as REST
    O->>UI: Abre /map?driver=id (marcador ou linha de motorista nos dashboards)
    UI->>UI: Lê driver na montagem e abre o cartão (no celular, na aba Detalhe)
    UI->>API: GET /orders?driverId=id&active=true&limit=1
    API-->>UI: Pedido ativo, se houver
    UI->>API: GET /orders/id/route, se houver pedido ativo
    API-->>UI: Rota, ou ROUTE_NOT_FOUND (sem rota)
    UI->>UI: Clique na lista ou no marcador troca o driver na URL
    UI->>UI: Fechar o cartão remove o driver da URL
```

- A URL é trocada com `replace`, sem criar entrada no histórico.
- O parâmetro só é lido ao montar a tela. Um id que não está na lista não abre cartão.
- O clique num marcador só escolhe o motorista quando o id é de um motorista da lista.

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

O indicador é o chip do bloco de título, em toda tela autenticada: "Tempo real" quando conectado, "Reconectando" ou "Offline". Fora do ar, a S08 acrescenta aos metadados "As posições podem estar desatualizadas".

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
