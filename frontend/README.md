# KJ Fleets — Frontend

SPA em React + TypeScript (Vite) que consome a API do backend. O visual segue o `DESIGN.md` da raiz do projeto.

## Pré-requisitos

- Node 20 (ou superior compatível com o Vite 6)
- API rodando em `http://localhost:8080` (na raiz: `mvn spring-boot:run`, com as variáveis de ambiente da API)

## Como rodar

```bash
cd frontend
npm install
cp .env.example .env   # opcional: vazio já funciona em dev
npm run dev
```

Em dev, o Vite encaminha as chamadas da API (`/auth`, `/orders`, `/ws`, …) para `localhost:8080`. Rotas do próprio app (ex.: `/orders/12`) continuam sendo servidas pelo SPA.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `VITE_API_URL` | Base da API. Vazio = mesma origem (proxy do Vite em dev) |
| `VITE_WS_URL` | URL do WebSocket STOMP. Vazio = derivada de `/ws` na origem atual |

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de produção em `dist/` |
| `npm run preview` | Serve o build gerado |
| `npm run lint` | ESLint + Prettier (check) |
| `npm run format` | Prettier em modo escrita |
| `npm run test` | Vitest (use `npm run test -- --run` para uma execução única) |

## Temas

Tema escuro é o padrão. A escolha fica salva em `localStorage` (`kjfleets.theme`). Cores são sempre variáveis CSS definidas em `src/styles/tokens.css`.
