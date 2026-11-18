# Fluxos — Navegação por perfil

Guardas de rota, sidebar e sessão no navegador. Índice em [flow-index.md](flow-index.md). As rotas ficam em `frontend/src/routes.ts`, e a API decide o acesso de verdade (403 vai para S26).

## Entrada e guarda de rota

```mermaid
flowchart TD
    A["Abre uma rota do SPA"] --> P{"Rota pública?"}
    P -- sim --> PUB["Login, cadastro ou rastreio"]
    P -- não --> S{"Há sessão válida no sessionStorage?"}
    S -- não --> L["/login?next=rota atual"]
    S -- sim --> X{"expiresAt já passou?"}
    X -- sim --> L
    X -- não --> R{"Perfil está na lista de roles da rota?"}
    R -- não --> F["/403 (S26)"]
    R -- sim --> OK["Renderiza o Shell e a tela"]
    OK --> API{"A API responde 401?"}
    API -- sim --> L
    API -- não --> D["Tela trata 403 e 404 do ErrorResponse"]
```

Esse fluxo consome o login da API (fluxo 7) e o perfil atual de `GET /me` (fluxo 25). Um 401 em qualquer chamada limpa a sessão e volta ao login, sem loop.

## Sidebar por perfil

```mermaid
flowchart LR
    Role{"Perfil"} --> ADM["ADMIN"]
    Role --> DSP["DISPATCHER"]
    Role --> FLT["FLEET_MANAGER"]
    Role --> CUS["CUSTOMER"]
    ADM --> OPA["Operação: Dashboard, Mapa ao vivo, Pedidos, Novo pedido, Despacho"]
    DSP --> OPD["Operação: Dashboard, Mapa ao vivo, Pedidos, Novo pedido, Despacho"]
    FLT --> OPF["Operação: Dashboard, Mapa ao vivo, Pedidos"]
    CUS --> OPC["Operação: Dashboard, Pedidos, Novo pedido"]
    ADM --> ADC["Cadastros, Análise e Administração completos"]
    DSP --> ADD["Cadastros, Alertas, Economia de rotas e Simulador, sem Usuários"]
    FLT --> ADF["Cadastros, Alertas e Tendência anual, sem Economia de rotas"]
    CUS --> ADK["Meus endereços e Tendência anual"]
```

Grupos sem item para o perfil somem da sidebar. Quem não tem acesso a uma rota digitada na URL cai em `/403`.

A sidebar é o menu lateral de vidro (`Rail`), recolhido em ícones, com dica ao passar o mouse. Expandido, ele fica por cima do conteúdo, sem empurrá-lo, e fecha ao navegar, ao clicar fora ou com Esc.

## Shell

```mermaid
flowchart TD
    SH["Shell autenticado"] --> IM{"Perfil da equipe e rota imersiva?"}
    IM -- sim --> MS["Mapa contínuo (MapStage) atrás da tela"]
    IM -- não --> AB["Fundo ambiente com curvas de nível"]
    SH --> RL["Menu lateral à esquerda"]
    SH --> SC["Canto superior direito: sino, tema e chip do usuário"]
    SH --> TB["Bloco de título: chip de conexão, título, metadados e ações"]
    SC --> UM["Menu do chip: Minha conta e Sair"]
```

- As rotas imersivas, só da equipe, são `/dashboard`, `/dashboard/dispatch`, `/dashboard/fleet`, `/map`, `/dispatch`, `/routes/optimize` e `/orders/:id` (menos `/orders/new`). A lista fica em `frontend/src/map/immersive.ts`.
- O `MapStage` fica montado para a equipe durante a sessão e só fica oculto e inerte nas telas sem mapa. Por isso a câmera viaja de uma cena para a outra.
- O CUSTOMER nunca tem tela imersiva.
- O sino da equipe lista os alertas de `GET /dashboard/alerts` e leva a `/alerts`. O do cliente usa `GET /customer/dashboard`, com link para cada pedido e para o painel.
- O chip do usuário mostra a figura 3D do perfil, o `username` e o perfil por extenso.
- O chip de conexão do bloco de título mostra "Tempo real", "Reconectando" ou "Offline" ([mapa ao vivo](flow-mapa-ao-vivo.md)).

