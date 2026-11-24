# Teste de carga

Ferramenta: k6 2.4.0 em Docker (`load/kjfleets.js`, `load/run.sh`). Os cenários estão descritos em `load/README.md`.

Máquina: notebook com 8 núcleos (AMD Ryzen 5 3500U with Radeon Vega Mobile Gfx) e 17 GB de RAM. A API (`ROUTING_MODE=road`, `-Xmx3g`) e o PostgreSQL 17 rodam no Docker, e o k6 roda na mesma máquina. Os números servem para comparar uma execução com outra; não são uma medida de produção.

## Resultado

| Execução | Pico de usuários | Requisições | Taxa | Erros | Mediana | p95 (browse) | Máximo | Limites |
|---|---|---|---|---|---|---|---|---|
| 1ª (antes da correção) | 1000 | 105.488 | 283/s | 0,88% (929) | 3,9 ms | **29,4 s** | 60 s | reprovado |
| 1ª com 300 usuários (diagnóstico) | 300 | ~32.000 | — | 2,21% | 3,9 ms | 27,3 s | 60 s | reprovado |
| 2ª (depois da correção do deadlock) | 1000 | 350.198 | 939/s | **0%** | 47 ms | **439 ms** | 4,0 s | aprovado |
| 3ª e 4ª (após a revisão, tabela com ~23 mil pedidos) | 1000 | ~250.000 | ~670/s | 0% | ~320 ms | 1,15 a 1,43 s | 5,1 s | reprovado |
| A/B: 3ª com o executor antigo | 1000 | 242.004 | 649/s | 0% | — | 1,29 s | — | reprovado |
| 5ª (com o índice `customer_id, created_at`) | 1000 | 359.881 | 965/s | **0%** | 37 ms | **372 ms** | 4,0 s | aprovado |

Na 2ª execução, os 350.098 checks passaram, incluindo todas as criações de pedido e os 200 logins simultâneos. No pico, a API usou cerca de 500% de CPU e o banco cerca de 180%.

## O que a 1ª execução mostrou

A mediana baixa (4 ms), junto com um p95 de 29 s e a CPU quase ociosa, indicava requisições paradas e não um servidor lento. Os logs mostravam `HikariPool-1 - Connection is not available, request timed out after 30000ms (total=10, active=10, idle=0, waiting=199)`. No banco, porém, as 10 conexões estavam `idle`.

Um thread dump (`kill -3`) feito durante a carga apontou para `RealtimePublisher.onOrderTracked`. Esse listener `@TransactionalEventListener(AFTER_COMMIT)` com `REQUIRES_NEW` roda na mesma thread da requisição, num momento em que a conexão da transação original ainda não foi devolvida, e pede uma segunda conexão. Com 10 pedidos sendo criados ao mesmo tempo, as 10 conexões ficavam esperando umas pelas outras até o timeout de 30 s. Enquanto isso, todo o resto da API (`/me`, `/orders`, `/track`) ficava na fila.

Correção: os dois listeners com `REQUIRES_NEW` passaram a ser `@Async` (`@EnableAsync` na aplicação). O `ConnectionPoolDeadlockTest` reproduz o problema com um pool de 2 conexões e 16 criações simultâneas: falhava antes da correção e passa depois. Achado B6 em `findings.md`.

Efeito colateral aceito: os eventos de WebSocket desses dois listeners saem numa thread separada, logo depois do commit. A ordem entre eventos de pedidos diferentes pode variar, mas o front sempre relê o estado atual.

## O que a revisão final e as execuções seguintes mostraram

A revisão do código apontou dois riscos no `@Async` com o executor padrão (8 threads, fila sem limite). Primeiro, dois eventos do mesmo pedido ou do mesmo motorista podiam sair invertidos: por exemplo, a posição antiga chegando depois da nova e fazendo o pino do mapa "voltar". Segundo, a fila podia crescer sem limite. Todos os listeners do `RealtimePublisher` passaram a usar o `realtimeExecutor`, que tem uma thread só (os eventos saem na ordem do commit) e uma fila de até 10.000 eventos; quando a fila enche, o evento é descartado com um log. O `RealtimeOrderingTest` cobre isso. Nas execuções seguintes, nenhum evento foi descartado.

As execuções depois dessa mudança pioraram (p95 entre 1,15 e 1,43 s). Um teste A/B com o executor antigo deu o mesmo resultado (1,29 s), o que descartou a mudança como causa. O motivo real: cada execução do k6 cria cerca de 9 mil pedidos, e a tabela `orders` não tinha índice em `customer_id`. A listagem de pedidos de um cliente fazia `Seq Scan` com contagem, e o custo crescia a cada pedido criado (cerca de 13 ms por chamada com 23 mil linhas). O índice `(customer_id, created_at)` resolveu: na 5ª execução, com os mesmos 23 mil pedidos, o p95 ficou em 372 ms. O `OrderIndexTest` garante o índice. Achado B7 em `findings.md`.

## Limitações

- O k6 e a API dividem a mesma máquina, então o próprio gerador de carga consome CPU que a API poderia usar.
- Há uma instância só da API e o limite de login fica em memória; não foi testado nada com várias instâncias.
- Não foi testada carga no WebSocket (STOMP), só no REST.
