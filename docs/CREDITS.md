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

## Bibliotecas e ferramentas

Spring Boot (Web, Data JPA, Security, WebSocket, Validation), GraphHopper (Apache-2.0, roteamento pelas ruas no modo road), Lombok, driver JDBC do PostgreSQL, jjwt, PostgreSQL, Maven. Cada uma segue a própria licença; as versões estão no `pom.xml`.
Opcional: Chart.js (página estática do dashboard).

## Dados de mapa

No modo `road`, o grafo viário vem do extrato da região Sul do Brasil da [Geofabrik](https://download.geofabrik.de/south-america/brazil.html), baixado em runtime (fora do Git). Dados © contribuidores do [OpenStreetMap](https://www.openstreetmap.org/copyright), sob a [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Os testes usam um mapa sintético escrito à mão, sem atribuição necessária.

## Mapa e imagens

- **OpenFreeMap / OpenStreetMap:** o estilo vetorial `liberty` e os tiles do mapa do frontend vêm do [OpenFreeMap](https://openfreemap.org/). Dados © contribuidores do [OpenStreetMap](https://www.openstreetmap.org/copyright), sob a ODbL 1.0.
- **Terrain Tiles da AWS (Mapzen):** o relevo 3D usa os tiles `terrarium` do [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), com a atribuição das fontes descrita em <https://github.com/tilezen/joerd/blob/master/docs/attribution.md>.
- **IBGE, malha dos estados:** o contorno de PR, SC e RS da máscara dos mapas (`frontend/src/map/southStates.json`) vem da [API de malhas do IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3) (qualidade intermediária), com união, folga de ~6 km e simplificação. Dados públicos do IBGE.
- **Renders de veículos:** imagens próprias do caminhão e da van, geradas em Three.js com o estúdio em `docs/design/vehicle-studio.html`. Não vêm de banco de imagens.

## Design

O estudo de telas segue regras de UI do projeto [antislop-ui / anti-slop](https://github.com/miqdadbadjuber/anti-slop) (miqdadbadjuber). Tipografia do estudo: IBM Plex (SIL Open Font License 1.1).

## Ferramentas de IA

Partes do projeto (documentação, estudo de telas e rascunhos) foram feitas com apoio do Claude (Anthropic). O autor revisa e responde pelo que está no repositório.
