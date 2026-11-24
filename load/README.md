# Teste de carga (k6)

O k6 roda dentro do Docker (imagem `grafana/k6:2.4.0`), então não precisa instalar nada além do próprio Docker.

1. Suba a API: `docker compose up -d` (por padrão na porta 8081, definida em `API_PORT` no `.env`).
2. Rode `./load/run.sh`. Leva cerca de 6 minutos.
3. Abra `load/results/report-1000.html` no navegador. O `summary-1000.json` traz os números crus.

| Variável | Padrão | Para quê |
|---|---|---|
| `K6_API_URL` | `http://localhost:8081` | onde está a API |
| `K6_PEAK` | `1000` | pico de usuários simultâneos no cenário `browse` |

O script tem três cenários:
- **`browse`:** sobe até `K6_PEAK` usuários em 2 minutos, segura o pico por 3 minutos e desce em 1. Cada usuário chama `/me`, `/orders` e `/track/{código}` e espera de 1 a 3 segundos.
- **`create`:** 50 usuários criando pedidos por 3 minutos.
- **`loginStorm`:** 200 logins ao mesmo tempo.

No `setup()`, o script cadastra 50 clientes novos (`load<run><n>`). Por isso cada execução deixa dados de teste no banco.

Limites para passar: menos de 1% de erros, p95 do `browse` abaixo de 800 ms e mais de 99% dos `checks` passando.
