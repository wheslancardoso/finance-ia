# Próximos Passos - Finance IA

## ✅ Concluído
- [x] **Refatoração do Pagamento de Faturas**: Migração para API interna concluída com sucesso.
- [x] **Testes E2E Robustos**: Suíte Playwright em `tests/invoice-payment.test.ts` validando todos os cenários.
- [x] **Estabilização de UI**: Resolução de erros de "Duplicate Keys" no console e melhoria da robustez de renderização.
- [x] **Correções de UX**: Ajuste fino em modais de pagamento, transações e estados de sincronização.

---

## 🚀 Próxima Implementação: Gestão Avançada de Fluxos Recorrentes

### Objetivo
Aprimorar a gestão de fluxos recorrentes (assinaturas, contas fixas, salários) permitindo uma visualização mais clara do impacto no orçamento futuro e facilitando a edição em lote.

### Diretrizes Técnicas
- **Interface**: Criar um componente de "Timeline de Recorrência" no Dashboard.
- **Lógica**: Refinar o cálculo do "Teto de Sobrevivência" para considerar a variabilidade de datas de vencimento.
- **Testes**: Implementar testes E2E para a criação e edição de fluxos recorrentes complexos.

### Infraestrutura & Dívida Técnica
- [ ] **Next.js Middleware**: Migrar a convenção de arquivo `middleware` para `proxy` conforme aviso de depreciação.
- [ ] **Performance**: Auditoria de renderizações desnecessárias em componentes de alta frequência (gráficos e cards).

---
*Atualizado em: 11 de Maio de 2026*
