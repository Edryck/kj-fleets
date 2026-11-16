# KJ Fleets — Redesign geoespacial imersivo

Data: 2026-11-16 · Escopo: `frontend/` · Status: aguardando aprovação

## 1. Intenção

O frontend do KJ Fleets funciona, mas parece um painel administrativo comum com um mapa dentro. O objetivo é transformá-lo numa plataforma geoespacial de logística com acabamento de produto comercial premium e padrão Apple: o território é o ambiente da operação, e os dados e controles flutuam sobre ele numa experiência só.

Duas referências do dono do produto guiam a direção:
- **Protótipo das telas (v2):** `.superpowers/brainstorm/9650-1794846045/content/screens.html`, aprovado pelo dono do produto ("gostei do que fizemos, vamos prosseguir"). É a referência de composição, mapa 3D, movimento, tipografia e renders de veículos para Dashboard, Detalhe do pedido, Despacho e Veículos.
- **Mockup do Mapa ao vivo (v6):** `.superpowers/brainstorm/9650-1794846045/content/live-map-v6.html`, aprovado antes. É a referência do vidro líquido, da paleta e da tela do Mapa ao vivo.

Os módulos compartilhados do protótipo (`kj-map.js`, `kj-glass.js`, `kj-base.css`) são a implementação de referência do mapa e do vidro.

### 1.1 Referências e o que cada uma trouxe

| Referência | O que entra no produto |
|---|---|
| ShotScope e GolfX | Mapa ocupando a tela, painéis flutuantes translúcidos, navegação compacta, contraste entre superfícies escuras e elementos luminosos, verde-limão como destaque |
| Widget escuro com linha do tempo vertical tracejada | Linha do tempo de paradas do Detalhe do pedido e mini-rota dos cartões do Despacho |
| HUD "Travel time" | Rótulos HUD com haste sobre o mapa: "Sem sinal", "Próxima parada", "Parado" |
| Mapa 3D com cartão de vidro e numerais finos e grandes | Número de destaque ultrafino do dashboard sobre o relevo e ETA ultrafino |
| Painel "Tracking" com cartões de caminhão | Cartão do veículo no Detalhe do pedido e cartões da tela Veículos |
| Analytics de vidro (Ocean Royale) | Funil em matriz de pontos e doca inferior de painéis |
| Fleetory, claro, com render de caminhão | Renders de veículos e acabamento do tema claro |
| Apple | Fonte SF Pro, movimento com mola, vidro líquido |

### 1.2 Identidade de cada tela

As telas compartilham a linguagem, mas cada uma tem um ponto de vista próprio:

| Tela | Ponto de vista |
|---|---|
| Dashboard | Vista aérea: relevo em 3D até o horizonte, com o número de destaque em tipografia grande sobre o céu |
| Detalhe do pedido | Câmera de acompanhamento: o mapa segue o veículo pela rota, com um cartão de produto do veículo |
| Despacho | Mesa de planejamento: mapa plano, visto de cima, com os arcos do plano |
| Veículos | Garagem: sem mapa, cartões com os renders dos veículos |
| Mapa ao vivo | Operação: como o mockup v6 |

## 2. Objetivos, não objetivos e antiobjetivos

**Objetivos**
- Nova identidade visual (paleta floresta, verde-limão, tipografia Apple) nos dois temas.
- Vidro líquido no estilo Apple em todos os botões e painéis que flutuam diretamente sobre o mapa ou sobre o fundo ambiente.
- Um mapa contínuo atrás das telas de operação, com a câmera viajando entre contextos.
- Mapa 3D: relevo, prédios em volume e céu no horizonte onde a tela pede.
- Renders próprios dos veículos.
- Composição própria para cada tela, conforme a função dela (§1.2).
- Movimento com mola, funcional, respeitando `prefers-reduced-motion`.
- Reescrever o `docs/DESIGN.md` com a nova identidade.

**Não objetivos**
- Mudar backend, contratos REST ou tópicos STOMP.
- Criar funcionalidade nova. Só a apresentação muda, e toda informação mostrada vem da API.
- Trocar a stack, adotar Tailwind ou bibliotecas de componentes.

**Antiobjetivos (fracasso mesmo que funcione)**
- Parecer um template de dashboard SaaS: fileira de quatro cards de KPI, cards dentro de cards, bordas e divisores por toda parte.
- Vidro sobre vidro.
- Mostrar dados geográficos inventados: posição estimada entre dois sinais, rua simulada, coordenada sem origem na API, traçado de rota que a API não devolveu. A transição visual curta entre duas posições reais (§6.2) não estima nada e termina exatamente na posição da API.
- Perder fluidez: mapa engasgando com os painéis por cima.
- Quebrar permissões, autenticação ou qualquer fluxo existente.

## 3. Restrições

- **Stack preservada:** React 18.3, TypeScript 5.9, Vite 6, React Router 7, TanStack Query 5, React Hook Form 7, Recharts 3, MapLibre GL 6, OpenFreeMap, Lucide React e CSS puro. Nenhuma dependência nova. Sai `@fontsource/montserrat`; fica `@fontsource/inter` como fonte de reserva (§5.2).
- **Fontes externas de dados do mapa:** OpenFreeMap (estilo e vetores, como hoje) e os Terrain Tiles públicos da AWS para o relevo (§5.6), com a atribuição exigida.
- **Perfis e permissões:** ADMIN, DISPATCHER, FLEET_MANAGER e CUSTOMER, com a matriz atual de `src/routes.ts` e `src/auth/guards.tsx` intacta.
- **Restrições funcionais herdadas** do §14 do DESIGN.md antigo, que continuam valendo. Não desenhar como se existissem:
  - custos, faturamento, consumo, CO₂, odômetro ou relatórios exportáveis;
  - manutenção agendada ou documentos de veículos;
  - geocodificação, busca global de pedidos ou histórico de posições;
  - rastreio público em mapa ou posição do motorista para o cliente;
  - ruas reais fora do modo `road`.
- **Semântica do mapa preservada:**
  - linha sólida é rota pelas ruas;
  - tracejada é trecho estimado;
  - retirada, parada e entrega têm símbolos diferentes;
  - paradas numeradas;
  - paradas concluídas ficam atenuadas;
  - posição nula significa "sem posição".
- **Regras do repositório (CLAUDE.md do usuário):**
  - nenhum comentário em código;
  - nomes de variáveis, funções e arquivos em inglês;
  - textos de interface em português;
  - planos divididos em arquivos por fase.
- **Testes:** os 72 testes do Vitest continuam passando. Os testes que dependem de markup alterado são atualizados, sem perder cobertura.
- **Navegadores:** a refração do vidro só funciona em Chromium (Chrome, Edge, Arc, Opera), porque só ele aceita filtro SVG em `backdrop-filter`. Safari e Firefox recebem o mesmo vidro sem a curvatura nas bordas. Isso foi aceito.

## 4. Abordagens consideradas

| | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| A | Um mapa por tela (evolução do `MapView` atual) | Simples e isolado, mas o mapa recarrega a cada navegação e a câmera reseta; a imersão termina na borda da tela | Descartada |
| C | **Um mapa contínuo nas telas de operação**, mais mapas embutidos nas prévias | A câmera viaja entre contextos e só os painéis trocam; custa um motor de cena compartilhado e disciplina de limpeza | **Escolhida pelo dono do produto** |
| B | Um mapa atrás do app inteiro | Obriga cadastros a esconder um mapa sem uso, sem ganho | Descartada |

Decisões menores tomadas na conversa:
- **Visual do mapa:** o OpenFreeMap não tem satélite. O estilo vetorial `liberty` é recolorido para tons de floresta e musgo, com relevo sombreado e, onde a tela pede, terreno em 3D. Aprovado.
- **Geografia do despacho:** a fila (`/dashboard/dispatch/queue`) não traz coordenadas. A solução é buscar `GET /orders/:id` dos pedidos visíveis (no máximo 50 por etapa), na mesma chave de cache da tela do pedido (`["order", id]`). Decisão delegada pelo dono do produto.
- **Rota original no simulador:** a API devolve só `baselineKm`. A ordem original aparece como ligações retas na ordem digitada, com estilo próprio, distinto do tracejado de "trecho estimado". Aprovado.

## 5. Identidade visual

### 5.1 Paleta