## Faixas de largura

As faixas saem de `viewportFor` (`frontend/src/map/responsive.ts`), e `useViewport` relê a faixa a cada `resize`.

| Faixa | Largura | O que muda |
|---|---|---|
| `full` | ≥ 1280 px | Composição completa |
| `compact` | 1024 a 1279 px | Painéis laterais mais estreitos, blocos secundários da faixa inferior ocultos, barra de comando reposicionada junto ao título e `SidePanel` com 360 px |
| `tablet` | 768 a 1023 px | Menu lateral sempre recolhido. O painel direito do Mapa ao vivo e o `SidePanel` viram folha inferior com alça e três alturas (recolhida, média e cheia), e a faixa inferior do Mapa ao vivo some. Câmera com inclinação de no máximo 60° |
| `phone` | < 768 px | Barra superior com o botão "Abrir menu", e o menu vira gaveta opaca. Nas telas imersivas, o mapa fica no topo e os painéis vêm em uma coluna, e o Mapa ao vivo usa folha inferior com as abas "Lista" e "Detalhe". O `SidePanel` ocupa a tela inteira, opaco. Tabelas viram cartões de registro. Câmera sem terreno, sem giro de entrada e com inclinação de no máximo 45° |

## Painel do dashboard

```mermaid
flowchart TD
    D["/dashboard"] --> Pf{"Perfil"}
    Pf -- ADMIN --> A["Painel da administração (fluxo 19)"]
    Pf -- DISPATCHER --> B["Painel do despacho (fluxo 19)"]
    Pf -- FLEET_MANAGER --> C["Painel da frota (fluxo 19)"]
    Pf -- CUSTOMER --> E["Painel do cliente (fluxo 19)"]
    A --> T["Segmento Visão geral, Despacho e Frota no bloco de título, só para ADMIN"]
    A --> V["Vista aérea: número de destaque, painel direito e faixa inferior"]
    B --> V
    C --> V
    V --> M["Clique no marcador ou na linha de um motorista: /map?driver=id"]
```

Os três painéis da equipe usam a mesma composição sobre o mapa contínuo, com relevo e giro de entrada:

- **Número de destaque** sobre o céu, com os números secundários abaixo. O destaque é a taxa de sucesso (ADMIN), os pedidos aguardando (DISPATCHER) ou os motoristas disponíveis (FLEET_MANAGER).
- **Painel direito:** frota agora, a lista de motoristas e os alertas, conforme o perfil. Cada motorista leva a `/map?driver=id` ([mapa ao vivo](flow-mapa-ao-vivo.md)).
- **Faixa inferior:** os painéis do perfil, como "Funil agora", "Motivos de falha" e "Economia de rotas" no da administração.
- **Bloco de título:** seletor de período. O painel da frota tem também o seletor de frota (`?fleetId=`).

Abaixo de 1280 px, o painel direito e a faixa inferior saem das bordas e rolam em grade sob o número de destaque. O painel do cliente fica em [flow-cliente.md](flow-cliente.md).

## Análises

```mermaid
flowchart LR
    T["/analytics/trends"] --> TQ["GET /dashboard/trends/yearly (fluxo 16)"]
    TQ --> TC{"Perfil CUSTOMER?"}
    TC -- sim --> TH["Oculta km, economia, ciclo e motoristas"]
    TC -- não --> TF["Mostra todos os gráficos e a tabela por motorista"]
    R["/analytics/routing"] --> RQ["GET /dashboard/routing/savings com period (fluxo 16)"]
    G["/graph"] --> GS["GET /graph/status (fluxo 15)"]
    GS --> GT["Teste ponto a ponto: GET /graph/route (fluxo 15)"]
```

S23 não tem seletor de período, porque o endpoint não aceita `period`. S24 tem. S25 é só da equipe e chama `GET /graph/status` e `GET /graph/route` (fluxo 15).

As três ficam sobre o fundo ambiente. S23 abre com "Pedidos no ano" em número de destaque, seguido dos cartões de gráfico. S24 abre com "km economizados" e tem o seletor de período no bloco de título. S25 mostra o status do grafo ao lado de um mapa em vidro. Com o grafo carregado, dois cliques no mapa marcam a origem (A) e o destino (B) do teste.
