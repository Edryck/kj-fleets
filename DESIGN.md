# DESIGN.md — Design visual

> **A fazer quando o frontend começar.** O frontend é um projeto separado e ainda não existe; este arquivo guarda só o rascunho do estudo de telas, para não se perder. Nada aqui obriga o front futuro.

## Estudo de telas (rascunho)

Um canvas de exploração foi feito em claro e escuro, com quatro grupos de telas:

| Grupo | Telas |
|---|---|
| Painel do operador | Resumo da operação, pipeline de status, mapa ao vivo, pedidos aguardando despacho, motoristas disponíveis, tabelas de desempenho e economia de rota |
| Despacho e rotas | Plano em lote (Húngaro vs Guloso) e rota otimizada de um pedido |
| App do motorista | Meus pedidos e pedido em andamento (etapas, POD, falha com motivo) |
| Cliente e rastreio | Novo pedido, meus pedidos e rastreio público por código |

Os dados nessas telas são de exemplo e o mapa é um desenho no lugar de um mapa real.

## Marca

Nome: **KJ Fleets**. Slogan: "Soluções em frota e logística". Guia de marca em `Guia de Marca KJ Fleets.png`.

| Cor | Hex | Uso |
|---|---|---|
| Laranja Operacional | `#FF6A00` | Destaque |
| Grafite Confiável | `#0F1115` | Fundo escuro e texto |
| Cinza Técnico | `#6B7280` | Texto secundário e bordas |
| Branco Clareza | `#FFFFFF` | Fundo claro |

O guia não nomeia a fonte: a tipografia continua em "A definir".

## Princípios de partida

- Tela organizada em torno da decisão principal de quem usa (operador: "quem despacho agora?"; motorista: "qual a próxima ação?").
- Poucas cores: neutros, uma cor de destaque e um vermelho só para alerta/erro. Sem gradiente decorativo, sem vidro/glow, sem emoji como ícone.
- Sem métrica inventada. Todo número vem de um endpoint de [ARCHITECTURE.md](ARCHITECTURE.md#dashboard).
- Navegação só com telas que existem. Estados vazios e de erro dizem qual é o próximo passo.
- Claro e escuro desde o início, com contraste legível nos dois.
- App do motorista pensado para mobile, com alvos de toque de pelo menos 44 px.

## A definir

- [ ] Stack do frontend e biblioteca de mapa
- [ ] Tipografia, escala de espaçamento e tons derivados da paleta da marca (tokens)
- [ ] Componentes base (botão, tabela, chip de status, formulário)
- [ ] Mapeamento tela → endpoints
- [ ] Acessibilidade (contraste, foco, leitor de tela) e responsividade
- [ ] Idioma da interface

## Referências

- Regras de UI usadas no estudo: ver [CREDITS.md](CREDITS.md).
