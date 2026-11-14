# Fluxos — Pedido nas telas

Ciclo de vida de um pedido vista pelas telas da equipe (S09 a S12) e pelo cliente (S09 a S11). A regra de transição está no [fluxo 2 do backend](../backend/flow-pedidos.md). Índice em [flow-index.md](flow-index.md).

## Estados e quem move cada um

```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> DISPATCHED : Despacho na tela S11 ou S12 (fluxo 4)
    DISPATCHED --> DRIVER_ENROUTE : Motorista inicia o trajeto (fluxo 5)
    DRIVER_ENROUTE --> ARRIVED : Motorista chega ao ponto (fluxo 5)
    ARRIVED --> IN_PROGRESS : Operação começa (fluxo 5)
    IN_PROGRESS --> COMPLETED : POD registrado (fluxo 11)
    CREATED --> CANCELLED : Cancelar com motivo (fluxo 10)
    DISPATCHED --> CANCELLED : Cancelar com motivo (fluxo 10)
    DRIVER_ENROUTE --> FAILED : Falha registrada (fluxo 5)
    IN_PROGRESS --> FAILED : Falha registrada (fluxo 5)
    COMPLETED --> [*]
    CANCELLED --> [*]
    FAILED --> [*]
```

`UNASSIGNED` e `ASSIGNED` não são status: são etapas do funil (S04) para pedido sem motorista e com motorista sem despacho. O cancelamento e a falha exigem motivo, e o histórico (fluxo 21) mostra quem fez cada passo.

## Equipe: da criação ao despacho

```mermaid
flowchart TD
    N["S10 Novo pedido (ADMIN, DISPATCHER)"] --> C["POST /orders (fluxo 3)"]
    C --> L["S09 Lista de pedidos com filtro de status"]
    L --> Q{"Sem motorista?"}
    Q -- sim --> FQ["S12 Fila Sem motorista, em Despacho"]
    FQ --> AT["S11 ou modal Atribuir: motorista e veículo (fluxo 9)"]
    AT --> RT["S11 Calcular rota (fluxo 13), ou pular"]
    RT --> DP["Despachar: POST dispatch (fluxo 4)"]
    Q -- não --> DP
    DP --> LIVE["S11 atualiza por STOMP /topic/orders/id (fluxo 23)"]
    FQ --> BATCH["S12 Despacho em lote: plano e aplicação (fluxo 14)"]
    BATCH --> DP
```

Na tela S12, cada ação de atribuição e de despacho chama uma operação por pedido, e o plano em lote grava só o que o usuário confirmou.

## Equipe: andamento e encerramento

```mermaid
flowchart TD
    V["S11 Pedido em andamento"] --> E["Linha do tempo: histórico (fluxo 21)"]
    V --> ST["Paradas: concluir parada (fluxo 18), atualizada pelo evento do pedido"]
    V --> CAN["Cancelar com motivo (fluxo 10), confirmação em modal"]
    V --> POD["Registrar POD, quando o pedido está em andamento (fluxo 11)"]
    CAN --> OUT1["Status CANCELLED, com autor registrado"]
    POD --> OUT2["Status COMPLETED"]
```

## Cliente: o mesmo pedido, em versão reduzida

```mermaid
flowchart TD
    CN["S10 Novo pedido, com lugares salvos (fluxo 27)"] --> P["POST /orders (fluxo 3)"]
    P --> LC["S09 Lista própria, sem fila da equipe"]
    LC --> DET["S11 Detalhe: status, ETA e paradas (sem posição do motorista)"]
    DET --> CX{"cancellable na resposta?"}
    CX -- sim --> CC["Cancelar com motivo (fluxo 10)"]
    CX -- não --> RO["Somente leitura"]
    DET --> EV["Atualização pelo tópico /topic/orders/id (fluxo 23)"]
```

A tela do cliente nunca mostra motorista internos, fila nem histórico de operação. O rastreio público (fluxo 17) vale para quem tem o código, sem login.
