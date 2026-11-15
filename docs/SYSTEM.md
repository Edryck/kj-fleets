# SYSTEM.md — Regras e padrões de código

Como o código deste projeto é escrito. Vale para quem contribui, humano ou ferramenta. A estrutura do sistema está em [ARCHITECTURE.md](ARCHITECTURE.md) e o que ele faz em [PRODUCT.md](PRODUCT.md).

Regra de ouro: **o código acompanha o padrão da aula** — poucos arquivos, poucas funções, sem sobre-modularizar. Na dúvida, o mais simples que funciona.

## 1. Idioma e nomes

- Identificadores (variáveis, métodos, classes, arquivos, tabelas, colunas, rotas): **inglês**.
- Documentação, mensagens de commit e texto para o usuário: **português (pt-BR)**.
- Códigos de erro de negócio: `UPPER_SNAKE_CASE` em inglês (`ORDER_POD_REQUIRED`). São parte do contrato da API: não renomear sem avisar.
- Classes em `PascalCase`, métodos e campos em `camelCase`, constantes em `UPPER_SNAKE_CASE`, pacotes em minúsculas.
- Tabelas no singular, exceto `orders` e `users` (palavras reservadas do PostgreSQL). Colunas em `snake_case`.

## 2. Estrutura e camadas

- Camadas: `controller` → `service` → `repository`, mais `entity`, `dto`, `routing`, `security` e `config` (ver [ARCHITECTURE.md](ARCHITECTURE.md#estrutura-de-pacotes-proposta)).
- `controller` não tem regra de negócio e não acessa `repository`.
- `service` concentra regra, transação e publicação de eventos.
- O pacote `routing` **não importa nada de Spring nem de JPA**. Entra lista de pontos, sai ordem e custo.
- Sem camada de mapper se der para evitar: conversão entidade → DTO em um método estático do próprio record.
- Não criar interface com uma única implementação, nem classe `Util` genérica.
- Não colocar a mesma regra em dois lugares. A tabela de transições de status existe **uma vez** (enum ou mapa com `canGoTo`).

## 3. Entidades e banco

- Chave primária `UUID` e `publicId` legível (ex.: `order_x7k2m9`). A API só expõe o `publicId`, nunca o UUID.
- Enums com `@Enumerated(EnumType.STRING)`. Datas em `Instant` (UTC).
- Lombok em entidade: `@Getter`, `@Setter`, `@NoArgsConstructor`. Evitar `@Data` e `@EqualsAndHashCode` em entidade com relacionamento (loop e comparação por campo mutável).
- Relacionamentos `LAZY` por padrão. Em listagem, evitar N+1 com `@EntityGraph` ou fetch join.
- Consultas do dashboard agregam no banco (`GROUP BY`, `date_trunc`). Nunca carregar a tabela inteira para somar em Java.
- Em dev, `ddl-auto=update`. Para a entrega, exportar o schema do pgAdmin para `docs/schema.sql`.
- Índices listados em [ARCHITECTURE.md](ARCHITECTURE.md#banco-postgresql): criar com `@Index` na entidade.

## 4. API REST

- Recurso por substantivo no plural; ação que não é CRUD vira `POST /recurso/{id}/acao` (`assign`, `dispatch`, `cancel`).
- `{id}` na rota é sempre o `publicId`.
- Listagens paginadas com `limit` e `offset`. Padrão 20, máximo 100.
- DTOs como `record`. Entrada validada com Bean Validation (`@NotNull`, `@Size`, `@DecimalMin`...). Latitude entre -90 e 90, longitude entre -180 e 180.
- Nunca devolver entidade JPA direto quando ela tiver relacionamento, senha ou UUID.
- Status HTTP:

| Situação | Status |
|---|---|
| Criado | 201 |
| Sucesso | 200 (204 se não há corpo) |
| Campo inválido | 400 |
| Sem credencial ou token inválido | 401 |
| Sem permissão | 403 |
| Inexistente **ou de outra pessoa** | 404 (não vazar que existe) |
| Conflito (`ORDER_ALREADY_TAKEN`, `USERNAME_TAKEN`) | 409 |
| Regra de negócio violada | 422 |

- Resposta de erro sempre no mesmo formato:

```json
{ "status": 422, "code": "ORDER_POD_REQUIRED", "message": "texto legível", "timestamp": "2026-01-01T12:00:00Z" }
```

## 5. Erros

- Regra de negócio violada lança `BusinessException(code, status, message)`. Um único `@RestControllerAdvice` traduz para o formato acima.
- Validação de campos (400) e exceções inesperadas (500) também passam pelo mesmo advice. Erro 500 nunca devolve stack trace.
- Mensagem de erro não revela se um usuário existe (login devolve a mesma resposta para usuário inexistente e senha errada).

## 6. Transações e eventos

- Toda operação que muda estado é um método `@Transactional` de `service`.
- Mudança de status de pedido faz, **na mesma transação**: validar a transição, atualizar o pedido, gravar `TrackingStatus` e atualizar o motorista (`BUSY`/`AVAILABLE`).
- Evento de WebSocket só é publicado **depois do commit** (`TransactionSynchronization` ou `@TransactionalEventListener(AFTER_COMMIT)`). Se a transação der rollback, ninguém recebe evento.
- Operações em lote (`POST /dispatch/plan` com `apply=true`) são tudo-ou-nada: uma transação só, revalidando as regras; se uma falhar, nada é aplicado.
- Concorrência (só no modo ad hoc): `@Version` na entidade ou `UPDATE ... WHERE driver_id IS NULL` conferindo as linhas afetadas.

## 7. Segurança

- Nada de segredo no repositório: tudo por variável de ambiente (lista em [ARCHITECTURE.md](ARCHITECTURE.md#configuração-variáveis-de-ambiente) e `.env.example`).
- Senhas com BCrypt. O hash nunca sai em resposta nem em log.
- Não registrar em log: senha, token, header `Authorization`, `JWT_SECRET`.
- JWT com expiração. O valor fica em uma constante no código.
- O motorista é identificado pelo principal autenticado, nunca por id vindo da URL ou do corpo.
- Autorização por papel em um lugar só (configuração de segurança), e checagem de posse (cliente só vê o próprio pedido, motorista só os dele) no `service`.
- Basic Auth só em `/driver/**`. Fora de desenvolvimento, só atrás de HTTPS.
- `CORS` fechado por padrão; abrir só para a origem do frontend quando ele existir.

## 8. Roteirização

- Algoritmo novo = classe pura + teste JUnit antes de ligar na API.
- Resultado reproduzível: algoritmos aleatórios (`SIMULATED_ANNEALING`) aceitam `seed`.
- Distâncias em **km** e `double`; tempo em minutos inteiros arredondados.
- Testes obrigatórios (ver "Testes").

## 9. Comentários e formatação

- Comentário só quando há um **porquê** que o código não mostra. Curto, em português, tom casual de gente.
- Sem Javadoc, sem banner, sem comentário que repete a linha de baixo, sem `TODO` sem dono.
- Sem código comentado: o Git guarda o histórico.
- Formatação padrão do IntelliJ (4 espaços). Imports sem `*`. O `.editorconfig` do repositório vale.

## 10. Testes

| O que | Como |
|---|---|
| Algoritmos (`routing`) | JUnit puro, sem Spring. Held-Karp = força bruta até 8 paradas; 2-opt nunca pior que vizinho mais próximo; Hungarian nunca pior que guloso. Modo `road` testado com um OSM sintético pequeno |
| Regras do pedido | Teste de `service` com banco de teste. Cada regra de [ARCHITECTURE.md](ARCHITECTURE.md#fluxo-e-regras-do-pedido) tem um caso que falha com o código de erro esperado |
| Segurança | Um teste por papel nas rotas sensíveis (200/403/404) |
| WebSocket | Cliente STOMP inscrito num pedido recebe o evento quando o status muda |
| API | Collection em `docs/kjfleets.postman_collection.json`, mantida junto do código |

- Banco de teste sobe com Testcontainers: um PostgreSQL 17 descartável por execução. Precisa de Docker rodando. Teste nunca aponta para o banco de dev.
- Teste novo para cada bug corrigido.

## 11. Git

- Uma branch por mudança, a partir da `main`. `main` sempre compila e passa nos testes.
- Commits pequenos, em **Conventional Commits** com mensagem em pt-BR: `feat(orders): bloqueia despacho sem veículo`, `fix(routing): ...`, `docs: ...`, `test: ...`, `refactor: ...`, `chore: ...`.
- Não commitar: `target/`, `.idea/`, `.env`, `.claude/`, `CLAUDE.md`, `docs/brainstorming`, `docs/plan` e arquivos de segredo (ver `.gitignore`).
- PR descreve o que mudou, como testar e o que **não** foi validado (modelo em `.github/PULL_REQUEST_TEMPLATE.md`).

## 12. Definição de pronto

Uma mudança está pronta quando:
1. Compila e `mvn test` passa.
2. Regra nova tem teste que falha sem ela.
3. Endpoint novo está na tabela de [ARCHITECTURE.md](ARCHITECTURE.md#api-rest), na matriz de permissões, no [README.md](../README.md) e na collection, com o código de erro quando houver.
4. Fluxo novo ou alterado está em [docs/flows/](flows/backend/flow-index.md); tabela ou coluna nova está em [docs/domain.md](domain.md).
5. Nenhum segredo, senha ou token no diff.
6. Variável de ambiente nova está em `.env.example` e na tabela do README.
