# Status das Implementações

## ✅ Refatoração do Pagamento de Faturas [CONCLUÍDO]
- [x] **Nova Rota de API**: Criada em `src/app/api/accounts/pay-invoice/route.ts`.
- [x] **Service**: Método `payInvoice` adicionado ao `financialService.ts`.
- [x] **Componente**: `PayInvoiceModal.tsx` refatorado para usar a API interna.
- [x] **Testes E2E**: Suíte completa em `tests/invoice-payment.test.ts` cobrindo pagamento total, parcial, "já paguei" e erros.
- [x] **Bugs Corrigidos**: 
    - Crash no `AddTransactionModal` por falta de categorias nos mocks.
    - Unmounting prematuro do modal de pagamento no `AccountCard`.
    - Formatação de valores e sequência de estados de loading/sucesso.

---

## 🚀 Próxima Implementação: Gestão Avançada de Fluxos Recorrentes

### Objetivo
Aprimorar a gestão de fluxos recorrentes (assinaturas, contas fixas, salários) permitindo uma visualização mais clara do impacto no orçamento futuro e facilitando a edição em lote.

### Diretrizes Técnicas
- **Interface**: Criar um componente de "Timeline de Recorrência" no Dashboard.
- **Lógica**: Refinar o cálculo do "Teto de Sobrevivência" para considerar a variabilidade de datas de vencimento.
- **Testes**: Implementar testes E2E para a criação e edição de fluxos recorrentes complexos.

### Resultado Esperado
- Visualização gráfica dos próximos compromissos fixos.
- Alerta proativo de quebra de teto baseada em recorrências futuras.

