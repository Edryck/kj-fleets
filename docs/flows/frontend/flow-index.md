# Fluxos — Frontend

Como a interface web (`frontend/`) percorre a API. Cada fluxo cita os fluxos de API que consome, pelo número do [índice do backend](../backend/flow-index.md). Diagramas em Mermaid. Índice do backend em [../backend/flow-index.md](../backend/flow-index.md).

| Arquivo | Assunto | Consome (API) |
|---|---|---|
| [flow-navegacao.md](flow-navegacao.md) | Navegação por perfil, guardas e sessão | 7, 25 |
| [flow-pedido-telas.md](flow-pedido-telas.md) | Ciclo de vida do pedido em cada tela, equipe e cliente | 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 18, 21, 23 |
| [flow-mapa-ao-vivo.md](flow-mapa-ao-vivo.md) | Mapa ao vivo, STOMP e reconexão | 16, 22, 23, 24 |
| [flow-cliente.md](flow-cliente.md) | Jornada do cliente: cadastro, endereços, pedido e rastreio | 3, 7, 17, 19, 27 |

## Telas e rotas

| Rota | Tela | Perfis | Fluxo |
|---|---|---|---|
| `/login`, `/register`, `/track/:n` | S01, S02, S03 | público | [navegação](flow-navegacao.md), [cliente](flow-cliente.md) |
| `/dashboard` | S04, S05, S06, S07 | conforme o perfil | [navegação](flow-navegacao.md) |
| `/map` | S08 | equipe | [mapa](flow-mapa-ao-vivo.md) |
| `/orders`, `/orders/new`, `/orders/:id` | S09, S10, S11 | conforme o perfil | [pedido](flow-pedido-telas.md) |
| `/dispatch`, `/dashboard/dispatch`, `/routes/optimize` | S12, S05, S13 | ADMIN, DISPATCHER | [pedido](flow-pedido-telas.md) |
| `/analytics/trends`, `/analytics/routing`, `/graph` | S23, S24, S25 | conforme o perfil | [navegação](flow-navegacao.md) |
| `/my/places`, `/account` | S27, S28 | CUSTOMER, todos | [cliente](flow-cliente.md) |
