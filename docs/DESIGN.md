# DESIGN.md — KJ Fleets

Documento vivo do design do frontend. Vale para toda tela nova ou refeita.

## 1. Direção

O KJ Fleets é uma plataforma geoespacial de logística com acabamento de produto comercial premium, no padrão Apple. O território é o ambiente da operação: o mapa ocupa a tela, e os dados e os controles flutuam sobre ele em vidro líquido, numa experiência só. Nas telas sem mapa, um fundo ambiente com curvas de nível faz esse papel.

### 1.1 Referências e o que cada uma trouxe

| Referência | O que entra no produto |
|---|---|
| ShotScope e GolfX | Mapa em tela cheia, painéis flutuantes translúcidos, navegação compacta, contraste entre superfícies escuras e elementos luminosos, verde-limão como destaque |
| Widget escuro com linha do tempo vertical tracejada | Linha do tempo de paradas do detalhe do pedido e mini-rota dos cartões do despacho |
| HUD "Travel time" | Rótulos HUD com haste sobre o mapa: "Sem sinal", "Próxima parada", "Parado" |
| Mapa 3D com cartão de vidro e numerais grandes e finos | Número de destaque ultrafino do dashboard sobre o relevo e ETA ultrafino |
| Painel "Tracking" com cartões de caminhão | Cartão do veículo no detalhe do pedido e cartões da tela Veículos |
| Analytics de vidro | Funil em matriz de pontos e doca inferior de painéis |
| Fleetory, claro, com render de caminhão | Renders de veículos e acabamento do tema claro |
| Apple | Fonte SF Pro, movimento com mola, vidro líquido |

### 1.2 Ponto de vista de cada tela

As telas falam a mesma língua, mas cada uma tem uma ideia de composição própria.

| Tela | Ponto de vista |
|---|---|
| Dashboard | Vista aérea: relevo em 3D até o horizonte, com o número de destaque em tipografia grande sobre o céu |
| Detalhe do pedido | Câmera de acompanhamento: o mapa segue o veículo pela rota, com um cartão de produto do veículo |
| Despacho | Mesa de planejamento: mapa plano, visto de cima, com os arcos do plano |
| Veículos | Garagem: sem mapa, cartões com os renders dos veículos |
| Mapa ao vivo | Operação: lista de motoristas, filtros e mapa em tempo real |
| Pedidos | Mesa de pedidos: contagem por status na barra de filtros, tabela e prévia no `SidePanel` |
| Novo pedido | A rota sendo montada: as paradas formam uma linha do tempo que cresce, com o mapa em vidro ao lado |
| Simulador de rota | Laboratório sobre o mapa plano: pontos marcados com o clique e resultado contra a ordem original |
| Área do cliente | Sem mapa: cartões por entrega, com status grande, ETA e paradas |

Toda tela nova escreve o seu ponto de vista em uma linha antes de ser desenhada. Uma tela que só troca as cores de uma tabela não está pronta.

## 2. Tokens

Os tokens ficam em `frontend/src/styles/tokens.css`. O tema escuro é o padrão (`:root` e `[data-theme="dark"]`) e o claro fica em `[data-theme="light"]`.

### 2.1 Cores

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--color-bg` | `#0c1511` | `#e8ede4` | Fundo de base |
| `--color-text` | `#eef4ec` | `#16211a` | Texto principal |
| `--color-text-muted` | `#9fb2a5` | `#56665b` | Texto secundário |
| `--color-text-subtle` | `#82978a` | `#5d6c62` | Metadados |
| `--color-link` | `#b7f52a` | `#3f6b08` | Links de texto |
| `--color-accent` | `#b7f52a` | `#b7f52a` | Verde-limão: ação principal, seleção, atividade |
| `--color-accent-ink` | `#13200a` | `#13200a` | Texto sobre limão |
| `--color-accent-soft` | limão a 14% | verde a 16% | Fundo de seleção e anel de foco de campo |
| `--color-active-bg` / `--color-active-ink` | limão / `#13200a` | `#16211a` / `#f4f8f1` | Item ativo de navegação e segmento. No claro vira pílula grafite |
| `--color-route` | `#b7f52a` | `#5f9410` | Linha da rota pelas ruas |
| `--color-route-casing` | `#0b1410` | `#ffffff` | Contorno da rota e dos marcadores |
| `--color-success` | `#5ed3a2` | `#126e48` | Disponível e concluído. Verde-menta, distinto do limão |
| `--color-warning` | `#f2b84b` | `#875800` | Ocupado, atenção, trecho estimado |
| `--color-danger` | `#f47272` | `#b33535` | Falha, cancelamento, erro |
| `--color-info` | `#7cc4e8` | `#226a94` | Informação neutra, etapa "Despachado" do funil |
| `--color-offline` | `#7d9184` | `#5c6b61` | Sem sinal |
| `--color-fill` / `--color-fill-hover` | branco 6% / 10% | grafite 5% / 9% | Preenchimento chapado dentro do vidro |
| `--color-solid-raised` | `#17251d` | `#fbfcf9` | Popover, tooltip, modal, drawer, toast, menu lateral expandido |
| `--color-pill-bg` / `--color-pill-ink` | `#f4f8f1` / `#142019` | `#ffffff` / `#16211a` | Pílulas de distância e marcador de retirada |
| `--color-brand-orange` | `#ff6a00` | `#ff6a00` | Laranja institucional: só no selo "KJ", no logotipo e no favicon |
| `--color-scrim` | preto a 55% | preto a 55% | Véu atrás da gaveta do menu no celular e dos modais |

