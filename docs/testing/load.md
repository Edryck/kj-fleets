# Teste de carga

Ferramenta: k6 2.4.0 em Docker (`load/kjfleets.js`, `load/run.sh`). Os cenários estão descritos em `load/README.md`.

Máquina: notebook com 8 núcleos (AMD Ryzen 5 3500U with Radeon Vega Mobile Gfx) e 17 GB de RAM. A API (`ROUTING_MODE=road`, `-Xmx3g`) e o PostgreSQL 17 rodam no Docker, e o k6 roda na mesma máquina. Os números servem para comparar uma execução com outra; não são uma medida de produção.

## Resultado

| Execução | Pico de usuários | Requisições | Taxa | Erros | Mediana | p95 (browse) | Máximo | Limites |
|---|---|---|---|---|---|---|---|---|
| 1ª (antes da correção) | 1000 | 105.488 | 283/s | 0,88% (929) | 3,9 ms | **29,4 s** | 60 s | reprovado |
| 1ª com 300 usuários (diagnóstico) | 300 | ~32.000 | — | 2,21% | 3,9 ms | 27,3 s | 60 s | reprovado |
| 2ª (depois da correção) | 1000 | 350.198 | 939/s | **0%** | 47 ms | **439 ms** | 4,0 s | aprovado |

Na 2ª execução, os 350.098 checks passaram, incluindo todas as criações de pedido e os 200 logins simultâneos. No pico, a API usou cerca de 500% de CPU e o banco cerca de 180%.

## O que a 1ª execução mostrou

A mediana baixa (4 ms), junto com um p95 de 29 s e a CPU quase ociosa, indicava requisições paradas e não um servidor lento. Os logs mostravam `HikariPool-1 - Connection is not available, request timed out after 30000ms (total=10, active=10, idle=0, waiting=199)`. No banco, porém, as 10 conexões estavam `idle`.

Um thread dump (`kill -3`) feito durante a carga apontou para `RealtimePublisher.onOrderTracked`. Esse listener `@TransactionalEventListener(AFTER_COMMIT)` com `REQUIRES_NEW` roda na mesma thread da requisição, num momento em que a conexão da transação original ainda não foi devolvida, e pede uma segunda conexão. Com 10 pedidos sendo criados ao mesmo tempo, as 10 conexões ficavam esperando umas pelas outras até o timeout de 30 s. Enquanto isso, todo o resto da API (`/me`, `/orders`, `/track`) ficava na fila.

Correção: os dois listeners com `REQUIRES_NEW` passaram a ser `@Async` (`@EnableAsync` na aplicação). O `ConnectionPoolDeadlockTest` reproduz o problema com um pool de 2 conexões e 16 criações simultâneas: falhava antes da correção e passa depois. Achado B6 em `findings.md`.

Efeito colateral aceito: os eventos de WebSocket desses dois listeners saem numa thread separada, logo depois do commit. A ordem entre eventos de pedidos diferentes pode variar, mas o front sempre relê o estado atual.

## Limitações

- O k6 e a API dividem a mesma máquina, então o próprio gerador de carga consome CPU que a API poderia usar.
- Há uma instância só da API e o limite de login fica em memória; não foi testado nada com várias instâncias.
- Não foi testada carga no WebSocket (STOMP), só no REST.
