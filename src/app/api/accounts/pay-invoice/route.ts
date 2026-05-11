import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = 'force-dynamic';

/**
 * POST /api/accounts/pay-invoice
 * Realiza o pagamento de uma fatura de cartão de crédito.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      creditCardAccountId,
      paymentAccountId,
      amountCents,
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

    // 2. Calcular a referência da fatura fechada
    const cDay = creditCardAccount.closing_day || 31;
    const now = new Date();
    const todayDay = now.getDate();

    let closedY = now.getFullYear();
    let closedM = now.getMonth();
    if (todayDay < cDay) {
      closedM--;
      if (closedM < 0) { closedM = 11; closedY--; }
    }
    const closedInvoiceStr = `${closedY}-${String(closedM + 1).padStart(2, '0')}-01`;

    // 3. Buscar transações pendentes do cartão
    const { data: cardTxs, error: txsFetchError } = await supabase
      .from("transactions")
      .select("id, amount_cents, date, is_paid, invoice_id")
      .eq("account_id", creditCardAccountId)
      .eq("is_paid", false);

    if (txsFetchError) throw txsFetchError;

    // 4. Filtrar transações que pertencem ao mês de referência da fatura fechada
    const invoiceTxIds = (cardTxs || [])
      .filter(tx => {
        const txDate = new Date(tx.date);
        let tY = txDate.getUTCFullYear();
        let tM = txDate.getUTCMonth();
        // Lógica simplificada: se a data >= dia de fechamento, pertence ao próximo mês
        if (txDate.getUTCDate() >= cDay) {
          tM++;
          if (tM > 11) { tM = 0; tY++; }
        }
        return `${tY}-${String(tM + 1).padStart(2, '0')}-01` === closedInvoiceStr;
      })
      .map(tx => tx.id);

    // Identificar os IDs das faturas envolvidas
    const invoiceIds = Array.from(new Set((cardTxs || []).filter(tx => invoiceTxIds.includes(tx.id)).map(tx => tx.invoice_id).filter(Boolean)));

    // 5. Executar mutações (preferencialmente em uma transação, mas o Supabase client v2 não suporta transactions nativamente via .rpc() ou similares de forma trivial sem SQL direto, 
    //    então faremos as chamadas sequencialmente. Em um ambiente real, um RPC seria melhor.)
    
    if (invoiceTxIds.length > 0) {
      // Marcar transações como pagas
      const { error: txUpdateError } = await supabase
        .from("transactions")
        .update({ is_paid: true })
        .in("id", invoiceTxIds);
      
      if (txUpdateError) throw txUpdateError;

      // Marcar faturas como pagas
      if (invoiceIds.length > 0) {
        const { error: invUpdateError } = await supabase
          .from("credit_card_invoices")
          .update({ status: "PAID", updated_at: new Date().toISOString() })
          .in("id", invoiceIds);
        if (invUpdateError) throw invUpdateError;
      } else {
        const { error: invUpdateError } = await supabase
          .from("credit_card_invoices")
          .update({ status: "PAID", updated_at: new Date().toISOString() })
          .eq("account_id", creditCardAccountId)
          .eq("reference_month", closedInvoiceStr.substring(0, 7));
        if (invUpdateError) throw invUpdateError;
      }
    }

    // 6. Se não for "Já Paguei", criar transação de débito
    if (!alreadyPaid && paymentAccountId) {
      const monthLabel = format(new Date(closedY, closedM, 1), "MMM/yy", { locale: ptBR });
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
        is_paid: true, // No backend, marcamos como pago se é "Pagar Agora"
      }]);

      if (paymentTxError) throw paymentTxError;
    }

    return NextResponse.json({ success: true, closedInvoiceStr });
  } catch (error: any) {
    console.error("❌ [API] POST /api/accounts/pay-invoice error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
