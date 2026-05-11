# Próximos Passos - Finance IA

## ✅ Concluído
- [x] **Refatoração do Pagamento de Faturas**: Migração para API interna concluída com sucesso.
- [x] **Testes E2E Robustos**: Suíte Playwright em `tests/invoice-payment.test.ts` validando todos os cenários.
- [x] **Estabilização de UI**: Resolução de erros de "Duplicate Keys" no console e melhoria da robustez de renderização.
- [x] **Correções de UX**: Ajuste fino em modais de pagamento, transações e estados de sincronização.

---

- [x] **Gestão de Fluxos Recorrentes**: Implementação de CRUD completo e estabilização de testes E2E.
- [x] **Infraestrutura de Testes**: Padronização de `data-testid` em componentes base como `GlassCard` e `ConfirmModal`.

---

## 🚀 Próxima Implementação: Inteligência de Dashboard & Projeções

### Objetivo
Validar a precisão matemática e visual das projeções de longo prazo e a resposta do Dashboard a mudanças de cenário.

### Diretrizes Técnicas
- **Interface**: Refinar os gráficos do Survival HUD para exibir "Burn Rate" mensal.
- **Lógica**: Implementar simulações de "E se?" (ex: "E se eu cancelar a Netflix?") com feedback imediato no HUD.
- **Testes**: Criar `tests/dashboard-projections.test.ts` para validar o impacto de novas transações nas métricas de saúde financeira.

### Infraestrutura & Dívida Técnica
- [ ] **Next.js Middleware**: Migrar a convenção de arquivo `middleware` para `proxy` conforme aviso de depreciação.
- [ ] **Performance**: Auditoria de renderizações desnecessárias em componentes de alta frequência (gráficos e cards).

---
*Atualizado em: 11 de Maio de 2026*
