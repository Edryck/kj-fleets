# Fluxos — Frontend

Como a interface web (`frontend/`) percorre a API. Cada fluxo cita os fluxos de API que consome, pelo número do [índice do backend](../backend/flow-index.md). Diagramas em Mermaid. Índice do backend em [../backend/flow-index.md](../backend/flow-index.md).

| Arquivo | Assunto | Consome (API) |
|---|---|---|
| [flow-navegacao.md](flow-navegacao.md) | Navegação por perfil, guardas, sessão, shell e faixas de largura | 7, 15, 16, 19, 20, 25 |
| [flow-pedido-telas.md](flow-pedido-telas.md) | Ciclo de vida do pedido em cada tela, equipe e cliente | 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 18, 21, 23 |
| [flow-mapa-ao-vivo.md](flow-mapa-ao-vivo.md) | Mapa ao vivo, `?driver=`, STOMP e reconexão | 16, 22, 23, 24 |
| [flow-cliente.md](flow-cliente.md) | Jornada do cliente: cadastro, endereços, pedido e rastreio | 3, 7, 10, 16, 17, 19, 22, 23, 25, 27 |

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

## Composição das telas

As telas usam as mesmas peças. O fundo é um destes três:

- **Mapa contínuo** (`MapStage`): um mapa só, montado no Shell para a equipe, atrás das telas imersivas. Cada tela publica a sua cena (`useMapScene`), e a câmera viaja de uma cena para a outra sem recarregar o mapa. As telas imersivas estão em `frontend/src/map/immersive.ts`.
- **Fundo ambiente**: gradientes e curvas de nível parados, nas telas sem mapa. O cliente sempre usa este fundo.
- **Mapa estático**: mapa plano, sem interação, atrás do cartão de login e de cadastro.

Sobre o fundo, as informações ficam em:

- **bloco de título**, no canto superior esquerdo: chip de conexão ("Tempo real", "Reconectando" ou "Offline"), link de volta quando existe, título, metadados e ações;
- **barra de comando**, uma pílula de vidro no topo, com busca, filtros ou o algoritmo;
- **painel esquerdo** e **painel direito**, colunas de vidro presas às bordas;
- **faixa inferior**, blocos de vidro na base da tela;
- **cartões**, como o `VehicleCard`, o cartão do motorista escolhido e os cartões de pedido;
- **`SidePanel`**, o painel de detalhe, criação ou edição que abre à direita de uma lista;
- **`BottomSheet`**, a folha inferior que recebe o painel direito do Mapa ao vivo no tablet e no celular.

| Tela | Fundo | Onde está cada informação | O que abre o `SidePanel` |
|---|---|---|---|
| Dashboards da equipe (S04 a S06) | mapa contínuo | Número de destaque sobre o céu, painel direito (frota, motoristas, alertas) e faixa inferior com os painéis do perfil | — |
| Mapa ao vivo (S08) | mapa contínuo | Barra de comando, painel direito com o cartão do motorista e a lista, faixa inferior com "Frota agora", "Sem sinal" e "Legenda" | — |
| Lista de pedidos (S09) | fundo ambiente | Barra de filtros com contagem por status e tabela | Clique na linha: prévia do pedido |
| Novo pedido (S10) | fundo ambiente | Seções de vidro (Cliente, Rota, Itens da carga, Opções) e o mapa em vidro ao lado | — |
| Detalhe do pedido, equipe (S11) | mapa contínuo | Painel esquerdo, coluna direita e faixa inferior da rota | — |
| Detalhe do pedido, cliente (S11) | fundo ambiente | Duas colunas de cartões | — |
| Despacho (S12) | mapa contínuo | Barra de comando, painel esquerdo com a fila e faixa inferior com o plano | — |
| Simulador de rota (S13) | mapa contínuo | Barra de comando, painel esquerdo com os pontos e painel direito com o resultado | — |
| Motoristas | fundo ambiente | Barra de filtros e tabela | Clique na linha: detalhe; "Editar" e "Novo motorista": formulário |
| Detalhe do motorista | fundo ambiente | Duas colunas de cartões, com `VehicleCard` e a última posição | "Editar": formulário |
| Veículos | fundo ambiente | Barra de filtros e garagem de cartões com o render | Clique no cartão: detalhe; "Editar" e "Novo veículo": formulário |
| Frotas e detalhe da frota | fundo ambiente | Cartões de frota; no detalhe, mapa em vidro com os membros | Clique no cartão: membros; "Editar" e "Nova frota": formulário |
| Lugares e Meus endereços (S27) | fundo ambiente | Lista de lugares ao lado do mapa em vidro | "Editar" e "Novo": formulário, com escolha do ponto no mapa |
| Clientes | fundo ambiente | Contagem e busca no topo, tabela só de consulta | Clique na linha: dados do cliente e "Ver pedidos" |
| Usuários | fundo ambiente | Contagem por perfil em pílulas e tabela | Clique na linha: perfil e desativação; "Novo usuário": formulário |
| Minha conta (S28) | fundo ambiente | Cartão com os dados e a figura do perfil, cartão de troca de senha | — |

Exclusões e desativações pedem confirmação em modal opaco, nunca no `SidePanel`.
