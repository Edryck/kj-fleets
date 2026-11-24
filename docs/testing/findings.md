# Achados dos testes

Cada linha é um defeito real encontrado por um teste automatizado e corrigido no código.

| ID | Camada | Teste | Entrada | Antes | Depois |
|---|---|---|---|---|---|
| B1 | API (caixa branca) | `HostileInputTest.hugeStringsRejectedOnRegister`, `hugePointNameRejected`, `hugePlateRejected` | Texto com 10.000 caracteres em username, nome, telefone, endereço ou placa | 500 `INTERNAL_ERROR`: `value too long for type character varying(255)` | 400 `VALIDATION_ERROR`, com `@Size` nos DTOs compatível com as colunas |
| B2 | API (caixa branca) | `HostileInputTest.passwordOver72BytesRejectedNot500` | Senha com 20 emojis (80 bytes) no cadastro e na troca de senha | 500: `password cannot be more than 72 bytes` (limite do BCrypt) | Cadastro e troca de senha respondem 400 com mensagem clara; o login responde 401 |
