import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = 'force-dynamic';

/**
 * POST /api/accounts/pay-invoice
 * Realiza o pagamento de uma fatura de cartão de crédito.
 * 
 * Inteligência: Recebe o invoiceId (agora sendo o `referenceMonth` string, ex: "2026-05") direto do frontend quando disponível.
 * Se não receber, busca o mês mais antigo com transações não pagas no cartão.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      creditCardAccountId,
      paymentAccountId,
      amountCents,
      invoiceId: requestedInvoiceId,
      alreadyPaid = false
    } = body;

    if (!creditCardAccountId || !amountCents) {
      return NextResponse.json(
        { error: "creditCardAccountId e amountCents são obrigatórios" },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();

    // 1. Buscar detalhes da conta do cartão
    const { data: creditCardAccount, error: accError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', creditCardAccountId)
      .single();

    if (accError || !creditCardAccount) {
      throw new Error("Conta de cartão não encontrada");
    }

    // 2. Buscar transações não pagas do cartão
    const { data: unpaidTxs, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', creditCardAccountId)
      .eq('is_paid', false);

    if (txError) throw txError;

    // 3. Determinar qual mês pagar (agrupamento dinâmico)
    const closingDay = creditCardAccount.closing_day || 28;
    
    // Mapear transação -> referenceMonth
    const txByMonth = new Map<string, any[]>();
    
    (unpaidTxs || []).forEach(t => {
      const txDate = new Date(t.date);
      let refMonth = new Date(txDate);
      if (txDate.getDate() >= closingDay) {
        refMonth.setMonth(refMonth.getMonth() + 1);
      }
      const refMonthStr = `${refMonth.getFullYear()}-${String(refMonth.getMonth() + 1).padStart(2, '0')}`;
      if (!txByMonth.has(refMonthStr)) txByMonth.set(refMonthStr, []);
      txByMonth.get(refMonthStr)!.push(t);
    });

    let targetMonthStr = requestedInvoiceId; // "2026-05"

    if (!targetMonthStr) {
      // Fallback: buscar a "fatura fechada" mais antiga com base na data de hoje
      const now = new Date();
      let currentRefMonth = new Date(now);
      if (now.getDate() >= closingDay) {
        currentRefMonth.setMonth(currentRefMonth.getMonth() + 1);
      }
      const currentRefMonthStr = `${currentRefMonth.getFullYear()}-${String(currentRefMonth.getMonth() + 1).padStart(2, '0')}`;
      
      const pastMonths = Array.from(txByMonth.keys()).filter(m => m < currentRefMonthStr).sort();
      if (pastMonths.length > 0) {
        targetMonthStr = pastMonths[0]; // mais antiga pendente
      } else if (txByMonth.has(currentRefMonthStr)) {
        targetMonthStr = currentRefMonthStr; // paga a atual se não tiver atrasada
      }
    }

    if (!targetMonthStr || !txByMonth.has(targetMonthStr)) {
      return NextResponse.json({ success: true, message: "Nenhuma transação pendente para faturar." });
    }

    const txIdsToPay = txByMonth.get(targetMonthStr)!.map(t => t.id);

    // 4. Marcar transações selecionadas como pagas
    if (txIdsToPay.length > 0) {
      const { error: txUpdateError } = await supabase
        .from("transactions")
        .update({ is_paid: true })
        .in("id", txIdsToPay);
      
      if (txUpdateError) throw txUpdateError;
    }

    // 5. Marcar a fatura como PAID na tabela credit_card_invoices
    if (targetMonthStr) {
      const { error: invoiceUpdateError } = await supabase
        .from("credit_card_invoices")
        .update({ status: 'PAID' })
        .eq('account_id', creditCardAccountId)
        .eq('reference_month', targetMonthStr);

      if (invoiceUpdateError) {
        console.error("Erro ao atualizar status da fatura para PAID:", invoiceUpdateError.message);
        // Não jogamos erro para não falhar o fluxo inteiro se as transações já foram pagas.
      }
    }

    if (!alreadyPaid && paymentAccountId) {
      const monthLabel = targetMonthStr 
        ? (() => {
            const [y, m] = targetMonthStr.split('-');
            return format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMM/yy", { locale: ptBR });
          })()
        : format(new Date(), "MMM/yy", { locale: ptBR });

      const { error: paymentTxError } = await supabase.from("transactions").insert([{
        user_id: creditCardAccount.user_id,
        account_id: paymentAccountId,
        category_id: null,
        amount_cents: amountCents,
        transaction_type: "EXPENSE",
        date: new Date().toISOString(),
        description: `Pgto Fatura — ${creditCardAccount.name} ${monthLabel}`,
        source: "MANUAL",
        installment_current: 1,
        installment_total: 1,
        is_legacy_debt: false,
        is_paid: true,
      }]);

      if (paymentTxError) throw paymentTxError;
    }

    return NextResponse.json({ 
      success: true, 
      invoiceId: targetMonthStr,
      referenceMonth: targetMonthStr 
    });
  } catch (error: any) {
    console.error("❌ [API] POST /api/accounts/pay-invoice error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
