# Como contribuir

Obrigado por querer ajudar! Este é um projeto acadêmico em desenvolvimento, então o ritmo de resposta pode variar. Toda contribuição segue o [Código de Conduta](CODE_OF_CONDUCT.md).

## Antes de começar

1. Leia o [PRODUCT.md](PRODUCT.md) (o que entra e o que está **fora** do escopo) e o [ARCHITECTURE.md](ARCHITECTURE.md).
2. Para mudança grande ou que mexa no escopo, **abra uma issue antes** e espere uma resposta. Isso evita trabalho jogado fora.
3. Para bug pequeno ou erro de texto, pode mandar o PR direto.

## Ambiente

JDK 21, Docker (os testes sobem um PostgreSQL com Testcontainers) e PostgreSQL para rodar a aplicação. Passo a passo no [README.md](README.md#como-rodar). Os testes não usam o banco de desenvolvimento.

## Fluxo

1. Faça um fork e crie uma branch a partir da `main` (ex.: `feat/dispatch-batch`, `fix/pod-validation`).
2. Siga as regras do [SYSTEM.md](SYSTEM.md): nomes em inglês, poucos arquivos, comentário só com porquê.
3. Escreva ou ajuste os testes. Rode `./mvnw test` (com o Docker de pé).
4. Atualize a documentação afetada (README, ARCHITECTURE, `docs/flows.md`, `.env.example`).
5. Commits em Conventional Commits, mensagem em pt-BR: `feat(orders): bloqueia despacho sem veículo`.
6. Abra o PR usando o modelo do repositório, descrevendo o que mudou, como testar e o que não foi validado.

## O que costuma ser recusado

- Itens fora do escopo (multi-tenant, bibliotecas prontas de roteirização, upload de arquivo etc.).
- Código copiado do Fleetbase ou de outro projeto sem compatibilidade de licença. Este projeto é MIT e o Fleetbase é AGPL-3.0: **não traga código dele**.
- Segredos, senhas ou tokens no diff.
- PR enorme que mistura várias mudanças.

## Dúvidas

Abra uma issue com a pergunta. Vulnerabilidades **não** vão em issue: use o [SECURITY.md](SECURITY.md).
