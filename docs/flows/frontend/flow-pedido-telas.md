# Fluxos — Pedido nas telas

Ciclo de vida de um pedido vista pelas telas da equipe (S09 a S12) e pelo cliente (S09 a S11). A regra de transição está no [fluxo 2 do backend](../backend/flow-pedidos.md). Índice em [flow-index.md](flow-index.md). As peças de composição (painel esquerdo, faixa inferior, `SidePanel`) estão descritas no índice.

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

## S09 Lista de pedidos

```mermaid
flowchart TD
    L["S09 sobre o fundo ambiente"] --> F["Barra de filtros: status com contagem, busca, Só ativos, De, Até, Ordenar"]
    F --> FS["Equipe: filtros de Motorista e Cliente"]
    L --> T["Tabela: código, status, origem e destino, motorista, datas"]
    T --> TS["Equipe: colunas Veículo e Cliente"]
    T --> C{"Clique na linha"}
    C --> SP["SidePanel: prévia do pedido"]
    SP --> SC["Status grande, datas e paradas"]
    SP --> SE["Equipe: cliente, motorista e placa"]
    SP --> AB["Abrir pedido: S11"]
    T --> CD["Clique no código: S11 direto"]
```

- Os filtros ficam na URL (`?status=`, `?active=`, `?from=`, `?to=`, `?driverId=`, `?customerId=`, `?q=`, `?sortBy=`).
- Cada status da barra é um botão que liga e desliga o filtro e mostra a contagem daquele status.
- Um novo clique na mesma linha fecha o `SidePanel`, assim como o "Fechar" e o Esc.
- "Novo pedido" fica nas ações do bloco de título, para quem pode criar.

## S10 Novo pedido

```mermaid
flowchart TD
    N["S10 sobre o fundo ambiente"] --> CL["Seção Cliente: só para a equipe, opcional"]
    N --> RT["Seção Rota: retirada R, paradas numeradas e entrega E, em linha do tempo"]
    RT --> PK["Escolher no mapa: o clique no mapa ao lado preenche latitude e longitude"]
    RT --> PL["Lugar cadastrado (equipe) ou Meu endereço do cliente (fluxo 27)"]
    N --> IT["Seção Itens da carga"]
    N --> OP["Seção Opções: prova de entrega e observações"]
    N --> PV["Pré-visualização: mapa em vidro com os pontos preenchidos"]
    CL --> S["Criar pedido: POST /orders (fluxo 3)"]
    RT --> S
    IT --> S
    OP --> S
```

Abaixo de 1024 px, o mapa da pré-visualização fica recolhido em "Mostrar mapa" e abre sozinho quando o usuário escolhe um ponto no mapa.

## Equipe: da criação ao despacho

```mermaid
flowchart TD
    N["S10 Novo pedido (ADMIN, DISPATCHER)"] --> C["POST /orders (fluxo 3)"]
    C --> L["S09 Lista de pedidos com filtro de status"]
    L --> Q{"Sem motorista?"}
    Q -- sim --> FQ["S12 Fila Sem motorista, no painel esquerdo do Despacho"]
    FQ --> OP["Seta do cartão: abre S11"]
    OP --> AT["S11 Atribuir motorista: modal com os mais próximos da retirada (fluxo 12), motorista e veículo (fluxo 9)"]
    AT --> RT["S11 Calcular rota na faixa inferior (fluxo 13), ou pular"]
    RT --> DP["Despachar: POST dispatch (fluxo 4)"]
    Q -- não --> DP
    DP --> LIVE["S11 atualiza por STOMP /topic/orders/id (fluxo 23)"]
    FQ --> BATCH["S12 Calcular plano e Aplicar plano, na faixa inferior (fluxo 14)"]
    BATCH --> DPA["S12 Despachar todos: um POST dispatch por pedido (fluxo 4)"]
```

Na tela S12, "Calcular plano" não grava nada. "Aplicar plano" grava as atribuições de uma vez, depois da confirmação em modal, e o plano em lote grava só o que o usuário confirmou. "Despachar todos" chama uma operação de despacho por pedido e mostra o resultado em cada linha do plano.

## S12 Despacho

```mermaid
flowchart LR
    D["S12 sobre o mapa contínuo, plano e visto de cima"] --> CMD["Barra de comando: algoritmo Melhor combinação (húngaro) ou Mais rápido (guloso), motoristas e veículos livres, Calcular plano"]
    D --> Q["Painel esquerdo: abas Sem motorista, Atribuídos e Em andamento, com contagem"]
    D --> TR["Faixa inferior: seleção, plano, comparação dos algoritmos, Aplicar plano e Despachar todos"]
    Q --> CA["Cartão do pedido: código, tempo na etapa, mini-rota e seta para S11"]
    CA --> MK["Clique no cartão ou no marcador R: destaca o pedido no mapa e na lista"]
    TR --> ARC["Plano calculado: arcos do motorista até a retirada, com a distância"]
```

