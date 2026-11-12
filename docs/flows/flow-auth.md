# Fluxos — Autenticação

Cadastro e login. A conexão WebSocket está nos fluxos 22 a 24, em [flow-websocket.md](flow-websocket.md). Índice em [flow-index.md](flow-index.md).

## 7. Cadastro e login

```mermaid
sequenceDiagram
    actor U as Usuário
    participant A as AuthController
    participant DB as PostgreSQL
    U->>A: POST /auth/register (username, senha, dados do cliente)
    alt username já existe
        A-->>U: 409 USERNAME_TAKEN
    else ok
        A->>DB: INSERT users (CUSTOMER) + customer
        A-->>U: 201
    end

    U->>A: POST /auth/login (username, senha)
    A->>DB: busca usuário e confere BCrypt
    alt credenciais inválidas, usuário inativo ou role DRIVER
        A-->>U: 401 (mesma resposta para os três casos)
    else ok
        A-->>U: 200 com JWT e role
    end

```
