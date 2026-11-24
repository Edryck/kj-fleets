# Fluxos — Autenticação

Cadastro, login, perfil e administração de usuários. A conexão WebSocket está nos fluxos 22 a 24, em [flow-websocket.md](flow-websocket.md). Índice em [flow-index.md](flow-index.md).

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
    alt muitos erros do mesmo IP para esse username na janela
        A-->>U: 429 TOO_MANY_ATTEMPTS
    else dentro do limite
        A->>DB: busca usuário e confere BCrypt
        alt credenciais inválidas, usuário inativo ou role DRIVER
            A->>A: conta um erro para IP + username
            A-->>U: 401 (mesma resposta para os três casos)
        else ok
            A->>A: zera o contador
            A-->>U: 200 com JWT e role
        end
    end

```

## 25. Perfil e troca de senha

```mermaid
sequenceDiagram
    actor U as Usuário logado (JWT)
    participant A as AuthController
    participant DB as PostgreSQL

    U->>A: GET /me
    A->>DB: busca usuário pelo username do token
    alt role CUSTOMER
        A->>DB: busca o cliente ligado ao usuário
    end
    A-->>U: 200 com publicId, username, role (name, email e phone só para cliente)

    U->>A: PUT /me/password (currentPassword, newPassword)
    alt senha atual incorreta
        A-->>U: 400 VALIDATION_ERROR
    else ok
        A->>DB: UPDATE users (hash BCrypt da nova senha)
        A-->>U: 204
    end
```

Tokens já emitidos continuam válidos até expirar. A troca não revoga nada.

## 26. Usuários da equipe (ADMIN)

```mermaid
sequenceDiagram
    actor A as ADMIN ativo (JWT)
    participant C as AuthController
    participant S as AuthService
    participant DB as PostgreSQL

    A->>C: PUT /users/{id}, POST /users/{id}/deactivate ou POST /users/{id}/reactivate
    C->>S: operação com o username de quem chama
    S->>DB: trava os ADMINs ativos (ordem por id)
    alt quem chama não é mais ADMIN ativo
        S-->>A: 403 FORBIDDEN
    else usuário não existe
        S-->>A: 404 NOT_FOUND
    else alvo é CUSTOMER ou DRIVER
        S-->>A: 400 VALIDATION_ERROR
    else novo papel é CUSTOMER ou DRIVER
        S-->>A: 400 VALIDATION_ERROR
    else ADMIN tenta rebaixar ou desativar a si mesmo
        S-->>A: 409 RESOURCE_IN_USE
    else ok
        S->>DB: UPDATE users (role ou active)
        S-->>A: 200 com o usuário (PUT) ou 204 (deactivate e reactivate)
    end
```

Desativar ou trocar o papel vale na próxima requisição, porque o filtro JWT relê o usuário do banco a cada chamada: usuário desativado recebe 401 (não é autenticado) e rebaixado recebe 403 pela regra de papel. Reativar é idempotente: usuário já ativo responde 204 sem mudar nada.
