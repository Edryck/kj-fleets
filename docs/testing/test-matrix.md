# Matriz de casos de teste

Resultado da última execução (2026-11-24). Caixa branca = o teste conhece o código e roda dentro da aplicação (JUnit + MockMvc + PostgreSQL real via Testcontainers). Caixa preta = o teste só vê o que o usuário vê: o navegador ou a API HTTP de fora.

## Usabilidade e à prova de erro (caixa preta, Playwright: `frontend/e2e/fool-proof.spec.ts`)

| ID | Caso | Resultado | Achado |
|---|---|---|---|
| U1 | Duplo clique em "Criar pedido" cria um pedido só | passou | — |
| U2 | Formulário enviado vazio: mensagem em pt-BR, foco no primeiro campo com erro, nenhum 500 | passou depois da correção | B5 |
| U3 | Cadastro enviado vazio mostra os avisos | passou | — |
| U4 | Colar 6.000 caracteres com emoji: o formulário barra ou a API recusa, sem tela branca | passou | — |
| U5 | Recarregar e voltar no meio do formulário não quebra a tela | passou | — |
| U6 | Sessão inválida no meio do uso: volta ao login com o aviso "Sua sessão expirou" | passou depois da correção | B4 |
| U7 | 5 senhas erradas mostram "inválidos"; a 6ª tentativa, mesmo correta, mostra "Muitas tentativas" | passou | B3 |
| U8 | Login e navegação só pelo teclado, com foco visível | passou | — |
| U9 | Nenhum código cru (`CREATED`, `IN_USE`...) em pedidos, motoristas, veículos, dashboard e despacho | passou | F7 |
| U10 | Cancelar pedido pede confirmação | passou | — |
| U11 | Sem rolagem lateral no celular (Pixel 7): dashboard, pedidos, novo pedido e conta | passou | — |

## Fluxos principais (caixa preta, Playwright: `frontend/e2e/happy-path.spec.ts`)

| ID | Caso | Resultado |
|---|---|---|
| H1 | Cliente cria pedido (desktop e Pixel 7) | passou |
| H2 | Despachante cria pedido e atribui motorista | passou |
| H3 | Gestor de frota abre o dashboard sem erro | passou |
| H4 | Admin cria usuário despachante | passou |

## Entradas hostis (caixa branca, JUnit: `HostileInputTest`, 40 execuções)

| ID | Caso | Resultado | Achado |
|---|---|---|---|
| E1 | Senha com emoji e acento: cadastro e login funcionam | passou | — |
| E2 | Senha com mais de 72 bytes: cadastro e troca respondem 400, login responde 401, nunca 500 | passou depois da correção | B2 |
| E3 | Nome com emoji e acento é devolvido igual | passou | — |
| E4 | Username, nome ou senha em branco ou só com espaços: 400 | passou | — |
| E5 | 10.000 caracteres em username, nome, senha, e-mail ou telefone: 400 | passou depois da correção | B1 |
| E6 | 10.000 caracteres em observação, nome de ponto, endereço ou placa: 400, sem pedido salvo | passou depois da correção | B1 |
| E7 | Corpo de 1 MB: 400 | passou | — |
| E8 | JSON quebrado, vazio, `[]`, `null` ou com tipo errado: 400 | passou | — |
| E9 | SQL e `<script>` nas observações: salvos e devolvidos como texto puro | passou | — |
| E10 | Latitude 91, longitude -181, `NaN` ou `Infinity` no pedido e na posição do motorista: 400 | passou | — |
| E11 | Capacidade, volume ou hodômetro negativos ou zero, ano 0 ou 3000: 400 | passou | — |
| E12 | 51 paradas (o limite é 50): 400 | passou | — |
| E13 | Id inexistente de cliente, pedido ou motorista: 4xx, nunca 500 | passou | — |

## Segurança (caixa branca, JUnit: `SecurityAttackTest` com 19 execuções e `LoginRateLimiterTest` com 5)

| ID | Caso | Resultado | Achado |
|---|---|---|---|
| S1 | JWT com assinatura adulterada: 401 | passou | — |
| S2 | JWT com o conteúdo trocado para ADMIN: 401 | passou | — |
| S3 | JWT `alg: none`: 401 | passou | — |
| S4 | JWT assinado com outro segredo: 401 | passou | — |
| S5 | JWT vencido: 401 | passou | — |
| S6 | Cabeçalho `Authorization` malformado ou de outro esquema: 401 | passou | — |
| S7 | CUSTOMER, FLEET_MANAGER ou DISPATCHER criando ou listando usuários: 403 | passou | — |
| S8 | Cliente lendo o pedido de outro cliente: 403/404 (IDOR) | passou | — |
| S9 | A lista de pedidos do cliente não traz pedidos de outros | passou | — |
| S10 | Cliente lendo ou alterando o endereço de outro: 403/404 | passou | — |
| S11 | Motorista vendo pedido que não é dele; motorista no login JWT | passou | — |
| S12 | Basic Auth do motorista com senha de 120 bytes: 401, não 500 | passou | — |
| S13 | Cliente em rotas de motorista ou da equipe: 401/403 | passou | — |
| S14 | Respostas de erro sem stack, nome de classe ou SQL | passou | — |
| S15 | Senha ou hash nunca aparecem em `/auth/register`, `/me` e `/users` | passou | — |
| S16 | Token de usuário desativado para de valer na hora | passou | — |
| S17 | Força bruta: o 6º login errado responde 429; outro usuário do mesmo IP continua entrando | passou depois da correção | B3 |
| S18 | Limitador: limite, reset após sucesso, fim da janela, chaves independentes, limpeza da memória | passou | — |

## Carga (caixa preta, k6: `load/kjfleets.js`) e concorrência (caixa branca: `ConnectionPoolDeadlockTest`)

| ID | Caso | Resultado | Achado |
|---|---|---|---|
| C1 | 1000 usuários navegando, 50 criando pedidos e 200 logins simultâneos: menos de 1% de erros, p95 abaixo de 800 ms | passou depois da correção (0% de erros, p95 de 439 ms, 939 req/s) | B6 |
| C2 | Pool de 2 conexões com 16 criações de pedido simultâneas: todas respondem 201 | passou depois da correção | B6 |

## Consistência da interface (auditoria + vitest)

As decisões F1 a F7 estão em `frontend-audit.md`. Os testes ficam em `frontend/src/auth/guards.test.tsx`, `frontend/src/components/algorithmForm.test.tsx` e `frontend/src/pages/planComparison.test.ts`.