O limão nunca comunica sucesso, e o verde-menta nunca comunica ação. Status sempre leva rótulo em português.

Tokens de cena, por tema: `--color-hud-line`, `--color-hud-bg`, `--color-dot`, `--color-contour`, `--color-amb-a`, `--color-amb-b`, `--color-spot` (halo radial atrás dos renders e dos estados vazios), `--color-hero-shadow` e `--color-vignette`.

### 2.2 Vidro

`--glass-tint-regular`, `--glass-tint-clear`, `--glass-rim-a`, `--glass-rim-b`, `--glass-rim-c`, `--glass-sheen`, `--glass-light`, `--glass-light-hover`, `--glass-shadow` e `--glass-bright`, com valores próprios em cada tema.

### 2.3 Forma e movimento

| Token | Valor |
|---|---|
| `--radius-panel` | 22 px: painéis e cartões de vidro |
| `--radius-tile` | 16 px: blocos internos, toasts e popovers |
| `--radius-card` / `--radius-control` | 16 px / 12 px |
| `--radius-pill` | 999 px: botões, segmentos, pílulas de status |
| `--control-height` | 40 px |
| `--ease-spring` | mola em `linear()` sem repique perceptível, para entradas e mudanças de layout |
| `--ease-spring-bouncy` | mola com repique, para elementos pequenos que aparecem (pontos, marcadores) |
| `--ease-out` | `cubic-bezier(.2, .8, .2, 1)` |
| `--motion-fast` / `--motion-base` | 140 ms / 220 ms, para hover e cor |

### 2.4 Aliases das telas antigas

Os aliases de transição (`--color-background`, `--color-surface`, `--color-surface-raised`, `--color-surface-muted`, `--color-border`, `--color-primary`, `--color-primary-hover`, `--color-primary-soft`, `--color-on-primary`, `--font-heading` e `--color-brand-graphite/white/gray`) saíram com a última tela antiga. `tokens.test.ts` garante que eles não voltam. Para texto de link, use `--color-link`, que no tema claro é verde-escuro, porque limão como texto sobre fundo claro é ilegível.

## 3. Tipografia

A fonte do sistema da Apple não pode ser empacotada, por licença. A pilha usa a do sistema e cai para Inter (`@fontsource/inter`, pesos 200 a 700) fora dos aparelhos Apple.

