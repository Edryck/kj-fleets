# Auditoria de consistência do frontend

Data: 2026-11-23. Método: leitura de `frontend/src/routes.ts` (fonte do menu) e das telas de cada perfil. A verificação no navegador fica para a fase do Playwright.

| ID | Onde | Perfis | Problema | Correção proposta | Severidade | Decisão |
|---|---|---|---|---|---|---|
| F1 | Menu "Novo pedido" (`routes.ts`) | ADMIN, DISPATCHER, CUSTOMER | Duplica o botão "Novo pedido" que já está no título de Pedidos | Tirar o item do menu (a rota `/orders/new` continua) | média | aprovado, corrigido |
| F2 | Menu "Mapa viário" no grupo Administração | ADMIN, DISPATCHER, FLEET_MANAGER | O grupo Administração mistura uma tela de todos os perfis com "Usuários" (só ADMIN). DISPATCHER vê o grupo só com esse item, e o nome é técnico | Mover para o grupo Análise | baixa | aprovado, corrigido |
| F3 | Abas do Dashboard "Despacho"/"Frota" × menu "Despacho" | ADMIN | Mesmo nome para coisas diferentes: a aba mostra métricas e o menu leva à operação | Renomear as abas para "Métricas de despacho" e "Métricas de frota" | média | aprovado, corrigido |
| F4 | "Economia de rotas" e "Simulador de rota" | ADMIN, DISPATCHER | Duas entradas para o mesmo assunto (roteirização), com nomes que não dizem a diferença | Manter as duas e renomear para "Rotas: economia" e "Rotas: simulador" | baixa | aprovado, corrigido |
| F5 | Jargão de algoritmo na interface (`Dispatch.tsx` "Húngaro/Guloso", `Routing.tsx` "2-opt", "Held-Karp", `RouteLab.tsx`) | ADMIN, DISPATCHER | Um usuário leigo não entende esses termos | Mostrar um rótulo leigo ("Melhor combinação", "Mais rápido") com o nome técnico em texto menor ou dica | média | aprovado, corrigido |
| F6 | Menu "Alertas" × sino de alertas | STAFF | Não é duplicação: o sino é um atalho que já leva para `/alerts` | Manter, nenhuma ação | — | aprovado, sem mudança |
| F7 | Status em inglês (`ARRIVED`, `IN_USE`...) | todos | Vale conferir se algum código cru aparece na tela sem tradução | Checar no Playwright (Task 7) e traduzir o que aparecer cru | média | aprovado, fica para a Task 7 |

Aprovado pelo Edryck em 2026-11-24. F3 também valeu para as abas duplicadas em `pages/dashboardParts.tsx`. F5 vale para o despacho, o simulador e o relatório de economia, e os rótulos agora vêm de uma fonte só (`components/AlgorithmFields.tsx`).
