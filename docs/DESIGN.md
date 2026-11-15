# DESIGN.md — KJ Fleets

## 1. Direção visual

A interface web da KJ Fleets deve transmitir **controle operacional, precisão logística, robustez e confiança**. A identidade parte do guia de marca: fundo grafite quase preto, laranja operacional intenso, branco de alto contraste e cinza técnico. O resultado deve lembrar uma central moderna de operações logísticas, não um dashboard SaaS genérico.

A marca combina três ideias:
- **Movimento:** diagonais, cortes inclinados e linhas que sugerem deslocamento.
- **Precisão:** alinhamento rigoroso, grids, dados tabulares e hierarquia tipográfica clara.
- **Operação:** laranja reservado para ações, estados ativos e informações que exigem atenção.

A interface deve ser predominantemente escura. O modo claro é uma alternativa funcional, não uma identidade visual diferente.

### Princípios

1. Informação operacional vem antes da decoração.
2. O laranja destaca; não deve pintar a interface inteira.
3. Dados densos precisam continuar legíveis, inclusive em tabelas e mapas.
4. Status nunca pode ser comunicado apenas por cor: usar rótulo e, quando útil, ícone.
5. Componentes devem manter a mesma linguagem em dashboards, cadastros e fluxos de pedido.
6. Não criar indicadores, ações ou informações que a API não fornece.
7. Evitar glassmorphism, gradientes exagerados, sombras pesadas, animações constantes e aparência de template automático.

## 2. Cores

### 2.1 Paleta da marca

| Token | Valor | Função |
|---|---|---|
| `brandOrange` | `#FF6A00` | Laranja Operacional: CTA, seleção, destaques e marca |
| `brandGraphite` | `#0F1115` | Grafite Confiável: fundo principal escuro |
| `brandGray` | `#687280` | Cinza Técnico: elementos secundários e superfícies auxiliares |
| `brandWhite` | `#FFFFFF` | Branco Clareza: texto principal e superfícies claras |

### 2.2 Tema escuro (padrão)

| Token | Valor sugerido | Uso |
|---|---|---|
| `colorBackground` | `#0F1115` | Fundo geral da aplicação |
| `colorSurface` | `#171A20` | Cards, sidebar e painéis |
| `colorSurfaceRaised` | `#20242C` | Menus, popovers, drawers e elementos elevados |
| `colorSurfaceMuted` | `#252A33` | Campos, áreas secundárias e cabeçalhos de tabela |
| `colorBorder` | `#343A45` | Bordas e divisores |
| `colorText` | `#F5F6F7` | Texto principal |
| `colorTextMuted` | `#A7AFBA` | Texto secundário |
| `colorTextSubtle` | `#7E8794` | Metadados e informações auxiliares |
| `colorPrimary` | `#FF6A00` | Ação principal e seleção |
| `colorPrimaryHover` | `#E85F00` | Hover/pressed do laranja |
| `colorPrimarySoft` | `#3A2115` | Fundo discreto de seleção/destaque |
| `colorOnPrimary` | `#FFFFFF` | Texto/ícone sobre botão laranja |

### 2.3 Tema claro

| Token | Valor sugerido | Uso |
|---|---|---|
| `colorBackground` | `#F3F4F6` | Fundo geral |
| `colorSurface` | `#FFFFFF` | Cards, sidebar e painéis |
| `colorSurfaceRaised` | `#FFFFFF` | Menus e drawers |
| `colorSurfaceMuted` | `#F0F1F3` | Campos e cabeçalhos de tabela |
| `colorBorder` | `#D9DDE3` | Bordas e divisores |
| `colorText` | `#171A20` | Texto principal |
| `colorTextMuted` | `#59616D` | Texto secundário |
| `colorTextSubtle` | `#737D89` | Metadados |
| `colorPrimary` | `#F56600` | Ação principal e seleção |
| `colorPrimaryHover` | `#D95700` | Hover/pressed |
| `colorPrimarySoft` | `#FFF0E5` | Fundo de destaque |
| `colorOnPrimary` | `#FFFFFF` | Texto/ícone sobre botão laranja |

### 2.4 Cores semânticas

