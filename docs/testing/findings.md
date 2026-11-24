# Achados dos testes

Cada linha é um defeito real encontrado por um teste automatizado e corrigido no código.

| ID | Camada | Teste | Entrada | Antes | Depois |
|---|---|---|---|---|---|
| B1 | API (caixa branca) | `HostileInputTest.hugeStringsRejectedOnRegister`, `hugePointNameRejected`, `hugePlateRejected` | Texto com 10.000 caracteres em username, nome, telefone, endereço ou placa | 500 `INTERNAL_ERROR`: `value too long for type character varying(255)` | 400 `VALIDATION_ERROR`, com `@Size` nos DTOs compatível com as colunas |
| B2 | API (caixa branca) | `HostileInputTest.passwordOver72BytesRejectedNot500` | Senha com 20 emojis (80 bytes) no cadastro e na troca de senha | 500: `password cannot be more than 72 bytes` (limite do BCrypt) | Cadastro e troca de senha respondem 400 com mensagem clara; o login responde 401 |
| B3 | API (segurança) | `SecurityAttackTest.bruteForceGets429` | 6 senhas erradas seguidas para a mesma conta | Sem limite: dava para chutar senhas indefinidamente | 429 `TOO_MANY_ATTEMPTS` depois de 5 erros em 5 minutos por IP + username (`LoginRateLimiter`) |
| B4 | Front (caixa preta) | `fool-proof.spec.ts › expiredSessionRedirects` + `forms.test.tsx` | Token inválido ou vencido no meio do uso | O usuário voltava para o login sem nenhuma explicação: o aviso "Sua sessão expirou" era apagado na primeira leitura, e o StrictMode lê duas vezes | O aviso aparece. Ler e limpar o aviso viraram duas funções separadas (`peekExpiredNotice` e `dismissExpiredNotice`) |
| B5 | Front (caixa preta) | `fool-proof.spec.ts › emptyRequiredFieldsShowMessage` | "Criar pedido" com campos vazios | O erro aparecia, mas o foco ficava no botão; quem usa teclado ou leitor de tela não sabia onde estava o problema | O foco vai para o primeiro campo com erro, que também é rolado para o centro da tela |
| B6 | API (carga) | k6 `load/kjfleets.js` + `ConnectionPoolDeadlockTest` | 1000 usuários simultâneos, com pedidos sendo criados | Deadlock no pool de conexões: o listener AFTER_COMMIT pedia uma 2ª conexão enquanto a 1ª ainda estava presa. p95 de 29 s, timeouts de 60 s e 33% das criações de pedido falhando | Listeners com `@Async`. Com 1000 usuários: 0% de erros, p95 de 439 ms e 939 req/s |
