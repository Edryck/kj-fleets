# Identidade dos veículos e modelos 3D: índice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Veículos com marca, modelo, ano, cor, capacidade e hodômetro, renders parecidos com o modelo real pintados na cor do cadastro, e uma figura 3D por papel.

**Architecture:** Colunas opcionais no `Vehicle` (Spring/JPA), catálogo e componente de render no frontend, renders gerados por scripts do Blender versionados em `docs/design/`.

**Tech Stack:** Spring Boot 4 / JPA / Testcontainers, React 18 + TS + Vitest, Blender 5.3 (Cycles, Metal).

**Spec:** `docs/superpowers/specs/2026-11-17-vehicle-identity-3d-design.md`

## Global Constraints

- Sem comentários no código; nomes de variáveis, funções e arquivos em inglês; texto da interface em pt-BR.
- Colunas novas opcionais; nada apagado do banco.
- Sem logotipos de marcas nos renders.
- Commit só no fim do redesign (Fase 10, Task 6), junto com o restante.

## Review Focus

- Veículo antigo sem os campos novos: tudo mostra o tipo e "Não informado", nada quebra.
- Tipo antigo fora da lista: o formulário mantém o valor.
- Marca/modelo digitados com acento ou caixa diferentes ainda acham o render.
- Ano no limite (ano atual + 1) aceito; ano + 2 recusado com 400.
- Máscara de pintura alinhada pixel a pixel com o render nas duas vistas.

## Ordem

1. `plan_phase01_backend.md` — campos no backend
2. `plan_phase02_frontend.md` — catálogo, formulário e exibição
3. `plan_phase03_vehicle_renders.md` — modelos de veículos no Blender
4. `plan_phase04_people.md` — figuras das pessoas
