# PRODUCT.md — KJ Fleets

O que o produto é, para quem e até onde vai. Como ele é construído está em [ARCHITECTURE.md](ARCHITECTURE.md); as regras de código em [SYSTEM.md](SYSTEM.md).

## Em uma frase

Uma API para pequenas operações de entrega saberem, em tempo real, **quem está entregando o quê, onde está, em que etapa o pedido está e qual é a melhor ordem de entrega**.

## Problema

Quem despacha entregas com poucos motoristas costuma controlar tudo por planilha e mensagens: não fica claro quem está livre, onde cada motorista está, nem em que etapa cada pedido parou. Na hora de decidir quem pega qual pedido e em que ordem visitar as paradas, a decisão vira palpite, e palpite custa quilômetro, tempo e combustível.

## Para quem

| Perfil | O que faz | Como acessa |
|---|---|---|
| **Administrador (ADMIN)** | Tudo, mais criar usuários e importar o mapa viário | JWT |
| **Operador (DISPATCHER)** | Cria pedidos, atribui e despacha (um a um ou em lote otimizado), calcula rotas, acompanha, cancela | JWT |
| **Gestor de frota (FLEET_MANAGER)** | Cuida de motoristas, veículos e frotas; acompanha pedidos e o dashboard | JWT |
| **Cliente (CUSTOMER)** | Cria pedidos, acompanha os seus e cancela antes do despacho | JWT |
| **Motorista (DRIVER)** | Vê os pedidos dele, avança as etapas, registra a prova de entrega, consulta a rota e envia a posição | Basic Auth, pelo app/dispositivo |
| **Qualquer pessoa** | Consulta o andamento de um pedido pelo código de rastreio | Sem login |

## O que o produto faz

### Essencial
- Criar pedidos com origem, destino e paradas intermediárias.
- Atribuir motorista e veículo, e despachar o pedido.
- Seguir o pedido por etapas fixas (criado, despachado, a caminho, chegou, em andamento, concluído), com cancelamento e falha com motivo.
- Guardar o histórico de cada pedido (quando, onde, qual etapa).
- Registrar prova de entrega simples (código de confirmação ou nome de quem recebeu).
- Receber a posição do motorista e mostrar a última conhecida.
- Cadastrar motoristas, veículos, lugares e frotas.
- Cinco perfis com permissões separadas, e rastreio público por código.
- **Roteirização:** definir a melhor ordem das paradas de um pedido (do exato ao heurístico) e mostrar quanto se economiza em relação à ordem cadastrada.
- **Despacho em lote:** distribuir os pedidos pendentes entre os motoristas disponíveis minimizando a distância total, comparado com a estratégia gulosa.
- **Dashboard (API):** visão geral da operação, séries por dia, desempenho por motorista, economia de rotas e mapa ao vivo.

### Importante
- Eventos em tempo real por WebSocket: mudança de pedido e posição do motorista.
- Sugestão de motoristas disponíveis mais próximos de um ponto.
- **Mapa viário:** menor caminho por Dijkstra e A* num grafo importado de CSV, em vez de distância em linha reta ajustada.

### Se sobrar tempo
- Aceite ad hoc: o primeiro motorista que aceita leva o pedido, sem corrida entre dois motoristas.
- Vários pedidos por motorista (VRP por Clarke-Wright).
- Página estática do dashboard com gráficos.
- Fluxo de pedido configurável, em vez de etapas fixas.

## Regras que o produto garante

- Nenhum pedido é despachado sem motorista e veículo.
- Um motorista não fica com dois pedidos ativos ao mesmo tempo.
- Pedidos não pulam etapa: só existe transição permitida.
- Pedido com prova de entrega obrigatória não conclui sem ela.
- Todo cancelamento ou falha registra o motivo.
- Todo evento do pedido fica no histórico, e o histórico não é apagado.
- O destino e as paradas de um pedido não mudam depois de criado.
- Cliente só vê e cancela os próprios pedidos; motorista só vê os pedidos dele. O código de rastreio público não expõe dados pessoais nem coordenadas.

## Fora do escopo

Loja virtual, financeiro, estoque de armazém, IA, 2FA, webhooks, chaves de API, trânsito em tempo real, janelas de entrega, capacidade de carga, uso de bibliotecas prontas de roteirização, upload de fotos/assinaturas, vários clientes/empresas no mesmo sistema (multi-tenant) e interface gráfica. A interface virá em outro projeto e consumirá esta API.

## Como saber que está pronto

- Todo endpoint responde com o status certo no Insomnia/Postman, com uma collection exportada junto do projeto.
- Cada regra acima tem um caso de teste que falha com o código de erro esperado (422/409/404).
- Os algoritmos têm testes próprios: o exato (Held-Karp) bate com força bruta em instâncias pequenas, a busca local nunca é pior que o vizinho mais próximo, o Hungarian nunca é pior que o guloso, e A* acha o mesmo custo que Dijkstra.
- Um cliente WebSocket inscrito em um pedido recebe o evento quando o status muda.
- O fluxo completo roda de ponta a ponta: cliente cria, operador atribui e despacha, motorista avança até concluir, e o dashboard reflete tudo isso.
- Diagrama ER e fluxos ([docs/flows/](docs/flows/flow-index.md)) batem com o que foi implementado.

## Riscos

| Risco | Como lidar |
|---|---|
| Escopo crescer (o Fleetbase é enorme e agora há roteirização) | Manter a lista "Fora do escopo" e cortar o "Se sobrar tempo" primeiro |
| Grafo viário dar trabalho (dados, importação) | O modo `haversine` funciona sem ele; o mapa viário é "Importante", não "Essencial" |
| WebSocket com JWT dar trabalho | Fazer o REST completo antes; o WebSocket entra por último |
| Concorrência (dois motoristas, um pedido) | Só no modo ad hoc, que é opcional |
| Parecer cópia do Fleetbase | Citar a inspiração; a roteirização e o dashboard são contribuição própria |
| JDK diferente do pedido na disciplina | Usar JDK 21 (LTS) e avisar o professor |

## Origem e atribuição

Inspirado no Fleet-Ops do [Fleetbase](https://github.com/fleetbase/fleetbase) (AGPL-3.0). Este projeto reaproveita apenas ideias de modelo de domínio e regras de negócio, sem tradução de código. Detalhes em [CREDITS.md](CREDITS.md).

## Glossário

- **Payload:** o que será entregue e entre quais lugares (origem, destino, paradas, itens).
- **Waypoint:** parada intermediária do pedido.
- **POD (proof of delivery):** prova de entrega.
- **Tracking status:** um registro do histórico do pedido a cada mudança.
- **Pedido ativo:** pedido despachado e ainda não encerrado.
- **Public ID:** identificador legível exposto pela API (ex.: `order_x7k2m9`).
- **Roteirização:** escolher a ordem das paradas (e quem atende o quê) para gastar menos distância.
- **TSP:** problema do caixeiro-viajante, a base da ordem das paradas.
- **Algoritmo húngaro:** método exato para distribuir N tarefas entre N pessoas com custo mínimo.
- **Grafo viário:** mapa de ruas modelado como nós (cruzamentos) e arestas (trechos de rua).
