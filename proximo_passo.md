# Próxima Implementação: Refatoração do Pagamento de Faturas

## Objetivo
Refatorar a lógica do componente `PayInvoiceModal.tsx` para que ele não chame o Supabase diretamente do lado do cliente (via `@supabase/supabase-js`), mas sim utilize um endpoint interno da API (`POST /api/accounts/pay-invoice`), unificando a arquitetura e aumentando a segurança.

## Diretrizes Técnicas
- **Nova Rota de API**: Criar `src/app/api/accounts/pay-invoice/route.ts` que receberá o ID da conta, valor pago e realizará as mutações necessárias no banco (atualização de status da fatura para PAID, adição de transação compensatória na conta de origem, etc).
- **Componente**: Atualizar `src/components/PayInvoiceModal.tsx` para chamar a nova rota via `fetch` em vez de construir e disparar queries diretas.
- **Service**: Adicionar o método `payInvoice` no `financialService.ts` para encapsular a chamada `fetch`.

## Contexto Atual
Atualmente, o modal de pagamento de fatura instancia o cliente do Supabase e realiza múltiplas operações (inserção de transação, atualização de fatura) diretamente do frontend. Isso foge do padrão estabelecido no restante da aplicação, onde o frontend se comunica com `src/app/api/...`.

## Resultado Esperado
- Remoção da dependência direta de RPCs e inserts do Supabase dentro do `PayInvoiceModal.tsx`.
- Lógica de negócio transferida para o backend (API Route).
- Teste E2E recém-criado de contas continuará passando, pois ele já mocka a interação em nível de tela, e se necessário adaptaremos o mock para cobrir a nova rota caso ela seja chamada fora do estado principal.
