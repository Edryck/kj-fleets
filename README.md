# KJ Fleets

API REST em Java/Spring Boot para gestão de frotas e entregas: pedidos com fluxo de status, despacho, rastreamento de motoristas, eventos em tempo real e **roteirização própria** (TSP, algoritmo húngaro, Dijkstra e A*). Projeto final de matéria, inspirado no Fleet-Ops do [Fleetbase](https://github.com/fleetbase/fleetbase).

> Status: em desenvolvimento. O que está descrito abaixo é o desenho do projeto.

## Funcionalidades

- Pedidos com origem, destino e paradas, e fluxo `CREATED → DISPATCHED → DRIVER_ENROUTE → ARRIVED → IN_PROGRESS → COMPLETED` (mais `CANCELLED` e `FAILED`)
- Atribuição de motorista e veículo, despacho, cancelamento com motivo e prova de entrega
- Histórico de rastreamento por pedido e rastreio público por código
- Cadastro de motoristas, veículos, lugares e frotas
- **Roteirização:** ordem das paradas (vizinho mais próximo, 2-opt, Held-Karp exato, simulated annealing), despacho em lote (húngaro vs guloso) e menor caminho no grafo viário (Dijkstra e A*)
- **Dashboard:** métricas da operação por API
- Eventos em tempo real por WebSocket (STOMP)
- Cinco perfis de usuário com JWT e Basic Auth

Mais detalhes em [PRODUCT.md](PRODUCT.md). Fluxos em [docs/flows.md](docs/flows.md).

## Perfis

| Perfil | Acesso | Resumo |
|---|---|---|
| `ADMIN` | JWT | Tudo, inclusive usuários e importação do grafo |
| `DISPATCHER` | JWT | Pedidos, despacho, roteirização |
| `FLEET_MANAGER` | JWT | Motoristas, veículos, frotas, dashboard |
| `CUSTOMER` | JWT | Cria e acompanha os próprios pedidos |
| `DRIVER` | Basic Auth | Vê e atualiza os pedidos atribuídos a ele (`/driver/**`) |

## Stack

Java 21, Maven, Spring Boot (Web, Data JPA, Security, WebSocket, Validation), Lombok, PostgreSQL, jjwt.

## Como rodar

Pré-requisitos: JDK 21, Maven e PostgreSQL.

1. Crie o banco:

   ```bash
   createdb kjfleets
   ```

2. Defina as variáveis de ambiente (o `.env.example` tem um modelo; exporte no terminal ou na configuração de execução do IntelliJ):

   | Variável | Para quê |
   |---|---|
   | `DB_URL` | ex.: `jdbc:postgresql://localhost:5432/kjfleets` |
   | `DB_USER` / `DB_PASSWORD` | acesso ao banco |
   | `JWT_SECRET` | segredo para assinar os tokens |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | primeiro ADMIN, criado no startup se não houver usuários |
   | `ROUTING_MODE` | `haversine` (padrão) ou `road` |
   | `ROUTING_DETOUR_FACTOR` | fator sobre a distância em linha reta no modo `haversine` (padrão 1.3) |
   | `ROUTING_AVG_SPEED_KMH` | velocidade média para o ETA (padrão 40) |
   | `ROUTING_GRAPH_NODES` / `ROUTING_GRAPH_EDGES` | caminhos dos CSVs do grafo viário (só no modo `road`) |

3. Suba a aplicação:

   ```bash
   mvn spring-boot:run
   ```

4. Rode os testes:

   ```bash
   mvn test
   ```

### Grafo viário (modo `road`, opcional)

Dois CSVs, gerados uma vez fora deste repo (por exemplo com um script Python usando osmnx):

- `nodes.csv`: `id,lat,lng`
- `edges.csv`: `from_id,to_id,length_m,oneway`

Aponte as variáveis `ROUTING_GRAPH_NODES` e `ROUTING_GRAPH_EDGES` para eles e chame `POST /graph/import` como ADMIN. No modo `haversine` nada disso é necessário.

## Autenticação

- `POST /auth/register` cria um CUSTOMER; `POST /auth/login` devolve um JWT. Envie em `Authorization: Bearer <token>`.
- `/driver/**` usa **Basic Auth** com o usuário e a senha do motorista.
- Rastreio público (`GET /track/{trackingNumber}`) e `/auth/**` não exigem login.

## Endpoints

Resumo por grupo. A tabela completa, com o acesso de cada perfil, está em [ARCHITECTURE.md](ARCHITECTURE.md#api-rest) e a matriz de permissões em [ARCHITECTURE.md](ARCHITECTURE.md#perfis-e-permissões). Nas rotas, `{id}` é o `publicId`.

Erros de regra de negócio voltam como `422` (ou `409`) com um código estável, por exemplo `ORDER_DISPATCH_REQUIRES_DRIVER`. O recurso de outra pessoa responde `404`.

| Grupo | Rotas |
|---|---|
| Auth e usuários | `POST /auth/register`, `POST /auth/login`, `POST /users`, `GET /users` |
| Pedidos | `POST /orders`, `GET /orders`, `GET /orders/{id}`, `GET /orders/{id}/tracking`, `POST /orders/{id}/assign`, `dispatch`, `activity`, `pod`, `cancel`, `route`, `GET /orders/{id}/route` |
| Rastreio público | `GET /track/{trackingNumber}` |
| Motorista (Basic Auth) | `GET /driver/orders`, `POST /driver/orders/{id}/accept`, `activity`, `pod`, `GET /driver/orders/{id}/route`, `POST /driver/location` |
| Cadastros | CRUD de `/drivers`, `/vehicles`, `/fleets`, `/places`; `GET /drivers/nearest` |
| Roteirização | `POST /routes/optimize`, `POST /dispatch/plan`, `GET /graph/shortest-path`, `POST /graph/import` |
| Dashboard | `GET /dashboard/summary`, `orders-timeseries`, `drivers-performance`, `routing-savings`, `live` |

## WebSocket

- Endpoint STOMP: `/ws` (o JWT vai no header `Authorization` do frame `CONNECT`)
- `/topic/orders/{publicId}`: mudanças do pedido (`order.updated`)
- `/topic/drivers/{publicId}/location`: posição do motorista
- A equipe assina qualquer tópico; o cliente só os dos próprios pedidos. O motorista não usa WebSocket.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Para quem é, o que faz e o que fica de fora |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Camadas, domínio, regras, roteirização, API, segurança e banco |
| [SYSTEM.md](SYSTEM.md) | Regras e padrões de código |
| [DESIGN.md](DESIGN.md) | Design visual (a preencher quando o frontend começar) |
| [docs/domain.md](docs/domain.md) | Diagrama ER e dicionário das tabelas |
| [docs/flows.md](docs/flows.md) | Fluxos em Mermaid |
| [docs/kjfleets.postman_collection.json](docs/kjfleets.postman_collection.json) | Collection para testar a API (importa no Postman e no Insomnia) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Como contribuir |
| [SECURITY.md](SECURITY.md) | Como reportar vulnerabilidade |
| [CREDITS.md](CREDITS.md) | Fontes, referências e atribuição |

## Contribuindo e segurança

Projeto acadêmico, mas contribuições são bem-vindas: veja [CONTRIBUTING.md](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md). Achou uma falha de segurança? Siga o [SECURITY.md](SECURITY.md), sem abrir issue pública.

## Licença

[MIT](LICENSE).

## Créditos

Inspirado no [Fleetbase](https://github.com/fleetbase/fleetbase) (AGPL-3.0). Este projeto reaproveita apenas ideias de modelo de domínio e regras de negócio, sem tradução de código. A roteirização e o dashboard são contribuição própria. Detalhes e referências em [CREDITS.md](CREDITS.md).