| Token | Escuro | Claro | Significado |
|---|---|---|---|
| `colorSuccess` | `#35B878` | `#168653` | Concluído, disponível, operação bem-sucedida |
| `colorWarning` | `#F0B34A` | `#946000` | Atenção, atraso, situação pendente |
| `colorDanger` | `#F06464` | `#C43D3D` | Falha, cancelamento, erro |
| `colorInfo` | `#69A9E8` | `#246AA8` | Informação neutra |
| `colorOffline` | `#7E8794` | `#687280` | Sem conexão/sinal |

O laranja da marca não substitui as cores semânticas. `#FF6A00` significa ação ou foco da marca, não sucesso nem erro.

## 3. Tipografia

**Família principal:** sans-serif geométrica, robusta e contemporânea. Preferência por **Montserrat** para títulos e **Inter** para interface e leitura. Se não houver arquivos de fonte disponíveis, usar `Inter, Montserrat, Arial, sans-serif` como fallback geral.

| Estilo | Peso | Uso |
|---|---:|---|
| Display | 700–800 | Marca e números de destaque em dashboards |
| H1 | 700 | Título da página |
| H2 | 650–700 | Seções principais |
| H3 | 600 | Cards e blocos |
| Body | 400 | Texto e descrições |
| Label | 500–600 | Formulários e controles |
| Button | 600–700 | Ações |
| Caption | 400–500 | Datas, metadados e apoio |
| Data/ID | 500, monoespaçada | Coordenadas, códigos técnicos e identificadores |

- Títulos devem ser curtos e objetivos.
- Números de KPI podem ser grandes, mas não devem competir com o título da página.
- Códigos de rastreio, placas, IDs e coordenadas devem usar fonte monoespaçada quando isso melhorar a leitura.
- Evitar caixa alta em parágrafos. Usar caixa alta apenas em pequenos rótulos e categorias.

## 4. Marca e elementos gráficos

### 4.1 Logotipo

- Usar o logo horizontal completo no login e em áreas institucionais com espaço suficiente.
- Usar o monograma KJ em espaços compactos, como sidebar recolhida e favicon.
- Preferir versão clara sobre grafite e versão escura sobre branco.
- Não reconstruir o logo com texto, não alterar proporções, não inclinar novamente, não aplicar contornos ou sombras artificiais.
- Respeitar área de respiro ao redor da marca.
- A tagline “Soluções em frota e logística” pode aparecer no login e em apresentações institucionais; não precisa ocupar espaço permanente na navegação interna.

### 4.2 Elementos gráficos

- Diagonais e faixas inclinadas podem aparecer em banners, cabeçalhos institucionais e detalhes de destaque.
- Linhas de rota, mapas topográficos e trajetos podem inspirar divisores e fundos discretos.
- Esses elementos devem ter baixa intensidade visual e nunca ficar atrás de texto denso.
- Não usar fotos de caminhões como fundo de todas as páginas. Imagens são reservadas para login, onboarding ou áreas institucionais.

## 5. Iconografia

- Usar ícones lineares consistentes, preferencialmente Lucide.
- Traço regular, sem misturar ícones preenchidos, 3D e outline no mesmo contexto.
- Tamanho padrão: 18–20 px em controles, 20–24 px na navegação e 16 px em tabelas densas.
- Ícone acompanhado de texto em ações importantes. Tooltip pode complementar, não substituir, rótulos essenciais.
- Ícones de referência: truck, route, map-pin, package, shield-check, chart-no-axes-combined, users, gauge, alert-triangle, clock, settings, search.

## 6. Estrutura global da aplicação

### 6.1 Shell autenticado

- Sidebar fixa à esquerda em desktop, com opção de recolher.
- Top bar horizontal com título da página, contexto/subtítulo, seletor de período quando aplicável, estado da conexão, sino de alertas e menu do usuário.
- Área de conteúdo com largura fluida e espaçamento consistente.
- Sidebar deve agrupar navegação por **Operação**, **Cadastros**, **Análise** e **Administração**.
- Grupos sem itens permitidos para o perfil atual devem desaparecer.
- Item ativo recebe faixa/indicador laranja, texto claro e ícone destacado. Não usar fundo laranja sólido em toda a largura da sidebar.
- Perfil CUSTOMER usa a mesma linguagem visual, mas navegação reduzida e sem sidebar operacional desnecessária em telas públicas.

