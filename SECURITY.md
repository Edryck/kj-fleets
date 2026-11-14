# Política de Segurança

## Versões com suporte

O projeto está em desenvolvimento. Só a branch `main` recebe correções.

## Como reportar uma vulnerabilidade

**Não abra issue pública.** Use o relato privado do GitHub: aba **Security** do repositório → **Report a vulnerability**. (Se a opção não aparecer, abra uma issue pedindo só um contato privado, sem descrever a falha.)

Inclua, se puder:
- o que é a falha e onde está (rota, classe, arquivo);
- passos para reproduzir;
- o impacto que você imagina.

Responderemos assim que possível, sem prazo garantido por ser um projeto acadêmico. Pedimos que a falha não seja divulgada antes de existir uma correção.

## O que interessa

Exemplos: contornar a autenticação, um perfil acessando dado de outro (cliente vendo pedido alheio, motorista vendo pedido que não é dele), vazamento de dados pessoais ou coordenadas no rastreio público, injeção, segredo exposto no repositório.

## O que não é falha

- Falta de HTTPS em ambiente de desenvolvimento local.
- Credenciais de exemplo no `.env.example`.
- Ataques que exigem acesso físico ao servidor.

## Cuidados já previstos

Senhas com BCrypt, segredos só por variável de ambiente, Basic Auth restrito a `/driver/**` (use HTTPS fora de desenvolvimento) e recurso de outra pessoa respondendo `404`. Detalhes em [SYSTEM.md](docs/SYSTEM.md#7-segurança).
