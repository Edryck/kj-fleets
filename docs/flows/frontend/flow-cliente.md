# Fluxos — Jornada do cliente

O que o cliente percorre no navegador, do cadastro ao acompanhamento do pedido. Índice em [flow-index.md](flow-index.md).

Nenhuma tela do cliente usa o mapa contínuo. Todas ficam sobre o fundo ambiente, com o conteúdo em cartões de vidro, menos o login e o cadastro, que ficam sobre um mapa estático.

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

S01 e S02 são um cartão de vidro centrado sobre o mapa estático, sem interação. O cartão de login tem os links "Criar conta" e "Rastrear pedido".

## Painel do cliente

```mermaid
flowchart TD
    D["S07 Minhas entregas em /dashboard"] --> Q["GET /customer/dashboard com period (fluxo 19)"]
    Q --> H["Número de destaque: Em andamento, com Novo pedido ao lado"]
    Q --> C["Um cartão por entrega ativa: código, status grande, ajuda do status, Chegada em, paradas e motorista"]
    Q --> S["Coluna lateral: Precisa de atenção e Entregues recentemente"]
    Q --> R["Resumo do período, embaixo"]
    C --> X{"cancellable na resposta?"}
    X -- sim --> CC["Cancelar pedido com motivo, em modal (fluxo 10)"]
    C --> EV["Atualização por /topic/orders/id (fluxo 23)"]
```

O seletor de período fica no bloco de título. "Precisa de atenção" só aparece quando há pedido que falhou ou está parado. Sem nenhum pedido, a tela mostra só o estado vazio com "Novo pedido".

## Endereços

```mermaid
flowchart TD
    A["S27 Meus endereços em /my/places"] --> B["Lista de /customer/places (fluxo 27)"]
    B --> C["Cria, edita ou desativa um lugar"]
    C --> D["Lugar disponível na S10 Novo pedido"]
    D --> E["Pedido guarda o endereço como cópia (fluxo 27)"]
```

A S27 mostra a lista de endereços ao lado de um mapa em vidro com os pinos. Escolher um endereço na lista mostra "Editar" e "Remover". "Novo endereço" e "Editar" abrem o `SidePanel` com o formulário, e o clique no mapa marca o ponto. "Remover" pede confirmação em modal.

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

A S11 do cliente tem duas colunas de cartões, que viram uma só abaixo de 1100 px:

- **Situação do pedido:** status grande com a frase de ajuda, "Chegada estimada" em número de destaque, o trilho da jornada, o progresso das paradas que chega pelo evento do pedido e o motorista pelo nome.
- **Paradas:** linha do tempo com o endereço de cada parada.
- **Linha do tempo:** o nome e a hora de cada evento, sem detalhes nem coordenadas.
- **Carga:** itens, prova de entrega, motivo e observação.
- **Bloco de título:** "Copiar link público" e, enquanto o pedido está em CREATED, "Cancelar pedido".

A S03 é um cartão de vidro sobre o fundo ambiente, com o campo do código e o botão "Rastrear". O resultado mostra o status grande, a ajuda do status, "Chegada estimada" e a linha do tempo dos eventos.

## Minha conta

A S28 tem dois cartões: os dados do usuário, com o busto e a figura inteira do perfil, e "Trocar senha" (`PUT /me/password`, fluxo 25).

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