### 6.2 Responsividade

- Desktop é o cenário principal para operação e despacho.
- Em tablet, sidebar pode virar drawer e grids devem reduzir colunas.
- Em telas estreitas, tabelas devem permitir rolagem horizontal controlada ou virar lista de registros; filtros devem ficar em painel recolhível.
- O mapa deve preservar uma área útil mínima. Em mobile, lista e mapa podem alternar por abas.
- Formulários longos devem virar uma coluna; nunca comprimir campos em duas colunas ilegíveis.

### 6.3 Espaçamento e grid

- Unidade base: 4 px.
- Padding de página: 28–32 px em desktop; 16–20 px em tablet; 16 px em mobile.
- Gap entre cards: 16–20 px.
- Distância entre seções: 24–32 px.
- Altura mínima de controles: 40 px; alvos de toque mobile: 44–48 px.
- Largura máxima de formulários simples: 760–840 px.
- Conteúdo de dashboard pode usar toda a largura disponível.

## 7. Componentes

### 7.1 Sidebar

- Fundo `colorSurface`, borda direita `colorBorder`.
- Logo compacto no topo.
- Itens com ícone + rótulo; altura entre 40 e 44 px.
- Grupo com título discreto em `colorTextSubtle`.
- Item ativo com indicador lateral de 3 px em `brandOrange`, fundo `colorPrimarySoft` e texto principal.
- Sidebar recolhida mostra apenas ícones com tooltip e foco acessível.

### 7.2 Top bar

- Altura aproximada: 68–76 px.
- Fundo igual ao `colorBackground` ou `colorSurface`, com divisor inferior sutil.
- Título alinhado à esquerda; controles globais à direita.
- Sino mostra quantidade de alertas quando houver. Popover lista os itens mais severos e leva à tela completa.
- Indicador STOMP usa ponto + rótulo: Conectado, Reconectando ou Offline.
- Menu de usuário mostra username e perfil. Não inventar avatar, nome completo, edição de perfil ou troca de senha, pois a API não oferece esses dados/ações.

### 7.3 Cards

- Fundo `colorSurface`, borda de 1 px `colorBorder`, raio de 10–12 px.
- Sombra mínima; no tema escuro, preferir diferença de superfície à sombra.
- Padding de 18–22 px.
- Evitar cards dentro de cards. Agrupar por título, divisor e espaçamento.
- Card clicável deve ter hover e foco visíveis.

### 7.4 KPI cards

- Rótulo pequeno e muted, valor em destaque, comparação opcional e ícone discreto.
- Variação positiva/negativa deve ser contextualizada: aumento de falhas não pode ser verde.
- Valor nulo ou sem amostra deve aparecer como “—”, nunca como `0%`.
- Não inventar metas ou metas percentuais que não venham da API.

### 7.5 Botões

**Primário**
- Fundo `brandOrange`, texto branco, altura 40–44 px, raio 8 px.
- Usar para ação principal da tela: Criar pedido, Salvar, Aplicar plano.
- Um CTA primário dominante por região.

**Secundário**
- Fundo transparente ou `colorSurfaceMuted`, borda `colorBorder`, texto principal.
- Usar para ações auxiliares e navegação contextual.

**Terciário/Ghost**
- Sem fundo permanente; hover discreto.
- Usar em ações de linha, ícones e comandos menos frequentes.

**Destrutivo**
- Vermelho semântico, nunca laranja.
- Exigir confirmação quando houver exclusão, cancelamento ou operação irreversível.

Botões devem ter estados hover, focus-visible, pressed, disabled e loading.

### 7.6 Inputs e formulários

