# Relatório de testes: KJ Fleets

Objetivo: mostrar que o sistema aguenta um usuário leigo, um usuário mal-intencionado e muitos usuários ao mesmo tempo, e corrigir o que não aguentava.

## Resumo

| Camada | Ferramenta | Tipo | Casos | Última execução |
|---|---|---|---|---|
| API | JUnit 5 + MockMvc + Testcontainers | caixa branca | 527 (70 novos neste trabalho) | 527 passaram |
| Telas (componentes) | Vitest + Testing Library | caixa branca | 447 | 447 passaram |
| Navegador | Playwright (Chrome desktop e Pixel 7) | caixa preta | 17 execuções (15 cenários) | 17 passaram |
| Carga | k6 2.4.0 | caixa preta | 3 cenários, até 1000 usuários simultâneos | aprovado (0% de erros, p95 de 372 ms, 965 req/s) |

**Defeitos encontrados e corrigidos: 9** (detalhes em [findings.md](findings.md)):

| ID | Gravidade | Defeito |
|---|---|---|
| B6 | crítica | Deadlock no pool de conexões sob carga: a API travava por 30 a 60 s |
| B7 | alta | Falta de índice: a lista de pedidos do cliente ficava mais lenta a cada pedido criado |
| B8 | média | Eventos de tempo real podiam sair fora de ordem, e a fila não tinha limite |
| B9 | média | O limitador de login podia crescer sem teto de memória |
| B2 | alta | Senha com mais de 72 bytes (ex.: 20 emojis) derrubava o cadastro com 500 |
| B3 | alta | Login sem limite de tentativas (força bruta) |
| B1 | média | Texto longo estourava a coluna do banco e virava 500 |
| B4 | média | Sessão expirada voltava ao login sem explicar o motivo |
| B5 | baixa | O erro no formulário não levava o foco ao campo com problema |

A auditoria da interface trouxe mais 7 pontos (F1 a F7, em [frontend-audit.md](frontend-audit.md)): 5 foram corrigidos, 1 foi mantido de propósito e 1 foi verificado sem problema.

## Documentos

- [test-matrix.md](test-matrix.md): todos os casos por categoria, com o resultado.
- [findings.md](findings.md): cada defeito com a entrada que o provocou, o comportamento antes e depois.
- [load.md](load.md): o teste de carga, o diagnóstico do deadlock e os números antes e depois.
- [frontend-audit.md](frontend-audit.md): as inconsistências de navegação e de linguagem.
- [evidence/](evidence/): o relatório HTML do k6 depois da correção, a saída do k6 antes e depois, e capturas de tela das correções.

## Como rodar

```bash
./mvnw test                        # API (precisa do Docker de pé, por causa do Testcontainers)
cd frontend && npm test -- --run   # componentes
docker compose up -d && (cd frontend && npm run dev)   # app rodando, para os dois abaixo
cd frontend && npm run e2e         # navegador (na primeira vez: npx playwright install chromium)
./load/run.sh                      # carga, cerca de 6 minutos; relatório em load/results/
```

## Limitações

- Sem varredura automática de vulnerabilidades (OWASP ZAP). Ficou fora do escopo.
- O k6 roda na mesma máquina que a API, então os números servem para comparar execuções, não como medida de produção.
- Não houve teste de carga no WebSocket.
- O Basic Auth do motorista não tem limite de tentativas.
- O limite de tentativas de login fica em memória e só vale para uma instância da API.
- Os testes de navegador e de carga deixam dados de teste no banco do Docker.
