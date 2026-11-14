# Fluxos — Jornada do cliente

O que o cliente percorre no navegador, do cadastro ao acompanhamento do pedido. Índice em [flow-index.md](flow-index.md).

## Cadastro e entrada

```mermaid
flowchart TD
    A["S01 Login ou S02 Cadastro"] --> B{"Já tem conta?"}
    B -- não --> C["S02 POST /auth/register (fluxo 7)"]
    C --> D{"Erro de username ou senha?"}
    D -- sim --> E["Mensagem no campo, sem limpar o formulário"]
    E --> C
    D -- não --> F["Volta ao login com aviso de conta criada"]
    B -- sim --> F
    F --> G["POST /auth/login (fluxo 7)"]
    G --> H["Painel do cliente em /dashboard"]
```

## Endereços

```mermaid
flowchart TD
    A["S27 Meus endereços em /my/places"] --> B["Lista de /customer/places (fluxo 27)"]
    B --> C["Cria, edita ou desativa um lugar"]
    C --> D["Lugar disponível na S10 Novo pedido"]
    D --> E["Pedido guarda o endereço como cópia (fluxo 27)"]
```

## Pedido e acompanhamento

```mermaid
flowchart TD
    A["S10 Novo pedido: origem, destino e paradas"] --> B["POST /orders (fluxo 3)"]
    B --> C["S09 Lista própria com o novo pedido"]
    C --> D["S11 Detalhe: status, ETA, paradas"]
    D --> E["Atualização por /topic/orders/id (fluxo 22 e 23)"]
    D --> F{"cancellable?"}
    F -- sim --> G["Cancelar com motivo (fluxo 10)"]
    F -- não --> H["Só leitura"]
    D --> I["Compartilhar código de rastreio"]
    I --> J["S03 Rastreio público sem login, com polling de 30 s (fluxo 17)"]
```

O cliente nunca vê posição do motorista, fila, desempenho nem histórico interno. A S11 mostra só as paradas, o ETA que a API informa e o motorista pelo nome.

## Análises do cliente

```mermaid
flowchart LR
    T["S23 Tendência anual em /analytics/trends"] --> Q["GET /dashboard/trends/yearly (fluxo 16)"]
    Q --> V["Mostra pedidos por mês e taxa de sucesso, sem km, economia, ciclo ou motoristas"]
```

## Erros que o cliente vê

```mermaid
flowchart TD
    A["Chamada à API"] --> B{"Resposta"}
    B -- 401 --> C["Login com next"]
    B -- 403 --> D["S26 Sem acesso"]
    B -- 404 --> E["S26 Não encontramos este item, inclusive pedido de outro cliente"]
    B -- sem conexão ou 500 --> F["Banner Sem conexão com o servidor, com Tentar de novo"]
```

Os códigos seguem o contrato de erro da API (`ErrorResponse`), e a mensagem de cada um vem de `frontend/src/api/errors.ts`.