- Fundo `colorSurfaceMuted`, texto `colorText`, borda `colorBorder`.
- Foco com borda `brandOrange` e halo discreto.
- Label sempre visível; placeholder é exemplo, não substituto de label.
- Erro junto ao campo e resumo no topo quando necessário.
- Campos obrigatórios indicados de forma consistente.
- Ajuda e restrições aparecem abaixo do campo.
- Não limpar os dados preenchidos após erro de API.
- Em formulários longos, separar seções em cards ou blocos com títulos, sem criar um card para cada campo.

### 7.7 Tabelas

- Cabeçalho com fundo `colorSurfaceMuted`, texto muted e peso 600.
- Linhas com altura de 48–56 px; hover discreto.
- Números e datas alinhados de forma consistente.
- Ações agrupadas no final da linha.
- Paginação com total, intervalo atual e seletor 20/50/100 quando suportado.
- Estado vazio deve explicar o que não foi encontrado e oferecer ação pertinente.
- Em telas densas, priorizar legibilidade e não decoração.

### 7.8 Badges e status

Usar badge com texto, ícone opcional e cor semântica suave. A cor deve manter contraste com o texto.

| Contexto | Estado | Tratamento |
|---|---|---|
| Pedido | Criado / Atribuído | neutro |
| Pedido | Despachado / A caminho / Chegou / Em andamento | azul ou laranja suave conforme etapa, sem confundir com CTA |
| Pedido | Concluído | verde |
| Pedido | Cancelado / Falhou | vermelho |
| Motorista | Disponível | verde |
| Motorista | Ocupado | laranja/âmbar |
| Motorista | Offline | cinza |
| Veículo | Disponível | verde |
| Veículo | Em uso | azul/laranja suave |
| Veículo | Manutenção | âmbar/vermelho conforme regra de negócio |
| Alerta | Baixa / Média / Alta | azul/cinza, âmbar, vermelho |

Sempre exibir o rótulo em português. Nunca depender só da cor.

### 7.9 Modais, drawers e confirmações

- Drawer para formulários de cadastro rápidos (motorista, veículo, frota, lugar).
- Modal para decisões pontuais: atribuir, cancelar, registrar POD, confirmar exclusão.
- Confirmação deve explicar o efeito da ação e identificar o registro afetado.
- Ações destrutivas exigem botão explícito e opção de voltar.
- Não usar modal para formulários longos que merecem uma página própria.

### 7.10 Toasts e mensagens

- Sucesso: confirmação curta e específica.
- Erro: mensagem amigável baseada no `ErrorResponse.code`; se não houver mapeamento, usar `message`.
- Erros de validação ficam no campo correspondente.
- Falhas de rede exibem estado persistente com tentar novamente quando fizer sentido.
- Não exibir stack trace, código HTTP cru ou mensagens técnicas para o usuário final.

## 8. Mapas e visualização geográfica

- Tema escuro no mapa, com estradas e rótulos suficientemente contrastantes.
- Biblioteca de mapa/tiles ainda deve ser escolhida; encapsular a implementação para permitir troca.
- Motoristas usam marcador por status; selecionado recebe contorno/realce laranja.
- Retirada, paradas intermediárias e entrega devem ter símbolos diferentes e numeração de sequência.
- Paradas concluídas ficam visualmente atenuadas, mas continuam legíveis.
- Rota atual é linha sólida; trajetos de referência podem usar linha tracejada.
- Com geometria viária (modo `road`), a perna pelas ruas é linha sólida ("Rota pelas ruas"); perna sem caminho ou sem grafo é segmento reto tracejado ("Trecho estimado"). Não simular ruas nem apresentar o tracejado como navegação real.
- Posição nula significa “sem posição”; não inventar coordenadas.
- Modo de escolha de ponto deve deixar claro que o clique no mapa define latitude/longitude, sem geocodificação automática.

## 9. Gráficos e dados analíticos

- Usar gráficos simples, com eixos, legenda e tooltip.
- Laranja destaca a série principal; cores semânticas distinguem sucesso, falha e cancelamento.
- Evitar gráficos 3D, velocímetros decorativos e excesso de donuts.
- Mostrar unidade, período e denominador quando disponível.
- Em gráficos sem dados, apresentar estado vazio informativo em vez de eixos vazios.
- Dados de CUSTOMER devem respeitar o payload reduzido: não renderizar economia, quilômetros ou desempenho de motoristas quando ausentes.

