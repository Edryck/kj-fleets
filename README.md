# KJ Fleets

API REST em Java/Spring Boot para gestão de frotas e entregas: pedidos com fluxo de status, despacho, rastreamento de motoristas, eventos em tempo real e **roteirização própria** (TSP, algoritmo húngaro, Dijkstra e A*). Projeto final de matéria, inspirado no Fleet-Ops do [Fleetbase](https://github.com/fleetbase/fleetbase).

> Status: em desenvolvimento. O que está descrito abaixo é o desenho do projeto.

## Funcionalidades

- Pedidos com origem, destino e paradas, e fluxo `CREATED → DISPATCHED → DRIVER_ENROUTE → ARRIVED → IN_PROGRESS → COMPLETED` (mais `CANCELLED` e `FAILED`)
- Atribuição de motorista e veículo, despacho, aceite ad hoc (o motorista pega o pedido da fila), cancelamento com motivo e prova de entrega
- Histórico de rastreamento por pedido e rastreio público por código
- Cadastro de motoristas, veículos, lugares e frotas
- **Roteirização:** ordem das paradas (vizinho mais próximo, 2-opt, Held-Karp exato, simulated annealing), despacho em lote (húngaro vs guloso) e menor caminho no grafo viário (Dijkstra e A*)
- **Dashboard:** métricas da operação por API
- Eventos em tempo real por WebSocket (STOMP)
- Cinco perfis de usuário com JWT e Basic Auth

Mais detalhes em [PRODUCT.md](docs/PRODUCT.md). Fluxos em [docs/flows/](docs/flows/backend/flow-index.md).

## Perfis

| Perfil | Acesso | Resumo |
|---|---|---|
| `ADMIN` | JWT | Tudo, inclusive usuários e importação do grafo |
| `DISPATCHER` | JWT | Pedidos, despacho, roteirização |
| `FLEET_MANAGER` | JWT | Motoristas, veículos, frotas, dashboard |
| `CUSTOMER` | JWT | Cria e acompanha os próprios pedidos e gerencia os próprios endereços |
| `DRIVER` | Basic Auth | Vê e atualiza os pedidos atribuídos a ele (`/driver/**`) |

## Stack

Java 21, Maven, Spring Boot (Web, Data JPA, Security, WebSocket, Validation), Lombok, PostgreSQL, jjwt.

## Como rodar

Pré-requisitos: JDK 21, PostgreSQL (para rodar a aplicação) e Docker (para os testes, que sobem um PostgreSQL com Testcontainers). O Maven Wrapper (`./mvnw`) já vem no repositório.

1. Crie o banco:

   ```bash
   createdb kjfleets
   ```

2. Defina as variáveis de ambiente (o `.env.example` tem um modelo; exporte no terminal ou na configuração de execução do IntelliJ):

   | Variável | Para quê |
   |---|---|
   | `DB_URL` | ex.: `jdbc:postgresql://localhost:5432/kjfleets` |
   | `DB_USER` / `DB_PASSWORD` | acesso ao banco |
   | `JWT_SECRET` | segredo para assinar os tokens; mínimo 32 bytes, senão a aplicação não sobe |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | primeiro ADMIN, criado no startup se não houver usuários |
   | `ROUTING_MODE` | `haversine` (padrão) ou `road` |
   | `ROUTING_DETOUR_FACTOR` | fator sobre a distância em linha reta no modo `haversine` (padrão 1.3) |
   | `ROUTING_AVG_SPEED_KMH` | velocidade média para o ETA (padrão 40) |
   | `ROUTING_ARRIVAL_RADIUS_M` | raio, em metros, para o motorista concluir uma parada (padrão 200) |
   | `ROUTING_POSITION_MAX_AGE_S` | idade máxima, em segundos, da posição do motorista para contar como atual (padrão 300) |
   | `ROUTING_GRAPH_NODES` / `ROUTING_GRAPH_EDGES` | caminhos dos CSVs do grafo viário (só no modo `road`) |
   | `DASHBOARD_TIMEZONE` | fuso dos períodos do dashboard (padrão `America/Sao_Paulo`) |
   | `DASHBOARD_STALE_UNASSIGNED_MIN` | minutos sem motorista até o pedido virar alerta de parado (padrão 30) |
   | `DASHBOARD_STALE_ASSIGNED_MIN` | minutos atribuído e não despachado (padrão 15) |
   | `DASHBOARD_STALE_DISPATCHED_MIN` | minutos despachado sem o motorista sair (padrão 15) |
   | `DASHBOARD_STALE_ENROUTE_MIN` | minutos a caminho do ponto (padrão 60) |
   | `DASHBOARD_STALE_ARRIVED_MIN` | minutos no ponto sem começar a operação (padrão 20) |
   | `DASHBOARD_STALE_IN_PROGRESS_MIN` | minutos em andamento sem concluir (padrão 90) |
   | `DASHBOARD_MAINTENANCE_ALERT_DAYS` | dias em manutenção até o alerta de veículo parado (padrão 7) |
   | `WS_LOCATION_MIN_INTERVAL_S` | intervalo mínimo, em segundos, entre posições de um motorista no WebSocket (padrão 5, de 1 a 300) |
   | `WS_LOCATION_MIN_DISTANCE_M` | distância mínima, em metros, que o motorista precisa andar para a posição sair no WebSocket (padrão 20, de 0 a 1000) |
   | `CORS_ALLOWED_ORIGINS` | origens do front liberadas no REST, separadas por vírgula (ex.: `http://localhost:5173`); vazio (padrão) desliga o CORS |

3. Suba a aplicação:

   ```bash
   ./mvnw spring-boot:run
   ```

4. Rode os testes (com o Docker de pé):

   ```bash
   ./mvnw test
   ```

### Grafo viário (modo `road`, opcional)

Dois CSVs, gerados uma vez fora deste repo (por exemplo com um script Python usando osmnx):

- `nodes.csv`: `id,lat,lng`
- `edges.csv`: `from_id,to_id,length_m,oneway`

Aponte as variáveis `ROUTING_GRAPH_NODES` e `ROUTING_GRAPH_EDGES` para eles e chame `POST /graph/import` como ADMIN. No modo `haversine` nada disso é necessário.

## Rodando com Docker

```bash
cp .env.example .env        # ajuste os valores (senhas, API_PORT)
docker compose up -d        # sobe banco e API; a API responde em http://localhost:$API_PORT
docker compose up -d --build api   # depois de mudar código Java
```

Frontend em desenvolvimento (aponta o proxy do Vite para a API):

```bash
cd frontend
npm install
VITE_PROXY_TARGET=http://localhost:8081 npm run dev   # use a porta de API_PORT
```

## Autenticação

- `POST /auth/register` cria um CUSTOMER; `POST /auth/login` devolve um JWT. Envie em `Authorization: Bearer <token>`.
- `/driver/**` usa **Basic Auth** com o usuário e a senha do motorista. O motorista não recebe JWT: `POST /auth/login` responde 401 para ele.
- `PUT /me/password` troca a senha de quem está logado. Tokens já emitidos continuam válidos até expirar.
- Rastreio público (`GET /track/{trackingNumber}`) e `/auth/**` não exigem login.

## Endpoints

Resumo por grupo. A tabela completa, com o acesso de cada perfil, está em [ARCHITECTURE.md](docs/ARCHITECTURE.md#api-rest) e a matriz de permissões em [ARCHITECTURE.md](docs/ARCHITECTURE.md#perfis-e-permissões). Nas rotas, `{id}` é o `publicId`. Listagens aceitam `limit` (padrão 20, máximo 100) e `offset`.

Erros de regra de negócio voltam como `422` (ou `409`) com um código estável, por exemplo `ORDER_DISPATCH_REQUIRES_DRIVER`. O recurso de outra pessoa responde `404`.

| Grupo | Rotas |
|---|---|
| Auth e usuários | `POST /auth/register`, `POST /auth/login`, `GET /me`, `PUT /me/password`, `POST /users`, `GET /users`, `PUT /users/{id}`, `POST /users/{id}/deactivate`, `POST /users/{id}/reactivate` |
| Pedidos | `POST /orders`, `GET /orders` (filtros `status`, `driverId`, `customerId`, `active`, `from`, `to`, busca `q`, `sort` e `dir`), `GET /orders/{id}`, `GET /orders/{id}/tracking`, `POST /orders/{id}/assign`, `dispatch`, `activity`, `pod`, `cancel`, `route`, `GET /orders/{id}/route`, `POST /orders/{id}/stops/{seq}/complete` |
| Rastreio público | `GET /track/{trackingNumber}` |
| Motorista (Basic Auth) | `GET /driver/me`, `GET /driver/orders` (`?available=true` lista os pedidos sem motorista), `GET /driver/orders/{id}`, `POST /driver/orders/{id}/accept`, `activity`, `pod`, `GET /driver/orders/{id}/route`, `POST /driver/orders/{id}/stops/{seq}/complete`, `POST /driver/location` |
| Cadastros | CRUD de `/drivers`, `/vehicles`, `/fleets`, `/places` (`DELETE` desativa, não apaga); busca `q`, `status` e `includeInactive` em motoristas e veículos; reativação com `POST /{id}/reactivate` (motoristas, veículos e lugares); `GET /drivers/nearest`; `GET /customers` e `GET /customers/{id}` (só leitura); `/customer/places` (meus endereços, CUSTOMER) |
| Roteirização | `POST /routes/optimize`, `POST /dispatch/plan`, `GET /graph/shortest-path`, `POST /graph/import` |
| Dashboard (tópicos) | `GET /dashboard/orders/summary`, `orders/funnel`, `dispatch/queue`, `fleet/status`, `drivers/performance`, `routing/savings`, `trends/yearly`, `alerts` (`period`: `today`, `7d`, `15d`, `1m`) |
| Dashboard (painéis) | `GET /dashboard/admin`, `/dashboard/dispatch`, `/dashboard/fleet`, `/customer/dashboard` (CUSTOMER), `/driver/dashboard` (Basic Auth do motorista) |

## WebSocket

STOMP sobre WebSocket puro (sem SockJS) em `ws://localhost:8080/ws`. Não é preciso login separado: o JWT vai no header `Authorization` do frame `CONNECT`, e o token vale 8 horas. Quando ele vencer, a conexão é fechada e o cliente deve logar de novo e recarregar o estado por REST (não há replay).

Tópicos:

| Tópico | Quem assina | O que chega |
|---|---|---|
| `/topic/fleet/locations` | ADMIN, DISPATCHER, FLEET_MANAGER | posição e status dos motoristas (com throttle) |
| `/topic/orders` | ADMIN, DISPATCHER, FLEET_MANAGER | mudanças de pedido, para atualizar a fila |
| `/topic/orders/{publicId}` | equipe, ou o CUSTOMER dono do pedido | status, ETA e paradas do pedido (sem posição do motorista) |

O cliente só envia `SUBSCRIBE`. Qualquer outro comando, inclusive `SEND`, é recusado. Cada assinatura é checada no banco, e o payload de cada tópico está em [ARCHITECTURE.md](docs/ARCHITECTURE.md#websocket).

Exemplo com `@stomp/stompjs` (cliente do navegador ou Node):

```js
import { Client } from '@stomp/stompjs';

const client = new Client({
  brokerURL: 'ws://localhost:8080/ws',
  connectHeaders: { Authorization: `Bearer ${token}` },
  onConnect: () => {
    client.subscribe('/topic/orders/order_abc123', (msg) => console.log(JSON.parse(msg.body)));
  },
});
client.activate();
```

Para a equipe, troque o destino por `/topic/fleet/locations` ou `/topic/orders`. O `publicId` do pedido vem na resposta de `POST /orders`.

## Simulador de motoristas

`scripts/DriverSimulator.java` faz motoristas andarem pelos pedidos deles, pela mesma API do app do motorista (Basic Auth). Serve para a apresentação e não tem dependência além do JDK.

Antes de rodar, a equipe precisa atribuir motorista e veículo e despachar o pedido (ou o motorista aceita um pedido da fila). O simulador só toca os pedidos ativos do motorista (`DISPATCHED`, `DRIVER_ENROUTE`, `ARRIVED`, `IN_PROGRESS`). Com a API no ar:

```bash
java scripts/DriverSimulator.java --drivers motorista1:senha1,motorista2:senha2 --speed 40 --tick 2
```

| Opção | Padrão | Para quê |
|---|---|---|
| `--base` | `http://localhost:8080` | URL da API |
| `--drivers` | obrigatório | `usuario:senha` de cada motorista, separados por vírgula |
| `--speed` | 40 | velocidade em km/h |
| `--tick` | 2 | segundos entre um ping e outro |
| `--help` | | mostra a ajuda |

Cada motorista roda numa thread virtual. Ele envia posições em linha reta até os pontos da rota, conclui a parada quando chega a 50 m do ponto e finaliza o pedido (com um POD de texto, se for exigido). Pedido sem rota gravada vai direto de coleta para entrega. Para ver o mapa se mover, abra uma conexão STOMP como equipe em paralelo. Ctrl+C encerra.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [PRODUCT.md](docs/PRODUCT.md) | Para quem é, o que faz e o que fica de fora |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Camadas, domínio, regras, roteirização, API, segurança e banco |
| [SYSTEM.md](docs/SYSTEM.md) | Regras e padrões de código |
| [DESIGN.md](docs/DESIGN.md) | Design visual (a preencher quando o frontend começar) |
| [docs/domain.md](docs/domain.md) | Diagrama ER e dicionário das tabelas |
| [docs/flows/](docs/flows/backend/flow-index.md) | Fluxos em Mermaid |
| [docs/kjfleets.postman_collection.json](docs/kjfleets.postman_collection.json) | Collection para testar a API (importa no Postman e no Insomnia) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Como contribuir |
| [SECURITY.md](SECURITY.md) | Como reportar vulnerabilidade |
| [CREDITS.md](docs/CREDITS.md) | Fontes, referências e atribuição |

## Contribuindo e segurança

Projeto acadêmico, mas contribuições são bem-vindas: veja [CONTRIBUTING.md](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md). Achou uma falha de segurança? Siga o [SECURITY.md](SECURITY.md), sem abrir issue pública.

## Licença

[MIT](LICENSE).

## Créditos

Inspirado no [Fleetbase](https://github.com/fleetbase/fleetbase) (AGPL-3.0). Este projeto reaproveita apenas ideias de modelo de domínio e regras de negócio, sem tradução de código. A roteirização e o dashboard são contribuição própria. Detalhes e referências em [CREDITS.md](docs/CREDITS.md).
