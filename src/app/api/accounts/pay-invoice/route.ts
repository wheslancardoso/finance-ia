import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = 'force-dynamic';

/**
 * POST /api/accounts/pay-invoice
 * Realiza o pagamento de uma fatura de cartão de crédito.
 * 
 * Inteligência: Recebe o invoiceId direto do frontend quando disponível.
 * Se não receber, busca a fatura CLOSED mais antiga (pendente de pagamento).
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

    // 2. Determinar qual fatura pagar
    let targetInvoiceId = requestedInvoiceId;
    let targetInvoice: any = null;

    if (targetInvoiceId) {
      // Se o frontend enviou o ID da fatura, usar diretamente
      const { data: inv } = await supabase
        .from('credit_card_invoices')
        .select('*')
        .eq('id', targetInvoiceId)
        .single();
      targetInvoice = inv;
    }

    if (!targetInvoice) {
      // Fallback: buscar a fatura CLOSED mais antiga (pendente de pagamento)
      const { data: closedInvoices } = await supabase
        .from('credit_card_invoices')
        .select('*')
        .eq('account_id', creditCardAccountId)
        .eq('status', 'CLOSED')
        .order('reference_month', { ascending: true })
        .limit(1);
      
      targetInvoice = closedInvoices?.[0];
      targetInvoiceId = targetInvoice?.id;
    }

    // 3. Marcar transações da fatura como pagas
    if (targetInvoiceId) {
      const { error: txUpdateError } = await supabase
        .from("transactions")
        .update({ is_paid: true })
        .eq("invoice_id", targetInvoiceId)
        .eq("is_paid", false);
      
      if (txUpdateError) throw txUpdateError;

      // 4. Marcar a fatura como paga
      const { error: invUpdateError } = await supabase
        .from("credit_card_invoices")
        .update({ 
          status: "PAID", 
          paid_amount_cents: amountCents,
          updated_at: new Date().toISOString() 
        })
        .eq("id", targetInvoiceId);
      
      if (invUpdateError) throw invUpdateError;
    }

    // 5. Se "Pagar Agora" (não é "Já Paguei"), criar transação de débito na conta de pagamento
    if (!alreadyPaid && paymentAccountId) {
      const { data: payAcc, error: payAccErr } = await supabase
        .from("accounts")
        .select("balance_cents")
        .eq("id", paymentAccountId)
        .single();

      if (payAccErr || !payAcc) {
        throw new Error(`Conta de pagamento não encontrada: ${payAccErr?.message || ""}`);
      }

      const currentBalance = payAcc.balance_cents || 0;
      const newBalance = currentBalance - amountCents;

      const { error: updateAccErr } = await supabase
        .from("accounts")
        .update({ balance_cents: newBalance })
        .eq("id", paymentAccountId);

      if (updateAccErr) throw updateAccErr;

      const monthLabel = targetInvoice?.reference_month 
        ? (() => {
            const [y, m] = targetInvoice.reference_month.split('-');
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
      invoiceId: targetInvoiceId,
      referenceMonth: targetInvoice?.reference_month 
    });
  } catch (error: any) {
    console.error("❌ [API] POST /api/accounts/pay-invoice error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
