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

## Painel do dashboard

```mermaid
flowchart TD
    D["/dashboard"] --> Pf{"Perfil"}
    Pf -- ADMIN --> A["Painel da administração (fluxo 19)"]
    Pf -- DISPATCHER --> B["Painel do despacho (fluxo 19)"]
    Pf -- FLEET_MANAGER --> C["Painel da frota (fluxo 19)"]
    Pf -- CUSTOMER --> E["Painel do cliente (fluxo 19)"]
    A --> T["Abas Visão geral, Despacho e Frota, só para ADMIN"]
```

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