Tokens em `src/styles/tokens.css`. Os valores são os do mockup v6.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--color-bg` | `#0c1511` | `#e8ede4` | Fundo de base |
| `--color-text` | `#eef4ec` | `#16211a` | Texto principal |
| `--color-text-muted` | `#9fb2a5` | `#56665b` | Texto secundário |
| `--color-text-subtle` | `#6e8476` | `#7b8a80` | Metadados |
| `--color-accent` | `#b7f52a` | `#b7f52a` | Verde-limão: ação principal, seleção, atividade |
| `--color-accent-ink` | `#13200a` | `#13200a` | Texto sobre limão |
| `--color-active-bg` / `--color-active-ink` | limão / `#13200a` | `#16211a` / `#f4f8f1` | Item ativo de navegação e segmento. No claro vira pílula grafite, como na referência ShotScope |
| `--color-route` | `#b7f52a` | `#5f9410` | Linha da rota pelas ruas |
| `--color-route-casing` | `#0b1410` | `#ffffff` | Contorno da rota e dos marcadores |
| `--color-success` | `#5ed3a2` | `#17885a` | Disponível e concluído. Verde-menta, distinto do limão |
| `--color-warning` | `#f2b84b` | `#9a6400` | Ocupado, atenção, trecho estimado |
| `--color-danger` | `#f47272` | `#c43d3d` | Falha, cancelamento, erro |
| `--color-info` | `#7cc4e8` | `#2a7fb0` | Informação neutra, etapa "Despachado" do funil |
| `--color-offline` | `#7d9184` | `#6b7b70` | Sem sinal |
| `--color-fill` / `--color-fill-hover` | branco 6% / 10% | grafite 5% / 9% | Preenchimento chapado dentro do vidro |
| `--color-solid-raised` | `#17251d` | `#fbfcf9` | Popover, tooltip, modal, drawer, toast, menu lateral expandido |
| `--color-brand-orange` | `#ff6a00` | `#ff6a00` | Laranja institucional: só no selo "KJ" e no favicon |

O limão nunca comunica sucesso, e o verde-menta nunca comunica ação. Status sempre leva rótulo em português e, quando útil, ícone.

### 5.2 Tipografia

A fonte do sistema da Apple não pode ser empacotada, por licença. A pilha usa a do sistema e cai para Inter fora dos aparelhos Apple.