## 10. Estados globais e comportamento

### Carregamento
- Skeleton com dimensões próximas ao conteúdo final.
- Não bloquear a página inteira quando apenas um painel está carregando.
- Botões mostram loading e evitam submissões duplicadas.

### Vazio
- Explicar a ausência de dados.
- Oferecer próxima ação apenas quando o perfil tiver permissão para executá-la.

### Erro
- Preservar filtros e dados de formulário.
- Permitir nova tentativa.
- 401 redireciona para login; 403 mostra página sem permissão; 404 mostra item não encontrado.

### Tempo real
- Indicador de conexão sempre visível no shell autenticado.
- Ao reconectar STOMP, recarregar dados por REST porque não existe replay.
- Eventos devem atualizar somente os componentes afetados ou disparar refetch com debounce.
- Não apresentar a conexão como ativa enquanto estiver reconectando/offline.

### Sessão
- JWT dura 8 horas e não há refresh. Avisar antes da expiração quando possível e encaminhar para login quando expirar.
- Sair limpa token e fecha socket. Não prometer logout remoto ou revogação de token pela API.

## 11. Acessibilidade

- Contraste WCAG AA como objetivo para texto e controles.
- Foco de teclado visível em todos os elementos interativos.
- Ordem de tabulação previsível.
- Labels associados aos campos.
- Ícones decorativos ocultos de leitores de tela; ícones funcionais com nome acessível.
- Status com texto além da cor.
- Respeitar `prefers-reduced-motion`.
- Tabelas devem manter cabeçalhos semânticos e controles com área de interação adequada.

## 12. Movimento

- Transições curtas e funcionais: 140–220 ms.
- Hover e focus sem deslocamentos bruscos.
- Drawer/modal com fade e deslocamento curto.
- Atualização em tempo real pode usar realce temporário de linha, sem piscar repetidamente.
- Sem parallax, animação contínua de fundo, bounce ou efeitos que distraiam da operação.
- Com `prefers-reduced-motion`, remover transições não essenciais.

## 13. Diretrizes por contexto

- **Login e cadastro:** identidade forte, marca em destaque, fotografia logística com tratamento escuro e laranja; formulário limpo.
- **Dashboard:** KPIs no topo, gráficos e filas organizados por prioridade operacional.
- **Despacho:** comparação e ações em primeiro plano; fila e plano precisam ser compreensíveis sem rolagem excessiva.
- **Mapa:** mapa é a área principal; painel lateral organiza motoristas e filtros.
- **Cadastros:** tabelas limpas, formulários em drawer e confirmação de exclusão.
- **Cliente:** linguagem simples, status compreensível e foco no pedido; não expor dados internos de operação.
- **Rastreio público:** página leve, sem sidebar, com código, status, ETA disponível e linha do tempo.

## 14. Restrições funcionais que afetam o design

O design deve respeitar o inventário de telas e os contratos atuais da API. Não desenhar como se já existissem:
- custos, faturamento, consumo, CO₂, odômetro ou relatórios exportáveis;
- agenda de manutenção ou documentos de veículos;
- login Google, recuperação de senha ou edição de perfil;
- geocodificação, busca global de pedidos ou histórico de posições;
- rastreamento público em mapa ou posição do motorista visível ao cliente;
- edição/desativação de usuários;
- ruas reais fora do modo `road` ou sem o grafo carregado (nesse caso, mostrar o trecho como estimado, tracejado).

## 15. Checklist de consistência visual

- [ ] Laranja `#FF6A00` usado como destaque, não como fundo dominante.
- [ ] Grafite `#0F1115` como base do tema escuro.
- [ ] Tipografia, ícones, raios e espaçamentos consistentes.
- [ ] Sidebar e top bar respeitam o perfil autenticado.
- [ ] Status sempre acompanhado de texto.
- [ ] Loading, vazio, erro e sem conexão projetados.
- [ ] Mapas não sugerem precisão que a API não fornece.
- [ ] Nenhuma informação ou ação fictícia foi adicionada.
- [ ] Tema claro mantém a mesma hierarquia e semântica do tema escuro.
