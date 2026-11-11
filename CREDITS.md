# CREDITS.md

## Inspiração

- **[Fleetbase](https://github.com/fleetbase/fleetbase)**, módulo Fleet-Ops: de onde vêm as ideias de modelo de domínio (pedido, payload, lugar, motorista, veículo, frota, status de rastreamento) e as regras de negócio. Licença do Fleetbase: **AGPL-3.0**.
  Este projeto **não copia nem traduz código** do Fleetbase: reaproveita só conceitos de domínio e regras, escritos do zero. Mesmo assim, não é afiliado ao Fleetbase nem endossado por ele.
- Pacote da API do Fleet-Ops: <https://packagist.org/packages/fleetbase/fleetops-api>
- Orders API (OpenAPI): <https://apis.io/apis/fleetbase/fleetbase-orders-api/>

## Referências não oficiais

Specs de terceiros (ai-fdl-kit), usadas como apoio ao fluxo e às regras do pedido. Não são fonte canônica do Fleetbase.
- Ciclo de vida do pedido: <https://theunsbarnardt.github.io/ai-fdl-kit/blueprints/workflow/order-lifecycle/>
- Fluxo do app do motorista: <https://theunsbarnardt.github.io/ai-fdl-kit/api/blueprints/workflow/driver-app-flow.json>

## Contribuição própria

Roteirização (ordem das paradas, despacho em lote, menor caminho), dashboard, API do motorista com Basic Auth e a divisão em perfis são desenho deste projeto.

## Algoritmos

Implementados à mão a partir das descrições clássicas:
- Held, M.; Karp, R. (1962), programação dinâmica para o caixeiro-viajante (`HELD_KARP`)
- Croes, G. A. (1958), troca 2-opt (`TWO_OPT`)
- Kirkpatrick, S.; Gelatt, C.; Vecchi, M. (1983), simulated annealing (`SIMULATED_ANNEALING`)
- Kuhn, H. (1955), método húngaro (`HUNGARIAN`)
- Dijkstra, E. (1959) e Hart, P.; Nilsson, N.; Raphael, B. (1968), caminho mínimo e A* (`DIJKSTRA`, `ASTAR`)

## Bibliotecas e ferramentas

Spring Boot (Web, Data JPA, Security, WebSocket, Validation), Lombok, driver JDBC do PostgreSQL, jjwt, PostgreSQL, Maven. Cada uma segue a própria licença; as versões estão no `pom.xml`.
Opcionais: Chart.js (página estática do dashboard) e osmnx (script externo que gera os CSVs do grafo viário).

## Design

O estudo de telas segue regras de UI do projeto [antislop-ui / anti-slop](https://github.com/miqdadbadjuber/anti-slop) (miqdadbadjuber). Tipografia do estudo: IBM Plex (SIL Open Font License 1.1).

## Ferramentas de IA

Partes do projeto (documentação, estudo de telas e rascunhos) foram feitas com apoio do Claude (Anthropic). O autor revisa e responde pelo que está no repositório.