| Papel | Pilha | Uso |
|---|---|---|
| Display | `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif` | Títulos, números grandes |
| Interface | `"SF Pro Text", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif` | Texto, rótulos, botões, tabelas |
| Dados | `"SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | Placas, códigos de rastreio, coordenadas, quilometragens e contagens em filtros |

- Inter vem do `@fontsource/inter` já instalado, com os pesos 200, 300, 400, 500, 600 e 700.
- Algarismos tabulares em todo o app (`font-feature-settings: "tnum"`).

| Nível | Tamanho / peso / espaçamento |
|---|---|
| Número de destaque do dashboard | 148 px, peso 200, −0,055 em; a unidade (%) em 52 px, peso 200 |
| Título de tela | 46 px, peso 600, −0,03 em |
| Status grande (detalhe do pedido) | 34 px, peso 500, −0,03 em |
| Números secundários (estatísticas, ETA) | 34–46 px, peso 200, −0,03 em, com unidade em 13 px |
| Título de painel | 15 px, peso 600 |
| Rótulo pequeno em caixa alta | 10,5 px, peso 600, +0,14 em |
| Texto | 13–14 px |
| Placa em destaque | 26 px (cartão) e 40 px (detalhe), mono, peso 600, +0,06 em |

### 5.3 Vidro líquido

As regras abaixo são obrigatórias. A implementação de referência está no mockup v6 e em `kj-glass.js`.

1. **Onde há vidro:** em todo elemento que flutua diretamente sobre o mapa ou sobre o fundo ambiente. Isso inclui menu lateral, barras de comando, botões redondos, chip do usuário, painéis, blocos de indicadores, controles do mapa, bottom sheets, cartões de veículo e o cartão de login. A única exceção é o número de destaque do dashboard, que é tipografia sobre um degradê (§7.3).
2. **Sem vidro sobre vidro.** Dentro de um vidro, tudo é chapado (`--color-fill`), sem blur, refração ou brilho: blocos de dados, linhas, segmentos, botões internos, campos e cabeçalhos de tabela. Popovers, tooltips, menus, modais, drawers, toasts e o menu lateral expandido, que podem cair sobre um vidro, usam `--color-solid-raised` opaco.
3. **Duas variantes, como a Apple:**
   - `regular`, para superfícies com texto: tinta mais forte, blur de 4,5 px;
   - `clear`, para controles só de ícone: tinta leve, blur de 0,6 px, lente mais forte.
4. **Pipeline (Chromium):** `backdrop-filter: blur(Npx) saturate(1.5) url(#glass-filter-id)`. O blur fica no CSS, que é acelerado e vem antes da refração. O filtro SVG tem:
   - `feImage` com o mapa de deslocamento;
   - `feDisplacementMap` com escala igual a 2 × o deslocamento máximo × fator de refração;
   - `feImage` com o mapa especular;
   - especular colorido: o fundo refratado saturado (4–5×) recortado pelo alfa especular, mesclado em `screen`;
   - um especular branco por cima, mesclado em `screen`.
5. **Refração física (técnica do kube.io):** perfil "convex squircle" `y = (1 − (1 − x)^4)^(1/4)`, índice 1,5 e lei de Snell. O deslocamento numa distância x do bisel é `h(x) · tan(θ1 − θ2)`, com `θ1 = atan(|h'(x)|)` e `sin θ2 = sin θ1 / 1,5`.
   - As magnitudes são calculadas uma vez num raio de 128 amostras e normalizadas pelo máximo.
   - O vetor aponta para dentro, perpendicular à borda. Nas curvas dos cantos, é radial ao centro da curva.
   - A codificação é `R = 128 + x·127`, `G = 128 + y·127`, com 128 como neutro.
   - Parâmetros: regular com bisel de 26 px e espessura 46; clear com bisel de 42% do menor lado e espessura 34.
6. **Brilho especular:** luz de contorno vinda de −125° (canto superior esquerdo), com 55% de intensidade no lado oposto. Um traço nítido de cerca de 1 px soma-se a um brilho interno suave de cerca de 6 px.
7. **Proibido:** a dispersão cromática custava 60 → 27 fps e ficou fora.
8. **Interação:**
   - botões de vidro afundam a 0,93 e voltam com mola;
   - um brilho radial acompanha o ponteiro na superfície.
9. **Fallbacks:**
   - fora do Chromium: blur, saturação, tinta e um contorno em gradiente desenhado com CSS (`::before` com máscara);
   - com `prefers-reduced-transparency: reduce`: superfície opaca `--color-solid-raised`.
10. **Mapas por tamanho:** os mapas são gerados no tamanho exato do elemento, com cache por chave `(largura, altura, raio, variante)`, de modo que elementos iguais compartilham o mesmo filtro. São regenerados quando o tamanho muda, por meio de `ResizeObserver` agrupado por frame.
11. **Nada se move sem parar atrás do vidro.** Sempre que o fundo muda, o filtro recalcula naquele quadro. Medições no protótipo, com Chrome neste Mac a 1440 × 900:
    - fundo ambiente com curvas de nível derivando, atrás dos cartões de Veículos: 25 fps; parado: 61 fps;
    - dashboard com órbita contínua da câmera: 44 fps; a mesma órbita sem a refração: 60 fps; o relevo em 3D não custou quadros;
    - cometas do despacho em laço infinito: 25 fps.

    Por isso, atrás do vidro só há movimento finito: transições de câmera, giros de entrada, desenho de rota, resposta a um gesto do usuário ou a uma posição real que chegou. As únicas animações infinitas permitidas são o pulso do marcador selecionado, o anel do veículo seguido e o ponto de "Tempo real".
12. **Ancestral de vidro não anima.** Opacidade, `filter`, `transform`, máscara ou animação num ancestral transformam esse ancestral em raiz do fundo, e o vidro perde o mapa atrás. As animações de entrada e saída vão no próprio elemento de vidro, com `animation-fill-mode: backwards`, nunca no wrapper.
13. **Orçamento de desempenho:** pelo menos 55 fps em Chromium neste Mac, a 1440 × 900, com uma única aba aberta, nos cenários de §10. Se algum cenário ficar abaixo, a ordem de corte é: primeiro a resolução dos mapas do vidro, depois o especular colorido dos painéis grandes. A refração dos botões fica. Nenhum corte visível é feito sem avisar o dono do produto.

### 5.4 Marcadores e linhas do mapa

| Elemento | Forma | Cor |
|---|---|---|
| Motorista disponível | círculo cheio de 32 px com iniciais | `--color-success` |
| Motorista ocupado | círculo com anel interno | `--color-warning` |
| Motorista offline | contorno tracejado | `--color-offline` |
| Motorista selecionado | anel limão de 3 px, halo e escala 1,14, com um pulso suave (desligado em movimento reduzido) | — |
| Veículo seguido (detalhe do pedido) | círculo limão de 46 px com seta de navegação, contorno e anel que se expande | limão |
| Retirada | quadrado arredondado com "R" | branco, texto escuro |
| Parada | círculo numerado com borda da cor da rota; a próxima ganha halo | — |
| Entrega | losango com "E" | limão |
| Início | ponto pequeno | `--color-offline` |
| Parada concluída | opacidade 0,45 | — |
| Pílula de distância | pílula branca no meio da perna com `legKm` da API ("17,9 km"); na perna estimada, "28,4 km · estimado" com fundo âmbar claro. Só aparece quando a API devolveu `legKm` | — |
| Rótulo HUD | caixa fina com contorno de 1 px, rótulo pequeno em caixa alta e valor; haste vertical até o ponto. "Sem sinal · 9 min" e "Parado · 42 min" em âmbar; "Próxima parada · nome" neutro | — |

Os pedidos da fila do despacho usam o mesmo símbolo de retirada, sem número. Os marcadores entram com fade e escala (mola com leve repique).

| Camada de linha | Estilo |
|---|---|
| Rota pelas ruas (`road`) | sólida, `--color-route`, 4 px, com contorno de 7 px e brilho difuso de 14 px |
| Trecho estimado | tracejada `[2, 1.6]`, `--color-warning`, 3 px |
| Linha reta (modo haversine) | tracejada, `--color-route` |
| Ordem original no simulador | 2 px sólida, `--color-text-subtle` a 45% de opacidade, sem tracejado; legenda "Ordem original (linha reta)". Nunca usar a cor nem o tracejado do estimado |
| Atribuição do plano no despacho | arco curvo (bezier quadrática) de 2 px em limão a 80%, do motorista à retirada, com pílula "x km" vinda de `PlannedAssignment.km`; legenda "Atribuição do plano". Não representa caminho |

A legenda flutuante mostra só os tipos presentes.

### 5.5 Recoloração do mapa

O estilo `https://tiles.openfreemap.org/styles/liberty` é baixado uma vez e **transformado antes de ir para o mapa**. Recolorir depois do carregamento faz o estilo padrão piscar, como se viu no mockup. A transformação, por tipo e `source-layer`, recolore:
- fundo e terra;
- floresta (`landcover_wood`), grama e parques;
- água e rios;
- ruas por hierarquia, com contorno escuro;
- prédios, limites e rótulos;
- `building-3d`, que fica visível (§5.6).

E esconde: POIs, escudos de rodovia, setas de mão única, hachuras de trilho, contorno verde de parque, padrão de banhado, caminhos de pedestre e o ícone de aeroporto.

Além disso, a transformação acrescenta as fontes de relevo, a camada de sombreamento e o céu (§5.6). Os valores das duas paletas estão em `PALETTES` no `kj-map.js`. A troca de tema aplica o estilo transformado do outro tema com `setStyle(style, { diff: true })`. As camadas próprias (rota, arcos, cometas) e o terreno são reaplicados no `style.load`.

### 5.6 Mapa 3D

- **Relevo:** duas fontes `raster-dem` com os mesmos Terrain Tiles públicos da AWS (`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, codificação `terrarium`, `maxzoom` 13, CORS aberto):
  - `dem`, para o terreno 3D (`map.setTerrain`);
  - `dem-shade`, para a camada de sombreamento `relief`, inserida antes de `water`, com cores por tema e luz a 315°.

  O MapLibre recomenda fontes separadas para terreno e sombreamento. A atribuição dos Terrain Tiles (Mapzen e as fontes listadas em `tilezen/joerd/docs/attribution.md`) entra no controle de atribuição.
- **Prédios:** a camada `building-3d` do `liberty` (a partir do zoom 14) fica visível, com cor interpolada por `render_height` e gradiente vertical. Só aparece na câmera de acompanhamento, dentro das cidades. Santa Helena tem prédios no OpenStreetMap, poucos e baixos (11 renderizados no zoom 15,4).
- **Céu:** `style.sky` por tema; aparece no horizonte quando a inclinação passa de cerca de 70°.
  - Escuro: céu `#08130d`, horizonte `#22402e`, névoa `#13231a`.
  - Claro: céu `#bcd3df`, horizonte `#eef3ea`.
- **Câmera por tela:**

| Tela | Terreno (exagero) | Inclinação | Movimento |
|---|---|---|---|
| Dashboards | 2,4 | cerca de 73°, céu visível | Voo de chegada e, ao parar, giro de entrada de 22° em 12 s, desacelerando, depois parado. Qualquer gesto cancela |
| Detalhe do pedido | 1,3 | 30° → 68° | Visão geral, desenho da rota, câmera de acompanhamento (§7.5) |
| Mapa ao vivo | desligado | 0° | Como o v6 |
| Despacho | desligado | 0° | Mesa de planejamento; arcos e cometas |
| Simulador de rota | desligado | 0° | Plano, porque o clique precisa ser preciso |
| Login | desligado | 0° | Estático |

Com o terreno desligado, `setTerrain(null)` libera a GPU, mas o sombreamento continua. Antes de cada enquadramento, o motor zera o padding da câmera. No protótipo, o padding deixado pela câmera de acompanhamento somava-se ao novo e impedia o enquadramento do despacho.

### 5.7 Renders de veículos

- **Origem:** modelos 3D próprios, procedurais, feitos em Three.js no estúdio do protótipo (`vehicle-studio.html`). Não há licença de terceiros. Pintura em argila clara com faixa limão, ambiente de estúdio em gradiente, sombras suaves e sombra de contato.
- **Arquivos:** `frontend/public/vehicles/truck-34.webp`, `truck-side.webp`, `van-34.webp` e `van-side.webp`, convertidos dos PNG transparentes do protótipo para WebP com alfa. A vista 3/4 vai nos detalhes e a lateral nos cartões.
- **Estúdio:** copiado para `docs/design/vehicle-studio.html`, para gerar novos ângulos ou modelos (por exemplo, moto) com os mesmos parâmetros (`?m=truck|van&v=34|side&w=&h=`).
- **Tipo para render:** o campo `type` do veículo é texto livre ("Texto livre, por exemplo Van ou Moto."). A função `vehicleRender(type, view)` decide:
  - `/caminh|truck/i` → caminhão;
  - `/van|furg|utilit/i` → van;
  - qualquer outro → `null`, e a interface mostra o ícone `Truck` do Lucide com "Sem imagem para “<tipo>”". Não há render de moto.
- **Imagens:** `width` e `height` declarados, `loading="lazy"` e `decoding="async"`. Nos cartões, `alt=""`, porque placa e tipo já estão em texto. No detalhe, `alt` descritivo ("Van BRA2E19").

## 6. Arquitetura

### 6.1 Módulos novos ou refeitos

| Caminho | Responsabilidade |
|---|---|
| `src/styles/tokens.css` | Todos os tokens: cores dos dois temas, vidro, raios, espaçamentos, sombras, movimento e tipografia |
| `src/styles/*.css` | Reescritos por área. A organização atual por arquivo pode continuar |
| `src/glass/liquidGlass.ts` | Funções puras: perfis, `refractionProfile`, `glassMaps` (canvas para data URL), montagem do filtro e cache |
| `src/glass/GlassDefs.tsx` | O `<svg>` oculto que hospeda os `<filter>`, montado uma vez na raiz do app |
| `src/glass/Glass.tsx` | O componente `<Glass variant="regular" \| "clear" as=…>`. Mede, registra o filtro, aplica a variável `--glass-filter` e trata o brilho do ponteiro. Fornece `GlassContext`: um `Glass` dentro de outro renderiza chapado e, em desenvolvimento, avisa no console. A regra de não ter vidro sobre vidro fica garantida pela estrutura |
| `src/map/mapStyle.ts` | Baixa o `liberty` uma vez, transforma por tema (cores, prédios, fontes de relevo, sombreamento, céu) e guarda em memória |
| `src/map/mapLayers.ts` | Camadas próprias (rota, contorno, brilho, estimado, reta, ordem original, arcos, cometas) e as fontes GeoJSON |
| `src/map/mapMotion.ts` | Animações finitas do mapa: desenho progressivo das pernas, desenho dos arcos, cometas com número de passadas, deslize de marcador, giro de entrada |
| `src/map/markers.ts` | Diferença incremental dos marcadores DOM (a lógica atual do `MapView`), classes por tipo e status, pílulas de distância, rótulos HUD, entrada animada |
| `src/map/MapStage.tsx` | Instância única do MapLibre no Shell, atrás do conteúdo, mais o `MapStageProvider` |
| `src/map/useMapScene.ts` | Hook pelo qual uma tela declara a própria cena |
| `src/components/MapView.tsx` | Continua como mapa embutido, reaproveitando `mapStyle`, `mapLayers` e `markers`, sem terreno |
| `src/motion/useCountUp.ts` | Contagem animada de números, com respeito a movimento reduzido |
| `src/vehicles/vehicleRender.ts` | `vehicleRender(type, view)` (§5.7) |
| `src/layout/Shell.tsx`, `Rail.tsx`, `ShellControls.tsx` | O novo shell (§6.3) |

### 6.2 Cena do mapa contínuo

**Telas imersivas** (o mapa contínuo fica visível):
- `/dashboard`, `/dashboard/dispatch` e `/dashboard/fleet` para equipe; CUSTOMER não;
- `/map`;
- `/dispatch`;
- `/orders/:id` para equipe; CUSTOMER não;
- `/routes/optimize`.

Nas demais telas, o mapa fica oculto (opacidade 0 com blur numa transição de 700 ms, depois `visibility: hidden`, sem render) e aparece o fundo ambiente (§6.4).

O contrato do `useMapScene(scene)`:
- `markers`: o mesmo tipo `MapMarker` de hoje, mais `kind: "order"` para os pedidos da fila, `kind: "hud"` para os rótulos HUD e `tone`, que define a cor;
- `legs`: `MapLeg[]`, com os tipos `road`, `estimated`, `straight` e `original`, e `animate: boolean` para o desenho progressivo;
- `arcs`: `{ id, from: [lat, lng], to: [lat, lng], label }[]`, com `comets: number` (passadas; 0 desliga);
- `pills`: pílulas de distância, quando não derivam das pernas;
- `camera`:
  - `fit: "markers" | "legs" | "points" | null`, `focusId`, `padding` (a área livre entre os painéis: cada tela passa os insets dos próprios painéis);
  - `pitch`, `bearing`, `terrain` (exagero; 0 desliga);
  - `intro: "spin" | null`;
  - `follow: { markerId, zoom, pitch } | null` (§7.5);
- `pick`: `{ hint, onPick }`. Apenas uma tela por vez reivindica o clique. Ao reivindicar, o cursor vira mira e aparece o aviso flutuante;
- `onMarkerClick`.

Ciclo de vida da cena:
1. Ao montar, a tela publica a cena.
2. Ao atualizar, o motor aplica só a diferença (marcadores no lugar, `setData` nas fontes).
3. Ao desmontar, a cena é limpa, e o motor para as animações dela (giro, acompanhamento, cometas).
4. Na troca de tela, se a nova cena pedir enquadramento, o motor para a câmera, zera o padding e faz `flyTo` para o enquadramento com a inclinação e a direção da cena (1,5–2,4 s, curva 1,3–1,4). Se a nova cena estiver vazia, a câmera fica onde está.
5. Posição de motorista em movimento não reenquadra, como hoje, exceto na câmera de acompanhamento.
6. Atualizações por STOMP deslizam o marcador em linha reta da posição anterior para a nova, em 600 ms. O marcador nunca passa da posição recebida nem segue ruas, e termina exatamente nela. Com movimento reduzido, salta.

Os testes que mocam `../components/MapView` em telas que passam para a cena (as visões de equipe do `OrderDetail`) passam a mocar `../map/useMapScene`.

### 6.3 Shell e navegação

O mockup v6 e o protótipo v2 mostram o shell no desktop.

- **Menu lateral (`Rail`):** vidro regular, 64 px recolhido, fixo à esquerda com margem de 16 px.
  - Contém o selo "KJ" laranja, o botão de expandir e os ícones agrupados por Operação, Cadastros, Análise e Administração, com divisores curtos. Grupos sem item permitido somem.
  - Item ativo em pílula `--color-active-bg`.
  - Tooltip opaco à direita no estado recolhido.
  - Expandido, ocupa 240 px como sobreposição temporária opaca (`--color-solid-raised`), porque cairia sobre painéis de vidro. Não empurra o conteúdo, fecha ao navegar, ao clicar fora ou com Esc, e não guarda preferência.
- **Controles globais (`ShellControls`):** canto superior direito, sobre o mapa ou o fundo:
  - sino de alertas (vidro clear, contador, popover opaco);
  - alternância de tema (vidro clear);
  - chip do usuário (vidro regular: avatar com iniciais do `username`, `username` e o perfil por extenso; menu opaco com "Minha conta" e "Sair").
- **Bloco de título:** não existe mais barra superior. Cada tela tem um bloco de título no canto superior esquerdo:
  - chips de estado: "Tempo real" e o rótulo da conexão;
  - título;
  - linha de metadados ou, no dashboard, o seletor de período.
- **Rolagem nas telas não imersivas:** bloco de título, barra de filtros e controles globais ficam fixos. Só a área de conteúdo abaixo deles rola, sem barra de rolagem visível.
- **Indicador STOMP:** o chip "Tempo real" fica limão com ponto pulsante quando conectado. Ao reconectar, vira um chip âmbar "Reconectando", com ícone que gira. Offline, vira um chip cinza tracejado "Offline". Ele aparece no bloco de título de todas as telas autenticadas, com o mesmo `role="status"` e `aria-label` de hoje.
- **CUSTOMER:** menu lateral reduzido (Dashboard, Pedidos, Novo pedido, Meus endereços, Tendência anual), fundo ambiente sempre e nenhuma tela imersiva.
- **Transição de página:** os vidros da tela que sai descem 10 px, desfocam e somem em 220 ms. Os da nova entram com mola em 900 ms (assentam visualmente em cerca de 500 ms), escalonados em 70 ms a partir de 120 ms. Enquanto isso, o mapa contínuo faz a viagem de câmera. A animação vai em cada vidro, nunca no wrapper (§5.3, regra 12).

### 6.4 Fundo ambiente (telas não imersivas)

O vidro precisa de textura atrás para parecer vidro. Nas telas sem mapa, o fundo usa:
- dois gradientes radiais, um limão no canto superior direito e um menta no canto inferior esquerdo, sobre `--color-bg`;
- curvas de nível topográficas em SVG, finas (cerca de 7,5% de opacidade no escuro e 10% no claro), geradas uma vez e **paradas**. O fundo derivando custava 61 → 25 fps (§5.3, regra 11).

Sobre esse fundo, o conteúdo vive em painéis de vidro regular. Tabelas, formulários e listas ficam chapados dentro deles.

### 6.5 Movimento

- **Tokens:**
  - `--ease-spring`: mola em `linear()` sem repique perceptível, para entradas e mudanças de layout;
  - `--ease-spring-bouncy`: mola com repique, para elementos pequenos que "aparecem" (pontos, marcadores);
  - `--ease-out`: `cubic-bezier(.2,.8,.2,1)`;
  - os valores de `linear()` são os do protótipo.
- **Vidros (painéis, cartões, barras):** entram de opacidade 0, 22 px abaixo, escala 0,965 e blur de 10 px, em 900 ms com `--ease-spring`, escalonados. Saem em 220 ms.
- **Conteúdo dentro do vidro:**
  - linhas e itens sobem 10 px em 800 ms, escalonados 50–110 ms;
  - barras crescem da esquerda (`scaleX`) em 1,1 s;
  - pontos do funil aparecem com repique, escalonados 28 ms;
  - números contam de 0 até o valor em 1,4 s, desacelerando, na primeira exibição. Quando o valor muda, contam do antigo ao novo em 600 ms, e o container recebe um realce curto, uma vez;
  - renders de veículo "chegam" deslizando 46 px da direita em 1,2 s. No cartão, o hover desloca 8 px e aumenta para 1,035, com mola.
- **Mapa:**
  - desenho progressivo da rota em cerca de 1,4 s ao abrir o pedido;
  - arcos do plano desenhados em 900 ms; depois, cometas percorrem cada arco duas vezes (período de 2,2 s, defasados) e param;
  - haste dos rótulos HUD cresce em 800 ms;
  - marcadores entram com fade e escala;
  - viagens de câmera, giro de entrada e câmera de acompanhamento (§5.6, §7.5).
- **Seleção:** a câmera voa até o alvo. Na lista, o item ganha preenchimento de destaque e um deslocamento de 3 px.
- **Filtros:** a lista reordena com fade cruzado. Os marcadores filtrados somem com fade.
- **`prefers-reduced-motion: reduce`:** remove animação, pulso, contagem (mostra o valor final) e viagem de câmera (vira salto direto). Só ficam mudanças de estado instantâneas.

## 7. Telas

Para cada tela: as fontes de dados existentes (todas já usadas pelo frontend atual) e a composição. Comportamentos, estados (carregando, vazio, erro, sem permissão) e textos atuais são preservados, salvo quando indicado.

### 7.1 Mapa ao vivo (`/map`, equipe): segue o mockup v6

- **Dados:** os mesmos do `LiveMap.tsx` atual.
  - motoristas paginados até o total;
  - `/dashboard/fleet/status` para o selo "Sem sinal" (exceto DISPATCHER);
  - `/topic/fleet/locations`;
  - para o selecionado: pedido ativo (`/orders?driverId&active&limit=1`) e rota (`/orders/:id/route`).
- **Mapa:** plano. Motoristas com posição; rota do pedido ativo do selecionado, com pernas, paradas e pílulas de km.
- **Barra de comando (topo, centro):** busca por nome ou placa, segmento de status com contagens e seletor de frota.
- **Painel direito:**
  - cartão do motorista selecionado: iniciais, nome, status, "Sem sinal", e blocos de placa, tipo de veículo, último sinal e frotas;
  - pedido ativo: código com link, status, barra de paradas concluídas sobre o total, total de km, ETA da rota, próxima parada com `legKm`;
  - ações "Abrir pedido" e "Ver motorista";
  - lista de motoristas abaixo.
- **Base:**
  - "Frota agora": barra empilhada por status;
  - "Sem sinal": contagem e nomes, só quando o perfil recebe `pingStale`;
  - legenda.
- **Controles do mapa (esquerda, embaixo):** aproximar, enquadrar todos e afastar.
- **Estados:**
  - sem motoristas: estado vazio flutuante com o link de hoje;
  - sem conexão: o chip de conexão muda e um aviso âmbar flutuante, "As posições podem estar desatualizadas", fica embaixo do título.

### 7.2 Central de despacho (`/dispatch`, ADMIN e DISPATCHER): mesa de planejamento

- **Dados existentes:**
  - fila (`/dashboard/dispatch/queue`);
  - motoristas e veículos (`limit=100`);
  - `POST /dispatch/plan` (prévia e aplicação);
  - `POST /orders/:id/dispatch` por pedido.
- **Dados novos:** `GET /orders/:id` dos itens visíveis de "Sem motorista" e "Atribuídos". O mapa precisa das coordenadas e as listas não as têm. Os marcadores aparecem conforme chegam.
- **Mapa:** plano (inclinação 0, terreno desligado), com a grade de pontos mais visível, como numa mesa.
  - retirada de cada pedido da fila; pedido parado ganha anel âmbar e rótulo HUD "Parado · N min";
  - motoristas com posição, com status pela forma;
  - pedido selecionado na lista: ganha também as paradas numeradas e a entrega, sem linha entre elas, porque não há rota calculada;
  - depois de calcular o plano: arcos motorista → retirada desenhados em 900 ms, cometas em duas passadas e a pílula de km do plano no meio de cada arco.
- **Barra de comando (topo, ao lado do título):** algoritmo (Húngaro ou Guloso), contagens de motoristas disponíveis e veículos livres, e a ação principal "Calcular plano".
- **Painel esquerdo, abaixo do título:**
  - abas "Sem motorista", "Atribuídos" e "Em andamento", com os totais da API;
  - cartões chapados. Em "Sem motorista", têm caixa de seleção, como hoje: só essa aba entra no plano. Cada cartão mostra código, tempo na etapa (âmbar com ícone quando parado) e uma mini-rota vertical: retirada, "+N paradas" (quando o `GET /orders/:id` chegou) e entrega;
  - "Atribuídos" sem seleção;
  - "Em andamento" mostra motorista, ETA e paradas, sem seleção.
- **Bandeja inferior:**
  - "Seleção · N pedidos" em número grande e fino;
  - antes do plano, uma linha explicando o que o cálculo mostra;
  - com plano: barras de comparação de km por algoritmo (de `plan.comparison`), atribuições em pílulas (código, motorista, placa, km), não atribuídos, e o estado por linha durante o despacho em lote (executando, ok, erro com mensagem);
  - "Aplicar plano", que exige confirmação com o modal atual, e "Despachar todos", que despacha as atribuições do plano aplicado e só habilita depois da aplicação.
- **Mensagens e regras:** iguais às de hoje (`planError`, "Nenhuma atribuição foi gravada", aviso de nenhum motorista elegível, invalidação de queries).

### 7.3 Dashboards (`/dashboard`, por perfil): vista aérea

Nenhum usa a fileira de quatro cards. Cada um tem **um número de destaque** em tipografia grande sobre o mapa, painéis temáticos à direita e uma doca inferior.

**Número de destaque:**
- Fica à esquerda, abaixo do título, sem painel.
- Atrás dele, um degradê de `--color-bg`:
  - horizontal: 92% na borda esquerda, 70% a 26% da largura, transparente a 46%;
  - vertical: 70% na base, transparente a 34% da altura.

  O degradê não é vidro, só garante a leitura sobre os rótulos do mapa.
- Composição:
  - rótulo pequeno;
  - o número em 148 px com contagem;
  - uma legenda com o `DeltaHint` contra o período anterior em chip;
  - uma grade 3 × 2 de estatísticas em 34 px, peso 200.

**Mapa:** terreno 2,4, inclinação de cerca de 73° com o céu no horizonte, enquadrado na área livre, e giro de entrada (§5.6). Rótulos HUD "Sem sinal · N min" sobre os motoristas com `pingStale`. Ao clicar num motorista, o mapa leva ao Mapa ao vivo com ele selecionado.

- **Administrador**
  - Dados: `/dashboard/admin` por período e `/dashboard/fleet/status` para as posições.
  - Bloco de título com o seletor de período (Hoje, 7 dias, 15 dias, 1 mês) em vidro.
  - Destaque: taxa de sucesso do período, com "N pedidos finalizados" e o delta.
  - Grade: criados, concluídos, falhas e cancelados (com a divisão `cancelledByCustomer` e `cancelledByStaff`), espera média (`avgWaitMinutes`), ciclo médio (`avgCycleMinutes`) e prova de entrega (`podRate`, com o denominador). As taxas de falha e cancelamento aparecem como legenda de suas contagens. Cada indicador mantém o `DeltaHint` que tem hoje.
  - Painel direito, "Frota agora":
    - barra empilhada de motoristas por status com legenda;
    - segunda barra de veículos por status (`vehiclesByStatus`);
    - lista dos motoristas (iniciais, nome, placa, último sinal, status ou "Sem sinal"), com fade na base indicando rolagem;
    - link "Mapa ao vivo";
    - alertas em chips com contagem.
  - Doca inferior, em três painéis:
    - "Funil agora": matriz de pontos por etapa (`byStage`), com legenda "1 ponto = 1 pedido". Pedidos parados (`staleByStage`) aparecem como pontos vazados em âmbar. O número exato fica sob cada coluna, e cada coluna é um link (como `stageLink`). O teto é de 12 pontos por coluna (2 × 6). Se alguma etapa passar de 12, cada ponto vale `k = ceil(máximo / 12)` pedidos, a legenda passa a "1 ponto = k pedidos", e os vazados são `ceil(parados / k)`;
    - "Motivos de falha": barras horizontais de `topFailureReasons`;
    - "Economia de rotas": km economizados (`savedKm`) em número grande com contagem, `avgSavingsPct` em chip, "N rotas · planejado vs. ordem original", barras de `plannedKm` contra `baselineKm` e o link.
- **Despachante**
  - Dados: `/dashboard/dispatch`.
  - Destaque: pedidos aguardando (`counts.waitingOrders`), com "N motoristas disponíveis" (`counts.availableDrivers`).
  - Grade: indicadores de `summary` do período.
  - Painel direito: motoristas disponíveis (`availableDrivers`) e alertas.
  - Doca: fila resumida ("Sem motorista" e "Atribuídos", com parados) com link para o despacho e funil.
  - Mapa: motoristas disponíveis com posição.
- **Gestor de frota**
  - Dados: `/dashboard/fleet`.
  - Destaque: motoristas disponíveis agora (`fleet.availableDrivers`) sobre o total de motoristas.
  - Painel direito: frota por status, sem sinal e alertas.
  - Doca: desempenho dos motoristas (tabela compacta chapada) e dimensionamento (`sizing.perDay` em gráfico Recharts com o tema novo).
  - Mapa: todos os motoristas (`fleet.drivers`).
- **Cliente:** sem mapa e sempre no fundo ambiente. Detalhes em §7.9.
- **Gráficos (Recharts):** tema novo (eixos em `--color-text-subtle`, grade quase invisível, série principal limão, cores semânticas), tooltip opaco e estado vazio informativo.

### 7.4 Pedidos (`/orders`)

Tela não imersiva. O `OrderSummary` não tem coordenadas, por isso a lista não tem mapa.

- Bloco de título com a ação "Novo pedido", para quem tem permissão.
- Barra de filtros em vidro (busca, status, ativo e o que mais existir hoje), fixa.
- Abaixo, a área rolável com a tabela chapada num painel de vidro (código em mono, status em pílula, mini-rota retirada → entrega, motorista, placa, criado, finalizado), com a paginação atual.
- Selecionar uma linha abre o painel lateral (§7.10.2) com o resumo (status grande, envolvidos, linha do tempo de paradas) e "Abrir pedido". Clicar no código navega direto.
- Abaixo de 768 px, a tabela vira lista de registros.

### 7.5 Detalhe do pedido (`/orders/:id`): câmera de acompanhamento

- **Equipe:** tela imersiva.
  - **Dados:** os mesmos de hoje, mais `GET /vehicles/:publicId` do veículo do pedido, para o tipo e o status. `OrderDetail.vehicle` traz só `publicId` e `plate`. A chave de cache é `["vehicle", id]`, e o endpoint já é permitido a ADMIN, DISPATCHER e FLEET_MANAGER.
  - **Painel esquerdo:**
    - link "Pedidos";
    - código em mono;
    - status grande, com ponto pulsante nos status ativos;
    - cliente e hora de criação;
    - "Paradas" numa linha do tempo vertical: marcador concluído com ✓, a próxima destacada com brilho, as seguintes vazadas e a entrega em losango. O traço é sólido na cor da rota até a última concluída e tracejado depois. Cada item tem nome e nota: hora de conclusão, `legKm` ou "trecho estimado";
    - ações: próxima ação (`nextAction`), atribuir, falhar e cancelar conforme as regras atuais, com os modais atuais. Os botões ocupam a largura e quebram em linhas.
  - **Cartão do veículo (direita, em cima):**
    - render 3/4 do tipo (§5.7) saindo pelo topo do cartão, sobre um foco radial;
    - placa em 26 px, status do veículo, tipo e último sinal;
    - linha do motorista: iniciais, nome e status.

    Sem veículo atribuído, o cartão mostra o estado vazio, sem render.
  - **Abas (direita, embaixo):**
    - "Carga": itens (`name` × `quantity`), prova de entrega (`podRequired`), observações (`notes`) e motivo de falha;
    - "Linha do tempo": eventos;
    - "Cliente": os campos do cliente que a API devolve hoje.
  - **Faixa inferior (`RouteBlock`):**
    - algoritmo;
    - stepper R → paradas → E, com preenchimento até a última concluída e rótulos curtos;
    - chip "N trecho(s) estimado(s)" (`FallbackNotice`);
    - total (`totalKm`), original (`baselineKm`) e economia (`savingsPct`);
    - ETA (`etaMinutes`) em número grande com contagem;
    - "Recalcular", como hoje.
  - **Mapa:** terreno 1,3.
    1. Ao abrir, a câmera enquadra a rota a 30°, e as pernas se desenham.
    2. Se o motorista tem posição e o pedido está a caminho ou em andamento, a câmera voa (3,4 s) para o veículo: zoom 15,4, inclinação 68°, direção apontando para o trecho à frente na geometria da perna, com padding igual aos insets dos painéis. Os prédios aparecem nessa altura.
    3. A cada posição real recebida, o marcador desliza (§6.2), e a câmera recentra e reorienta em 800 ms. Entre sinais, a câmera fica parada.
    4. Um gesto do usuário suspende o acompanhamento, e um botão redondo de vidro "Seguir veículo" o retoma.
    5. Sem posição, a câmera fica na visão geral.

    Rótulo HUD "Próxima parada · nome" sobre a próxima parada; pílulas de km nas pernas.
- **Cliente:** não imersiva e sem mapa, como hoje. O layout é editorial: status grande, ETA da API, linha do tempo e paradas, sem nenhum dado interno.

### 7.6 Novo pedido (`/orders/new`)

Tela não imersiva. O formulário não fica sobre o mapa.

- Duas colunas no desktop:
  - à esquerda, seções de formulário em vidro regular (cliente, retirada, paradas, entrega, itens, POD e observações), com campos chapados;
  - à direita, prévia geográfica fixa, com `MapView` embutido num quadro de vidro, com a escolha de ponto por clique e o aviso de coordenada manual.
- Todos os campos, validações (incluindo o limite de 50 paradas) e mensagens atuais ficam iguais.
- Abaixo de 1024 px, uma coluna, com a prévia recolhível acima das ações.

### 7.7 Simulador de rota (`/routes/optimize`)

Tela imersiva, inspirada na primeira referência, com o mapa plano.

- **Dados:** os mesmos de hoje (pontos clicados, importação de um pedido, `POST /routes/optimize`).
- **Mapa:**
  - modo de escolha exclusivo (clique define latitude e longitude);
  - pontos marcados;
  - rota otimizada com a semântica sólida e tracejada, desenho progressivo e pílulas de km;
  - camada "Ordem original (linha reta)" na ordem digitada, com alternância para mostrar ou ocultar.
- **Esquerda:** alvo do clique (Início, Retirada, Parada, Entrega) em segmento, lista de pontos com coordenadas em mono e remover, e importar de um pedido.
- **Topo:** algoritmo e opções (`AlgorithmFields`, semente, comparar) e "Otimizar".
- **Direita, ao ter resultado:**
  - número grande de km otimizado contra `baselineKm`;
  - economia em %;
  - ETA;
  - tabela de comparação por algoritmo (km e ms);
  - `FallbackNotice`.

### 7.8 Gestão e cadastros

Telas não imersivas, todas sobre o fundo ambiente com painéis de vidro: Motoristas, Frotas, Lugares, Clientes, Usuários, Detalhe do motorista, Detalhe da frota, Meus endereços, Alertas, Tendência anual, Economia de rotas, Mapa viário e Minha conta.

- Barra de filtros fixa e tabela chapada dentro de vidro, na área rolável, mantendo `CatalogFilters` e `DataTable` (refeitos visualmente).
- Detalhe, criação e edição abrem no painel lateral (§7.10.2). Confirmações em modal opaco.
- Detalhe do motorista e Mapa viário: mapa embutido num quadro de vidro.
- Lugares e Meus endereços: escolha de ponto no mapa embutido.
- O ponto de vista de cada uma está em §7.10.3.

**Veículos (`/vehicles`) tem composição própria, a garagem:**
- **Bloco de título:** "Veículos", com a linha de contagens (total, disponíveis, em uso, em manutenção).
- **Barra fixa em vidro (pílula):**
  - segmento de status (Todos, Disponível, Em uso, Manutenção) com contagens;
  - busca por placa ou tipo (parâmetro `q`);
  - "Novo veículo", para quem tem permissão.
  - As contagens vêm do `total` de `GET /vehicles?status=…&limit=1`, com parâmetros que já existem, em cache.
- **Área rolável:** grade de cartões de vidro (mínimo de 262 px, 238 px de altura, raio de 26 px). Cada cartão tem:
  - placa em mono 20 px;
  - pílula de status do veículo;
  - "tipo · motorista" ou "Sem motorista";
  - o render lateral saindo pela borda inferior direita.

  Veículos inativos, quando listados, ficam atenuados com o chip "Inativo".
- **Detalhe:** selecionar um cartão abre um painel de vidro à direita (450 px), e a grade encolhe com mola. O painel tem:
  - render 3/4 grande;
  - placa em 40 px, tipo e status;
  - linhas "Motorista atual", "Status" e "Cadastro" (Ativo ou Inativo);
  - as ações de hoje ("Editar" troca o painel para o modo formulário, com campos chapados).

  Fechar com o botão, com Esc ou clicando de novo no cartão.
- **Paginação:** a atual, ao fim da grade.

### 7.9 Área do cliente

- Dashboard sem mapa:
  - "Em andamento", em cartões editoriais com código, status, ETA da API, barra de paradas, motorista pelo nome e cancelar quando `cancellable`;
  - "Precisa de atenção";
  - "Entregues recentemente", com POD;
  - resumo do período, respeitando o payload reduzido.
- Nenhum dado interno, nenhuma posição de motorista.
- **Rastreio público (`/track`):** sem mapa e sem posição. Um cartão de vidro sobre o fundo ambiente com campo de código, status, ETA e linha do tempo.
- **Login e cadastro:** mapa recolorido estático em tela cheia (sem interação, sem animação, sem terreno, centrado na região padrão) atrás de um cartão de vidro regular com a marca, o formulário e os atalhos de login de desenvolvimento atuais.

### 7.10 Telas sem mockup

Só Mapa ao vivo, Dashboard do administrador, Detalhe do pedido, Despacho e Veículos foram prototipados. Todas as outras telas precisam do mesmo nível de acabamento, por exigência do dono do produto. Uma tela que só troca as cores de uma tabela não está pronta.

#### 7.10.1 Critério de pronto (vale para toda tela)

1. **Ponto de vista próprio:** a tela tem uma ideia de composição que diz para que ela serve, escrita no plano em uma linha (§7.10.3), e não é uma tabela genérica com título.
2. **Um elemento de destaque:** um número grande e fino, um nome ou status grande, um render ou um mapa. A hierarquia tipográfica de §5.2 é seguida: números em peso 200 com unidade pequena, rótulos pequenos em caixa alta e títulos de painel em 15 px.
3. **Movimento:** entrada escalonada dos vidros, conteúdo que sobe, contagem nos números, barras que crescem e hover com mola, conforme §6.5. Só movimento finito atrás do vidro.
4. **Vidro:** as regras de §5.3, sem exceção. Dentro do vidro, tudo chapado.
5. **Recursos visuais onde o dado existe:**
   - render do veículo sempre que um veículo aparece com tipo conhecido;
   - avatar de iniciais para pessoas;
   - mapa embutido sempre que houver coordenadas;
   - mini-rota ou linha do tempo vertical sempre que houver paradas.
6. **Estados desenhados:** carregando (skeleton chapado dentro do vidro), vazio (ícone, frase e ação, sobre as curvas de nível), erro (mensagem e "Tentar de novo") e sem permissão. Nenhum estado é só uma linha de texto.
7. **Dois temas e três larguras** (§8), verificados com captura.
8. **Honestidade dos dados:** só o que a API devolve, como no resto do documento.

#### 7.10.2 Padrões compartilhados

Construídos na etapa 1 e reaproveitados em todas as telas:

| Padrão | Origem | Uso |
|---|---|---|
| `HeroNumber` | Dashboard | Número de destaque com contagem, unidade, rótulo e delta opcional |
| `StopTimeline` | Detalhe do pedido | Linha do tempo vertical de paradas (concluída, próxima, a fazer, entrega em losango) |
| `MiniRoute` | Despacho | Retirada → "+N paradas" → entrega, compacta, para listas e cartões |
| `VehicleCard` | Detalhe do pedido | Render saindo do cartão, placa, status, tipo e motorista |
| `SidePanel` | Veículos | Painel de vidro à direita (cerca de 450 px). A lista encolhe com mola para ele não cair sobre outro vidro. Tem modo detalhe e modo formulário (campos chapados) e fecha com botão, Esc ou novo clique |
| `StatusPill` | Todas | Pílula com ponto, cor semântica e rótulo em português |
| `DotMatrix` | Dashboard | Contagem em pontos com teto e escala (§7.3) |
| `HudLabel` | Mapa | Rótulo HUD com haste |
| `GlassMapFrame` | Novo pedido | Mapa embutido num quadro de vidro, plano, com a mesma recoloração |
| `EmptyState` | Todas | Ícone, frase, ação, sobre as curvas de nível |

O `SidePanel` substitui o drawer opaco no detalhe, na criação e na edição de cadastros e na prévia da lista de pedidos. Modais opacos continuam só para confirmações. Abaixo de 1024 px, ele vira bottom sheet; abaixo de 768 px, tela cheia.

#### 7.10.3 Ponto de vista de cada tela

| Tela | Ponto de vista | Destaque | Recursos |
|---|---|---|---|
| Pedidos | Mesa de pedidos | Contagens por status no segmento do filtro | `MiniRoute` nas linhas; `SidePanel` com status grande e `StopTimeline` |
| Novo pedido | A rota sendo montada | O próprio formulário de paradas é uma `StopTimeline` que cresce a cada parada adicionada | `GlassMapFrame` com os pontos aparecendo conforme são preenchidos |
| Simulador de rota | Laboratório de rota (§7.7) | km otimizado em `HeroNumber` contra `baselineKm` | Desenho progressivo da rota; comparação em barras |
| Motoristas | Equipe | Contagens por status | Linhas com avatar, status, veículo atual com render lateral pequeno (tipo vindo de `Driver.vehicle.type`, que a lista de motoristas já devolve) e último sinal; `SidePanel` com avatar grande, nome, status, `VehicleCard` e mini mapa da última posição |
| Detalhe do motorista | Perfil do motorista | Nome e status grandes | `VehicleCard`; `GlassMapFrame` com a última posição; pedidos recentes com `MiniRoute`; números de desempenho em peso 200, quando o perfil tem acesso |
| Frotas | Grupos da operação | Total de motoristas por frota | Cartões de vidro com barra empilhada por status e avatares sobrepostos; `SidePanel` com membros |
| Detalhe da frota | A frota no território | Nome e contagem | `GlassMapFrame` com os motoristas da frota; lista de membros com status |
| Lugares | Pontos da operação | Contagem de lugares | `GlassMapFrame` com todos os pinos; selecionar na lista voa o mapa até o pino; criação e edição com escolha no mapa |
| Clientes | Carteira | Contagem de clientes | Avatares de iniciais; `SidePanel` com dados e ações |
| Usuários | Acesso | Contagem por perfil | Pílulas de perfil; `SidePanel` para editar e desativar, como hoje |
| Meus endereços (cliente) | Meus lugares | — | Igual a Lugares, sem dados internos |
| Alertas | Central de atenção | Total de alertas em `HeroNumber` | Agrupados por tipo, com faixa de cor de severidade e o link de cada alerta |
| Tendência anual | O ano em uma curva | Total do ano em `HeroNumber` | Gráfico de área Recharts com gradiente limão desenhado da esquerda para a direita |
| Economia de rotas | Quanto as rotas pouparam | km economizados em `HeroNumber` | Barras planejado contra original por algoritmo; lista de rotas |
| Mapa viário | O grafo de ruas | Status do grafo | `GlassMapFrame` grande |
| Minha conta | Perfil | Avatar grande com iniciais | Seções em vidro; troca de senha com campos chapados |
| Dashboard do despachante | Vista aérea da fila | Pedidos aguardando (§7.3) | Mapa com terreno; fila resumida |
| Dashboard do gestor de frota | Vista aérea da frota | Motoristas disponíveis (§7.3) | Mapa com terreno; desempenho e dimensionamento |
| Dashboard do cliente | Minhas entregas | "N em andamento" em `HeroNumber` | Cartões editoriais com status grande, ETA em peso 200 e barra de paradas |
| Detalhe do pedido (cliente) | Onde está meu pedido | ETA da API em `HeroNumber` | Status grande; `StopTimeline` |
| Rastreio público | Consulta por código | Status grande | Cartão de vidro sobre o fundo ambiente; `StopTimeline`; ETA em peso 200 |
| Login e cadastro | Entrada | Marca | Mapa estático atrás do cartão (§7.9) |
| Páginas de sistema (404, 403, erro) | Fora do caminho | Código em 148 px, peso 200 | Curvas de nível; frase e ação de volta |

Na etapa de cada tela, o plano detalha a composição a partir desta tabela antes de escrever código.

## 8. Responsividade

| Largura | Comportamento |
|---|---|
| ≥ 1280 px | Composição completa |
| 1024–1279 px | Painel direito com 320 px; blocos inferiores secundários somem; a barra de comando desce para baixo do título; número de destaque em 112 px |
| 768–1023 px | O painel direito vira um bottom sheet de vidro com três alturas (recolhido, médio, cheio) e alça de arraste. O menu lateral fica sempre recolhido. Inclinação máxima de 60° |
| < 768 px | Barra superior compacta de vidro (selo, título, botão de menu); o menu vira drawer opaco. Nas telas imersivas, mapa em tela cheia, com bottom sheet com abas (lista, detalhe) e controles do mapa à direita, acima da folha. Terreno desligado. Formulários em uma coluna; tabelas viram listas de registros; alvos de toque de pelo menos 44 px |

## 9. Novo DESIGN.md

Na etapa 1, o `docs/DESIGN.md` é reescrito por inteiro com:
- a direção (§1 a §5 deste documento);
- os tokens;
- as regras do vidro líquido, incluindo as de movimento atrás do vidro e de ancestral sem animação;
- a semântica do mapa e o mapa 3D;
- os renders de veículos;
- os componentes e estados;
- o movimento e a acessibilidade;
- as restrições funcionais.

Ele substitui o documento laranja e grafite. As restrições funcionais do §14 antigo são mantidas, atualizadas para o que já existe: edição de perfil, troca de senha e edição e desativação de usuários já existem na API e no frontend.

## 10. Verificação

- **A cada etapa:**
  - `npm run build`, `npm run lint` e `npm run test -- --run` verdes;
  - verificação visual em Chromium nos dois temas, a 1440 × 900, 1024 × 768 e 390 × 844, com captura de tela.
- **Desempenho (pelo menos 55 fps, Chrome neste Mac, 1440 × 900, uma única aba aberta).** Uma segunda aba com o app derruba a medição, como aconteceu com o protótipo. Cenários:
  - Mapa ao vivo: pan e zoom com todos os painéis;
  - Dashboard: voo de chegada e giro de entrada;
  - Detalhe do pedido: câmera de acompanhamento com posições chegando;
  - Despacho: desenho dos arcos e cometas;
  - Veículos: rolagem da grade.
- **Dados para verificar:** o banco de desenvolvimento está vazio. Um script local fora do repositório, na pasta de rascunho da sessão, cria pela API motoristas, veículos (com tipos Van, Furgão, Caminhão leve, Caminhão e Moto), frotas, lugares e pedidos na região padrão e despacha alguns. O `scripts/DriverSimulator.java` existente movimenta os motoristas.
- **Testes novos:**
  - perfil de refração (zero na borda e no centro, pico interno, normalização);
  - mapas (dimensões, neutro 128 fora do bisel);
  - transformação do estilo (camadas escondidas, cores aplicadas por tema, `building-3d` visível, fontes `dem` e `dem-shade`, céu);
  - diferença de cena e reset do padding antes do enquadramento;
  - `vehicleRender` (caminhão, van, furgão, utilitário, moto → `null`);
  - escala da matriz de pontos (até 12, acima de 12, parados);
  - `Glass` aninhado renderiza chapado.
- Os testes existentes são atualizados quando o markup mudar, sem remover asserções de comportamento.

## 11. Execução

A ordem é do dono do produto. Cada etapa é concluída e validada no navegador antes da próxima. Ao fim de cada etapa, o dono do produto vê as capturas das telas dela nos dois temas, conferidas contra o critério de pronto (§7.10.1), e só então começa a próxima. O trabalho acontece numa branch `feat/geospatial-redesign`, com um commit por etapa.

1. Identidade visual e tokens:
   - fontes;
   - `tokens.css` e as molas;
   - motor de vidro e fundo ambiente;
   - primitivas (botões, campos, segmentos, badges, popover, modal, toast, skeleton, vazio, erro) e os padrões compartilhados de §7.10.2;
   - `useCountUp`;
   - renders de veículos em `public/vehicles`, `vehicleRender` e o estúdio em `docs/design`;
   - o novo DESIGN.md.
2. Shell e navegação: `Rail`, `ShellControls`, bloco de título, `MapStage` com recoloração, relevo, prédios e céu, `useMapScene` com câmera, terreno, giro e acompanhamento, `mapMotion` e transição de página.
3. Mapa ao vivo.
4. Central de despacho.
5. Dashboards.
6. Pedidos e detalhe do pedido.
7. Simulador de rotas.
8. Gestão e cadastros, com a garagem de Veículos.
9. Área do cliente, rastreio público, login e cadastro.
10. Refinamento geral: responsividade, acessibilidade, desempenho, consistência e documentação de telas em `docs/flows/frontend/`.

## 12. O que fica com quem implementa

- Divisão interna de componentes e CSS dentro de cada etapa, desde que siga §6.1 e as regras do vidro.
- Valores finos de espaçamento, raio e tamanho tipográfico, partindo do protótipo v2 e do mockup v6.
- Valores finos de câmera (zoom, inclinação, direção) por tela, dentro dos limites de §5.6.
- Ícones Lucide específicos de cada item.
- Formato exato das curvas de nível do fundo ambiente.
- Distribuição fina dos painéis nos dashboards do despachante e do gestor de frota, respeitando §7.3 e o antiobjetivo da fileira de cards.

## 13. Decisões tomadas por mim (para conferência)

**Da primeira versão:**
1. Fundo ambiente com curvas de nível topográficas nas telas sem mapa, para o vidro ter textura.
2. CUSTOMER nunca vê o mapa contínuo. O detalhe do pedido do cliente continua sem mapa, como hoje.
3. Lista de pedidos sem mapa, porque não há coordenadas no resumo, com painel lateral de prévia.
4. Pedido selecionado no despacho mostra paradas e entrega sem linha entre elas, porque não há rota calculada.
5. Arcos curvos para as atribuições do plano, com estilo próprio fora da semântica de rota.
6. Toasts, popovers, tooltips, modais e drawers são opacos, nunca vidro.
7. Login com mapa recolorido estático atrás do cartão.
8. Script de dados de verificação fora do repositório.
9. Abaixo de 1024 px, os painéis viram bottom sheet de vidro.

**Da revisão do construtor:**

10. No despacho, só "Sem motorista" tem seleção e entra no plano, como hoje. "Despachar todos" despacha as atribuições do plano aplicado.
11. Menu lateral expandido é sobreposição temporária e opaca e não guarda preferência. Isso muda o comportamento atual, que guarda.
12. Nas telas não imersivas, título, filtros e controles globais ficam fixos, e só a área de conteúdo rola.
13. A referência de 55 fps é o Chrome deste Mac. A ordem de corte está em §5.3, regra 13, e nenhum corte visível é feito sem aviso.

**Desta rodada (protótipo v2):**

14. Fonte do sistema Apple (SF Pro) com Inter de reserva e mono do sistema. Sai a Outfit, a Plus Jakarta Sans e a Geist Mono da versão anterior, e não entra dependência nova.
15. Terreno 3D e céu só nos dashboards e no detalhe do pedido. Mapa ao vivo, despacho, simulador e login ficam planos, porque são telas de precisão.
16. Giro de entrada finito no dashboard no lugar da órbita contínua do protótipo, porque a contínua custava 60 → 44 fps.
17. Fundo ambiente parado, porque derivando custava 61 → 25 fps.
18. Cometas do despacho fazem duas passadas e param, porque em laço custavam 25 fps.
19. Câmera de acompanhamento no detalhe do pedido: recentra a cada posição real, para entre sinais, é suspensa por gesto e retomada pelo botão "Seguir veículo".
20. O marcador desliza 600 ms em linha reta entre duas posições reais. Isso substitui a decisão anterior de saltar: o salto parecia falha, e o deslize não estima posição nem segue ruas.
21. O número de destaque do dashboard não tem painel, fica sobre um degradê, e é a única exceção à regra de vidro.
22. Funil em matriz de pontos, com teto de 12 pontos por etapa e escala "1 ponto = k pedidos" acima disso.
23. Tipo e status do veículo no detalhe do pedido via `GET /vehicles/:publicId`, já permitido aos três perfis de equipe.
24. Renders em WebP em `public/vehicles`, escolhidos por expressão regular sobre o tipo, sem render de moto (ícone no lugar) e com o estúdio guardado em `docs/design` para gerar novos.
25. Contagens dos filtros de Veículos via `total` de `GET /vehicles?status=…&limit=1`.
26. Número de destaque por perfil: taxa de sucesso (administrador), pedidos aguardando (despachante) e motoristas disponíveis (gestor de frota).

**Telas sem mockup:**

27. Critério de pronto único para todas as telas (§7.10.1) e um ponto de vista por tela (§7.10.3), definidos por mim a partir do pedido do dono do produto.
28. O painel lateral de vidro, com a lista encolhendo, substitui o drawer opaco no detalhe, na criação e na edição de cadastros e na prévia da lista de pedidos.
29. Revisão do dono do produto, com capturas, ao fim de cada etapa.