- Só a aba "Sem motorista" tem caixa de seleção. Sem seleção, o plano considera todos os pedidos da fila.
- O pedido parado acima do limite mostra "Parado · N min" no cartão. O mais antigo deles ganha também o rótulo "Parado" no mapa.
- "Em andamento" mostra o motorista, o ETA e a barra de paradas de cada pedido.

## S11 Detalhe do pedido, equipe

```mermaid
flowchart LR
    V["S11 sobre o mapa contínuo"] --> LP["Painel esquerdo: status grande, paradas e ações"]
    V --> RC["Coluna direita: VehicleCard e abas Carga, Linha do tempo e Cliente"]
    V --> ST["Faixa inferior: rota calculada"]
    V --> MP["Mapa: rota, paradas, rótulo Próxima parada e veículo"]
```

- **Painel esquerdo:** status grande, linha do tempo das paradas (com "Concluir" nas paradas intermediárias pendentes, quando há rota) e as ações. As ações e o "Concluir" só aparecem para ADMIN e DISPATCHER.
- **Coluna direita:** o `VehicleCard` com o render do veículo na cor cadastrada, a placa, o status, o nome do veículo (`vehicleName`: "Marca Modelo" ou, sem eles, o tipo), o último sinal e o motorista com link para o perfil. Abaixo, as abas "Carga" (itens, prova de entrega, motivo e observação), "Linha do tempo" (histórico, fluxo 21) e "Cliente" (cliente, identificador e "Copiar link público").
- **Faixa inferior:** algoritmo, modo (pelas ruas ou linha reta), data do cálculo, a sequência de paradas, a legenda, Total, Original, Economia e "Chegada em". "Calcular rota" e "Recalcular" (fluxo 13) aparecem para ADMIN e DISPATCHER enquanto o pedido está ativo.
- **Mapa:** o padding da câmera é medido a partir dos painéis, para a rota caber na área livre.
- Abaixo de 1280 px, a coluna direita desce para dentro da coluna esquerda. Abaixo de 768 px, o mapa fica no topo e os painéis vêm em uma coluna.

### Câmera de acompanhamento e "Seguir veículo"

```mermaid
stateDiagram-v2
    state "Visão geral da rota" as Geral
    state "Seguindo o veículo" as Seguindo
    state "Acompanhamento suspenso" as Suspenso
    [*] --> Geral : abre o pedido
    Geral --> Seguindo : chegou à visão geral, status DRIVER_ENROUTE ou IN_PROGRESS e motorista com posição
    Seguindo --> Seguindo : nova posição do motorista (fluxo 23)
    Seguindo --> Suspenso : arrastar, roda, inclinar ou girar o mapa
    Suspenso --> Seguindo : botão Seguir veículo
    Seguindo --> Geral : status deixa de ser seguido ou motorista sem posição
```

- **Visão geral:** a câmera enquadra a rota com inclinação de 30° e relevo 1,3, e a rota se desenha aos poucos.
- **Seguindo:** quando a câmera chega à visão geral, ela voa até o veículo (zoom 15,4 e inclinação de 68°), virada para a rota à frente. Cada posição que chega pelo tópico do motorista desliza a câmera até o veículo em 800 ms.
- **Suspenso:** um gesto do usuário no mapa suspende o acompanhamento, e o botão de vidro "Seguir veículo" aparece acima da faixa inferior (centralizado na base, no celular). O clique retoma com um novo voo.
- Entrar em outra tela volta o estado para "seguindo". Com movimento reduzido, a câmera salta direto. No tablet, a inclinação para em 60°; no celular, em 45° e sem relevo.
- O marcador do veículo só aparece quando o motorista tem posição e o pedido não terminou.

## Equipe: andamento e encerramento

```mermaid
flowchart TD
    V["S11 Pedido em andamento"] --> E["Aba Linha do tempo: histórico (fluxo 21)"]
    V --> ST["Painel esquerdo, paradas: concluir parada (fluxo 18), atualizada pelo evento do pedido"]
    V --> CAN["Painel esquerdo, Cancelar com motivo (fluxo 10), confirmação em modal"]
    V --> POD["Painel esquerdo, Registrar POD, quando o pedido está em andamento (fluxo 11)"]
    CAN --> OUT1["Status CANCELLED, com autor registrado"]
    POD --> OUT2["Status COMPLETED"]
```

O botão principal do painel esquerdo mostra o próximo passo do pedido: "Despachar", "Motorista a caminho", "Chegou à retirada", "Iniciar entrega", "Registrar prova de entrega" ou "Concluir". "Falhou" e "Cancelar" pedem o motivo em modal.

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

No cliente, nenhuma tela usa o mapa contínuo. A S09 é a mesma mesa da equipe, sem as colunas Veículo e Cliente, sem os filtros de Motorista e Cliente e com a prévia do `SidePanel` sem os envolvidos. A composição da S11 do cliente está em [flow-cliente.md](flow-cliente.md).