| Papel | Token | Pilha |
|---|---|---|
| Display | `--font-display` | `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif` |
| Interface | `--font-ui` | `"SF Pro Text", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif` |
| Dados | `--font-mono` | `"SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |

Display vai em títulos e números grandes. Interface vai em texto, rótulos, botões e tabelas. Dados vai em placas, códigos de rastreio, coordenadas, quilometragens e contagens em filtros. Todo o app usa algarismos tabulares (`font-feature-settings: "tnum"`).

| Nível | Tamanho / peso / espaçamento |
|---|---|
| Número de destaque do dashboard | 148 px, peso 200, −0,055 em; a unidade em 52 px, peso 200. No dashboard, cai para 112 px abaixo de 1280 px e para 88 px abaixo de 768 px |
| Título de tela | 46 px, peso 500, −0,025 em; 32 px abaixo de 768 px |
| Status grande (detalhe e prévia do pedido) | 30 px, peso 500, −0,025 em; 38 px no detalhe do pedido do cliente |
| Números secundários (estatísticas, ETA) | 34–46 px, peso 200, −0,03 em, com unidade em 13 px |
| Título de painel | 15 px, peso 600; 18 px, peso 500, Display, nos painéis sobre o mapa (dashboards e Mapa ao vivo); 17 px, peso 600, no `SidePanel` |
| Rótulo pequeno em caixa alta (`.micro`) | 10,5 px, peso 600, +0,14 em |
| Texto | 13–14 px |
| Placa em destaque | mono, peso 600: 26 px e +0,06 em no `VehicleCard`, 20 px e +0,05 em no cartão da garagem, 40 px e +0,04 em no detalhe do veículo |

## 4. Vidro líquido

O componente é `Glass` (`frontend/src/glass/Glass.tsx`). O motor de refração fica em `liquidGlass.ts` (funções puras) e em `glassRegistry.ts` (filtros SVG). O `<GlassDefs />` é montado uma vez no `App`. As classes são `.glass`, `.glass-regular`, `.glass-clear`, `.glass-press` e `.glass-flat`.

1. **Onde há vidro:** em todo elemento que flutua diretamente sobre o mapa ou sobre o fundo ambiente. Isso inclui menu lateral, barras de comando, botões redondos, chip do usuário, painéis, blocos de indicadores, controles do mapa, bottom sheets, cartões de veículo e o cartão de login. A única exceção é o número de destaque do dashboard, que é tipografia sobre um degradê. Abaixo de 768 px, o menu lateral vira gaveta opaca (`--color-solid-raised`) e o `SidePanel` vira tela cheia opaca (`--color-bg`), ambos sem vidro.
2. **Sem vidro sobre vidro.** Dentro de um vidro, tudo é chapado (`--color-fill`), sem blur, refração ou brilho: blocos de dados, linhas, segmentos, botões internos, campos e cabeçalhos de tabela. Um `Glass` dentro de outro renderiza chapado sozinho e avisa no console em desenvolvimento. Popovers, tooltips, menus, modais, drawers, toasts e o menu lateral expandido, que podem cair sobre um vidro, usam `--color-solid-raised` opaco.
3. **Duas variantes:**
   - `regular`, para superfícies com texto: tinta mais forte, blur de 4,5 px;
   - `clear`, para controles só de ícone: tinta leve, blur de 0,6 px e lente mais forte.
4. **Pipeline (Chromium):** `backdrop-filter: blur(Npx) saturate(1.5) url(#kj-glass-N)`. O blur fica no CSS, que é acelerado e vem antes da refração. O filtro SVG tem:
   - `feImage` com o mapa de deslocamento;
   - `feDisplacementMap` com escala igual a 2 × o deslocamento máximo × o fator de refração;
   - `feImage` com o mapa especular;
   - especular colorido: o fundo refratado saturado (4 a 5 vezes), recortado pelo alfa especular e mesclado em `screen`;
   - um especular branco por cima, mesclado em `screen`.
5. **Refração física:** perfil "convex squircle" `y = (1 − (1 − x)^4)^(1/4)`, índice 1,5 e lei de Snell. O deslocamento numa distância x do bisel é `h(x) · tan(θ1 − θ2)`, com `θ1 = atan(|h'(x)|)` e `sin θ2 = sin θ1 / 1,5`.
   - As magnitudes são calculadas uma vez, em 128 amostras, e normalizadas pelo máximo.
   - O vetor aponta para dentro, perpendicular à borda. Nas curvas dos cantos, é radial ao centro da curva.
   - A codificação é `R = 128 + x·127` e `G = 128 + y·127`, com 128 como neutro.
   - Parâmetros: o `regular` tem bisel de 26 px (no máximo 30% do menor lado) e espessura 46; o `clear` tem bisel de 42% do menor lado e espessura 34.
6. **Brilho especular:** luz de contorno vinda de −125° (canto superior esquerdo), com 55% de intensidade no lado oposto. Um traço nítido de cerca de 1 px soma-se a um brilho interno suave de cerca de 6 px.
7. **Proibido:** dispersão cromática. Ela derrubava o mapa de 60 para 27 fps.
8. **Interação:**
   - botões de vidro (`press`) afundam a 0,93 e voltam com mola;
   - um brilho radial acompanha o ponteiro na superfície (`--mx` e `--my`).
9. **Alternativas:**
   - fora do Chromium: blur, saturação, tinta e um contorno em gradiente desenhado em CSS (`::before` com máscara);
   - com `prefers-reduced-transparency: reduce`: superfície opaca em `--color-solid-raised`.
10. **Mapas por tamanho:** os mapas acompanham o tamanho do elemento. Botões, chips e qualquer elemento abaixo de 20 000 px² usam mapa no tamanho exato. Painéis maiores usam mapa em meia resolução (`MAP_SCALE`, primeiro corte da regra 13), gerado direto em meia resolução com o brilho da borda calculado como média de cada pixel do mapa. Em Retina, a diferença para o mapa cheio não passa de 20/255 em 0,002% dos pixels. Há cache pela chave `variante:LxA:raio`, de modo que elementos iguais compartilham o mesmo filtro. Um `ResizeObserver` mede no primeiro quadro e, depois, regenera só 160 ms após o tamanho assentar. Assim, uma lista que encolhe com animação ou uma janela redimensionada não gera um filtro por quadro.
11. **Nada se move sem parar atrás do vidro.** Sempre que o fundo muda, o filtro recalcula naquele quadro. Medições com Chrome a 1440 × 900:
    - fundo com curvas de nível derivando atrás dos cartões: 25 fps; parado: 61 fps;
    - dashboard com órbita contínua da câmera: 44 fps; a mesma órbita sem refração: 60 fps; o relevo em 3D não custou quadros;
    - cometas do despacho em laço infinito: 25 fps.

    Por isso, atrás do vidro só há movimento finito: transições de câmera, giros de entrada, desenho de rota, resposta a um gesto do usuário ou a uma posição real que chegou. As únicas animações infinitas permitidas são o pulso do marcador selecionado, o anel do veículo seguido e o ponto de "Tempo real". O ponto respira em quatro passos (`steps(4, jump-none)`), não em curva contínua: cada quadro novo obriga todo vidro da tela a recalcular, e o ponto suave derrubava a tela parada de Veículos de 157 para 27 fps. O teste `motionBudget.test.ts` fixa essa lista e os passos. Dentro do vidro também não há laço: o skeleton é chapado e parado, e o marcador da próxima parada tem brilho fixo.
12. **Ancestral de vidro não anima.** Opacidade, `filter`, `transform`, máscara ou animação num ancestral transformam esse ancestral em raiz do fundo, e o vidro perde o mapa atrás. As animações de entrada e saída vão no próprio elemento de vidro, com `animation-fill-mode: backwards`, nunca no wrapper.
13. **Orçamento de desempenho:** pelo menos 55 fps no Chromium, a 1440 × 900, com uma única aba aberta. Se algum cenário ficar abaixo, a ordem de corte é: primeiro a resolução dos mapas do vidro, depois o especular colorido dos painéis grandes. A refração dos botões fica. Nenhum corte visível é feito sem avisar o dono do produto.

## 5. Mapa

### 5.1 Marcadores e linhas

| Elemento | Forma | Cor |
|---|---|---|
| Motorista disponível | círculo cheio de 32 px com iniciais | `--color-success` |
| Motorista ocupado | círculo com anel interno | `--color-warning` |
| Motorista offline | contorno tracejado | `--color-offline` |
| Motorista selecionado | anel limão de 3 px, halo e escala 1,14, com pulso suave (desligado com movimento reduzido) | — |
| Veículo seguido | círculo limão de 46 px com seta de navegação, contorno e anel que se expande | limão |
| Retirada | quadrado arredondado com "R" | `--color-pill-bg`, texto escuro |
| Parada | círculo numerado com borda da cor da rota; a próxima ganha halo | — |
| Entrega | losango com "E" | limão |
| Início | ponto pequeno | `--color-offline` |
| Parada concluída | opacidade 0,45 | — |
| Pílula de distância | pílula clara no meio da perna, com o `legKm` da API ("17,9 km"); na perna estimada, "28,4 km · estimado" com fundo âmbar claro. Só aparece quando a API devolve `legKm` | — |
| Rótulo HUD | caixa fina com contorno de 1 px, rótulo pequeno em caixa alta e valor, com haste vertical até o ponto. "Sem sinal · 9 min" e "Parado · 42 min" em âmbar; "Próxima parada · nome" neutro | — |

Os pedidos da fila do despacho usam o símbolo de retirada, sem número. Os marcadores entram com fade e escala, com mola de leve repique.

| Camada de linha | Estilo |
|---|---|
| Rota pelas ruas (`road`) | sólida, `--color-route`, 4 px, com contorno de 7 px e brilho difuso de 14 px |
| Trecho estimado | tracejada `[2, 1.6]`, `--color-warning`, 3 px |
| Linha reta (modo haversine) | tracejada, `--color-route` |
| Ordem original no simulador | 2 px sólida, `--color-text-subtle` a 45%, sem tracejado; legenda "Ordem original (linha reta)". Nunca usa a cor nem o tracejado do estimado |
| Atribuição do plano no despacho | arco curvo de 2 px em limão a 80%, do motorista à retirada, com a pílula "x km" de `PlannedAssignment.km`; legenda "Atribuição do plano". Não representa caminho |

Toda linha de rota desenhada vem do `path` que a API devolve. Sem `path`, a perna é estimada e aparece tracejada. A legenda flutuante mostra só os tipos presentes.

### 5.2 Recoloração

O estilo `https://tiles.openfreemap.org/styles/liberty` é baixado uma vez e transformado antes de chegar ao mapa. Recolorir depois do carregamento faz o estilo padrão piscar. A transformação, por tipo e `source-layer`, recolore:
- fundo e terra;
- floresta, grama e parques;
- água e rios;
- ruas por hierarquia, com contorno escuro;
- prédios, limites e rótulos;
- `building-3d`, que fica visível.

E esconde: POIs, escudos de rodovia, setas de mão única, hachuras de trilho, contorno verde de parque, padrão de banhado, caminhos de pedestre e o ícone de aeroporto.

A transformação também acrescenta as fontes de relevo, a camada de sombreamento e o céu. A troca de tema aplica o estilo transformado do outro tema com `setStyle(style, { diff: true })`, e as camadas próprias (rota, arcos, cometas) e o terreno são reaplicados no `style.load`.

### 5.3 Mapa 3D

- **Relevo:** duas fontes `raster-dem` com os Terrain Tiles públicos da AWS (`terrarium`, `maxzoom` 13): `dem` para o terreno 3D e `dem-shade` para o sombreamento `relief`, inserido antes de `water`, com cores por tema e luz a 315°. A atribuição dos Terrain Tiles entra no controle de atribuição.
- **Prédios:** a camada `building-3d` (a partir do zoom 14) fica visível, com cor interpolada por `render_height`. Só aparece na câmera de acompanhamento, dentro das cidades.
- **Céu:** `style.sky` por tema. Aparece no horizonte quando a inclinação passa de cerca de 70°. Escuro: céu `#08130d`, horizonte `#22402e`, névoa `#13231a`. Claro: céu `#bcd3df`, horizonte `#eef3ea`.
- **Câmera por tela:**

| Tela | Terreno (exagero) | Inclinação | Movimento |
|---|---|---|---|
| Dashboards | 2,4 | cerca de 73°, céu visível | Voo de chegada e giro de entrada de 22° em 12 s, desacelerando, depois parado. Qualquer gesto cancela |
| Detalhe do pedido | 1,3 | 30° → 68° | Visão geral, desenho da rota e câmera de acompanhamento |
| Mapa ao vivo | desligado | 0° | Operação. Mapa plano (`flat`): sem relevo sombreado e sem prédios 3D, para ficar leve com muitos motoristas |
| Despacho | desligado | 0° | Mesa de planejamento, com arcos e cometas finitos |
| Simulador de rota | desligado | 0° | Plano, porque o clique precisa ser preciso |
| Login | desligado | 0° | Estático |

Com o terreno desligado, `setTerrain(null)` libera a GPU e o sombreamento continua. Antes de cada enquadramento, o motor para a câmera e zera o padding, senão o padding da câmera anterior soma-se ao novo.

O motor adapta a câmera à largura (`adaptCamera`, em `frontend/src/map/responsive.ts`). No tablet, a inclinação para em 60°. No celular, para em 45°, sem terreno e sem giro de entrada. Ao redimensionar a janela, a câmera é reaplicada depois de 200 ms.

Na câmera de acompanhamento do detalhe do pedido, o veículo é seguido com zoom 15,4, virado para a rota à frente. Um gesto do usuário no mapa suspende o acompanhamento, e o botão "Seguir veículo" retoma.

## 6. Renders de veículos e figuras de pessoas

- **Origem:** modelos 3D próprios, feitos por código no Blender 5.3 (Cycles), sem arquivos de terceiros. Os modelos lembram os reais pela silhueta e pelas proporções, sem logotipos. Pintura em argila clara com faixa limão, vidros escuros esverdeados, plásticos pretos, rodas cinza, luz de estúdio suave e sombra de contato.
- **Gerador dos veículos** (`docs/design/vehicles/`): `build_vehicles.py` monta as três famílias (vans, caminhões de cabine avançada e motos) a partir de `models.py` e `motorcycles.py`, com as primitivas, o estúdio, a câmera e a máscara em `vehicle_kit.py`. `finish_renders.py` recorta pelo alfa e grava os WebP. Comandos:
  - `blender -b --factory-startup -P docs/design/vehicles/build_vehicles.py -- --out <pasta> --fraction 0.75 --samples 64 --cpu`;
  - `python3 docs/design/vehicles/finish_renders.py --src <pasta> --out frontend/public/renders --scale 0.8`, que imprime os tamanhos para a tabela `SIZES` de `vehicleRender.ts`.
- **Arquivos:** `frontend/public/renders/<chave>-34.webp` e `<chave>-side.webp`, com alfa, mais `<chave>-34-paint.webp` e `<chave>-side-paint.webp`, as máscaras da pintura com o mesmo tamanho do render. As chaves são `sprinter`, `ducato`, `fiorino`, `kangoo`, `delivery`, `accelo`, `constellation`, `atego`, `cg-cargo` e `biz`. A vista 3/4 vai nos detalhes, no `VehicleCard` e no cartão do mapa ao vivo; a lateral vai na garagem e na lista de motoristas. A pasta não se chama `vehicles` porque `/vehicles` é rota da API e o proxy a encaminharia para o backend.
- **Modelo para render:** `vehicleRender(vehicle, view)` (`frontend/src/vehicles/vehicleRender.ts`) procura marca e modelo no catálogo (`catalog.ts`), sem diferenciar acentos nem maiúsculas. Sem resultado, usa o modelo padrão do tipo: Van → Sprinter, Furgão → Fiorino, Caminhão leve → Delivery, Caminhão → Constellation, Moto → CG 160 Cargo. Sem tipo conhecido devolve `null`, e a interface mostra o ícone com "Sem imagem para “<tipo>”".
- **Cor:** `VehicleShot` pinta a máscara com a cor do cadastro (`mix-blend-mode: multiply` dentro de um wrapper com `isolation: isolate`), e a imagem fica intacta. Branco ou sem cor mostra a argila clara.
- **Imagens:** `width` e `height` declarados (tabela `SIZES`), `loading="lazy"` e `decoding="async"`. Nos cartões de lista, `alt=""`, porque placa e nome já estão em texto. No detalhe, `alt` descritivo ("Mercedes-Benz Sprinter BRA2E19"). O render "chega" deslizando 46 px da direita (`.motion-drive`).
- **Contenção:** o render nunca passa por cima de texto. No cartão da garagem ele fica no fluxo, abaixo da placa e do modelo, centralizado, com no máximo 132 px de altura e 100% da largura útil. No detalhe do veículo, no cartão do mapa ao vivo e no `VehicleCard`, a altura máxima (226, 204 e 196 px) e a largura máxima limitam motos e caminhões, que têm proporções diferentes das vans. Na folha de detalhe em tablet (768–1023 px), o render fica preso ao topo da coluna, com no máximo 170 px, para caber acima do rodapé de ações. O `.vehicle-shot` nunca recebe `width` fixa: a camada de pintura cobre a caixa dele, e a caixa precisa ter o tamanho exato da imagem. O `VehicleCard` continua saindo pelo topo do cartão, onde não há texto. O teste `vehicleShots.test.ts` fixa essas regras.
- **Figuras de pessoas** (`docs/design/people/`): `build_people.py` monta cinco figuras sem rosto, uma por perfil, no mesmo estúdio: administrador com notebook, despachante com fone e tablet, gestor de frota com prancheta e capacete, motorista com boné e colete segurando uma caixa, cliente recebendo um pacote. `finish_people.py` grava `frontend/public/people/<perfil>.webp` (corpo inteiro com 600 px de altura e só uma sombra de contato elíptica sob os pés, porque a sombra do chão vista de frente aparecia como uma caixa cinza no tema claro) e `<perfil>-bust.webp` (busto quadrado de 256 px para o avatar). `personFigure(role, variant)` resolve o arquivo, e `RoleFigure` mostra a imagem por cima das iniciais, que voltam se a imagem falhar.

## 7. Movimento

Os utilitários ficam em `frontend/src/styles/motion.css` e a contagem de números em `useCountUp`.

- **Vidros (painéis, cartões, barras):** entram com `glass-in`: de opacidade 0, 22 px abaixo, escala 0,965 e blur de 10 px, em 900 ms com `--ease-spring`, escalonados por `--i` (120 ms + 70 ms por índice). Saem com `glass-out` em 220 ms. A troca de página marca `data-phase="entering"` ou `"leaving"`, e o CSS anima só os `.glass`, nunca o `main`.
- **Conteúdo dentro do vidro:**
  - linhas e itens sobem 10 px em 800 ms (`.motion-rise`), escalonados;
  - barras crescem da esquerda em 1,1 s (`.motion-grow`);
  - pontos aparecem com repique, escalonados 28 ms (`.motion-pop`);
  - números contam de 0 até o valor em 1,4 s, desacelerando, na primeira exibição. Quando o valor muda, contam do antigo ao novo em 600 ms;
  - renders chegam deslizando 46 px em 1,2 s (`.motion-drive`). No cartão da garagem, o hover sobe 3 px e aumenta para 1,03, com mola.
- **Mapa:**
  - desenho progressivo da rota em cerca de 1,4 s ao abrir o pedido;
  - arcos do plano desenhados em 900 ms; depois, cometas percorrem cada arco duas vezes e param;
  - haste dos rótulos HUD cresce em 800 ms;
  - marcadores entram com fade e escala;
  - motorista e veículo deslizam 600 ms entre posições reais (paradas mudam na hora; com movimento reduzido, tudo salta);
  - viagens de câmera, giro de entrada e câmera de acompanhamento.
- **Seleção:** a câmera voa até o alvo. Na lista, o item ganha preenchimento de destaque e um deslocamento de 3 px.
- **Filtros:** a lista reordena com fade cruzado, e os marcadores filtrados somem com fade.
- **Botões:** afundam a 0,93 em `:active` e voltam com mola.
- **Movimento reduzido:** com `prefers-reduced-motion: reduce`, sai animação, pulso, contagem (o valor final aparece na hora) e viagem de câmera (vira salto direto). Ficam só mudanças de estado instantâneas.

## 8. Padrões compartilhados e critério de pronto

### 8.1 Padrões

Valem para todas as telas. Ficam em `frontend/src/patterns/`, menos `StatusBadge` e os estados (`frontend/src/components/`) e o `AmbientBackground` (`frontend/src/layout/`).

| Padrão | Uso |
|---|---|
| `HeroNumber` | Número de destaque com contagem, unidade, rótulo e delta opcional, nos tamanhos `hero` (148 px), `large` (46 px) e `stat` (34 px) |
| `StopTimeline` / `timelineFromRoute` / `timelineFromOrder` | Linha do tempo vertical de paradas numa `<ol>`: concluída, próxima, a fazer; retirada "R", paradas numeradas, entrega "E" em losango |
| `MiniRoute` | Retirada → "+N paradas" → entrega, compacta, para listas e cartões |
| `VehicleCard` | Render saindo do cartão, placa, status, nome do veículo (`vehicleName`: "Marca Modelo" ou, sem eles, o tipo), último sinal e motorista; estados carregando e sem veículo. Aparece no painel e no detalhe do motorista e no detalhe do pedido |
| `SidePanelLayout` / `SidePanel` | Painel de vidro com `role="dialog"` não modal, para detalhe, criação e edição nos cadastros, na prévia da lista de pedidos e na edição do detalhe do motorista e da frota. Tem 450 px à direita a partir de 1280 px e 360 px de 1024 a 1279 px, e a lista encolhe com mola para ele não cair sobre outro vidro. De 768 a 1023 px vira folha inferior com alça e três alturas. Abaixo de 768 px ocupa a tela inteira, opaco. Fecha com o botão, com Esc (menos quando há modal aberto) ou com novo clique na mesma linha, e devolve o foco ao fechar |
| `BottomSheet` | Folha inferior de vidro com três alturas (recolhida, média e cheia) e abas opcionais. A alça troca a altura com arraste, clique ou as setas para cima e para baixo. Recebe o painel direito do Mapa ao vivo no tablet e no celular |
| `Avatar` | Figura 3D sem rosto do perfil da pessoa (`RoleFigure`), com as iniciais por baixo quando a imagem falha. Nos cabeçalhos de pessoa, nas listas de motoristas, usuários e clientes, nos membros das frotas e no chip do usuário. Minha conta mostra também a figura inteira |
| `GlassMapFrame` | Mapa embutido numa moldura de vidro, para telas sem o mapa contínuo: Novo pedido, Lugares, Meus endereços, detalhe da frota, posição do motorista e Mapa viário |
| `StatusBadge` | Pílula com ponto, cor semântica e rótulo em português |
| `DotMatrix` / `dotScale` | Contagem em pontos, com teto de 12 por coluna e escala ("1 ponto = 3 pedidos"); pontos parados vazados em âmbar |
| `EmptyState` / `ErrorState` | Ícone, frase e ação primária sobre o halo ambiente; o erro tem "Tentar de novo" |
| `AmbientBackground` | Gradientes e curvas de nível estáticos atrás das telas sem mapa |

Primitivas em `components.css`: `.btn` (pílula; `.btn-primary` limão com texto escuro, `.btn-secondary` e `.btn-ghost` chapados, `.btn-danger` com tinta de perigo a 14%), `.segmented`, `.field`, `.badge-*`, `.notice-*`, `.micro`, `.chip-flat`, `.delta` (com `delta-success`, `delta-danger` e `delta-neutral`), `.est-chip` (`.is-road` quando o trecho é pelas ruas), `.rowline`, `.skeleton` e `.state`. Modais opacos ficam para confirmações e para as duas ações curtas do pedido: atribuir motorista e registrar a prova de entrega.

### 8.2 Critério de pronto (toda tela)

1. **Ponto de vista próprio,** escrito em uma linha. A tela não é uma tabela genérica com título.
2. **Um elemento de destaque:** um número grande e fino, um nome ou status grande, um render ou um mapa, seguindo a hierarquia tipográfica.
3. **Movimento:** entrada escalonada dos vidros, conteúdo que sobe, contagem nos números, barras que crescem e hover com mola. Só movimento finito atrás do vidro.
4. **Vidro:** as regras da seção 4, sem exceção. Dentro do vidro, tudo chapado.
5. **Recursos visuais onde o dado existe:**
   - render do veículo sempre que um veículo aparece com tipo conhecido;
   - `Avatar` com a figura do perfil para pessoas, com as iniciais como reserva; marcadores e linhas compactas do mapa ficam com as iniciais;
   - mapa embutido sempre que houver coordenadas;
   - mini-rota ou linha do tempo vertical sempre que houver paradas.
6. **Estados desenhados:** carregando (skeleton chapado dentro do vidro), vazio (ícone, frase e ação, sobre o fundo ambiente), erro (mensagem e "Tentar de novo") e sem permissão. Nenhum estado é só uma linha de texto.
7. **Dois temas e três larguras** (1440 × 900, 1024 × 768 e 390 × 844), verificados com captura.
8. **Honestidade dos dados:** só o que a API devolve.

### 8.3 Composição e larguras

As telas imersivas da equipe (dashboards, Mapa ao vivo, Despacho, Simulador de rota e detalhe do pedido) ficam sobre o mapa contínuo do Shell. As demais e todas as do cliente ficam sobre o fundo ambiente. A lista está em `frontend/src/map/immersive.ts`.

As telas montam a composição com as mesmas peças, cada uma com as que precisa:
- bloco de título no canto superior esquerdo, com o chip "Tempo real";
- barra de comando em pílula no topo;
- painel esquerdo e painel direito presos às bordas;
- faixa inferior;
- `SidePanel` à direita das listas.

Os controles globais (sino, tema e chip do usuário) ficam no canto superior direito, e o menu lateral à esquerda. O padding da câmera reserva o espaço dos painéis, para o conteúdo do mapa cair na área livre. No detalhe do pedido, ele é medido nos próprios painéis.

As faixas de largura saem de `viewportFor` (`frontend/src/map/responsive.ts`):

| Faixa | Largura | Comportamento |
|---|---|---|
| `full` | ≥ 1280 px | Composição completa |
| `compact` | 1024 a 1279 px | Painéis laterais mais estreitos (320 px no Mapa ao vivo), blocos secundários da faixa inferior ocultos, barra de comando junto ao título, `SidePanel` com 360 px e número de destaque do dashboard em 112 px |
| `tablet` | 768 a 1023 px | Menu lateral sempre recolhido. O painel direito do Mapa ao vivo e o `SidePanel` viram folha inferior com alça e três alturas. Inclinação máxima de 60° |
| `phone` | < 768 px | Barra superior com o botão de menu, e o menu vira gaveta opaca. Nas telas imersivas, mapa no topo e painéis em uma coluna. O Mapa ao vivo usa folha inferior com as abas "Lista" e "Detalhe" e controles do mapa de 44 px à direita, acima da folha. `SidePanel` em tela cheia e tabelas como cartões de registro, com o rótulo de cada coluna. Sem terreno, sem giro de entrada e inclinação máxima de 45° |

## 9. Acessibilidade

- Contraste WCAG AA para texto e controles. Limão nunca é usado como texto sobre fundo claro.
- Foco visível em todo elemento interativo: anel limão de 2 px (`:focus-visible`); campos ganham borda limão e anel `--color-accent-soft`.
- Ordem de tabulação previsível. O `SidePanel` recebe o foco ao abrir e devolve ao fechar; modais prendem o foco e fecham com Esc.
- A alça do `BottomSheet` e do `SidePanel` no tablet é um botão com nome ("Expandir painel" ou "Recolher painel") e troca a altura também com as setas para cima e para baixo. As abas da folha inferior usam `role="tab"`.
- Labels associados aos campos. Ícones decorativos com `aria-hidden`; botões só de ícone com nome acessível.
- Status sempre com texto além da cor. A linha do tempo informa o estado de cada parada também em texto para leitor de tela.
- `prefers-reduced-motion: reduce`: sem animação, contagem ou viagem de câmera.
- `prefers-reduced-transparency: reduce`: vidro vira superfície opaca.
- Tabelas com cabeçalhos semânticos e controles com área de toque adequada.

## 10. Restrições funcionais

O design respeita o inventário de telas, a matriz de perfis (ADMIN, DISPATCHER, FLEET_MANAGER e CUSTOMER) e os contratos atuais da API. Não desenhar como se já existissem:
- custos, faturamento, consumo, CO₂ ou relatórios exportáveis;
- manutenção agendada ou documentos de veículos;
- login Google ou recuperação de senha;
- geocodificação, busca global de pedidos ou histórico de posições;
- rastreio público em mapa ou posição do motorista para o cliente;
- ruas reais fora do modo `road` ou sem o grafo carregado. Nesse caso, o trecho aparece como estimado, tracejado.

Já existem na API e no frontend, e podem ser desenhados: edição de perfil, troca de senha, edição e desativação de usuários, e a identidade do veículo (marca, modelo, ano, cor, capacidade em kg, volume em m³ e hodômetro em km), com o catálogo de modelos em `frontend/src/vehicles/catalog.ts`.

A semântica do mapa é preservada: linha sólida é rota pelas ruas, tracejada é trecho estimado, retirada, parada e entrega têm símbolos diferentes, as paradas são numeradas, as concluídas ficam atenuadas e posição nula significa "sem posição".

A refração do vidro só funciona no Chromium (Chrome, Edge, Arc, Opera), que é o único a aceitar filtro SVG em `backdrop-filter`. Safari e Firefox recebem o mesmo vidro, sem a curvatura nas bordas.
