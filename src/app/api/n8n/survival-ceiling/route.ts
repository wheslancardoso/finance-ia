import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // O n8n vai mandar o familyGroupId via query param ou header.
  // Para maior segurança, poderíamos checar um x-api-key, mas assumindo MVP local-first:
  const { searchParams } = new URL(request.url);
  const familyGroupId = searchParams.get("familyGroupId");
  const apiKey = request.headers.get("x-api-key");

  // TODO: Em prod, colocar o x-api-key real no .env
  if (apiKey !== process.env.N8N_API_KEY && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!familyGroupId) {
    return NextResponse.json({ error: "familyGroupId is required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // 1. Buscar as configurações de Renda do Grupo Familiar
    const { data: familyGroup, error: fgError } = await supabase
      .from("family_groups")
      .select("monthly_income_cents, fixed_expenses_cents, accumulated_balance_cents")
      .eq("id", familyGroupId)
      .single();

    if (fgError || !familyGroup) {
      return NextResponse.json({ error: "Family group not found or without income settings" }, { status: 404 });
    }

    // 2. Buscar Contas para somar faturas de cartão
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, type, closing_day")
      .eq("family_group_id", familyGroupId);

    let totalCreditCardInvoices = 0;
    let extraIncomeCents = 0;
    let currentMonthExpensesCents = 0;

    if (accounts && accounts.length > 0) {
      // 3. Buscar todas as transações do Mês Atual
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("amount_cents, transaction_type, account_id, date, is_legacy_debt")
        .eq("family_group_id", familyGroupId)
        .gte("date", monthStart);

      if (monthTxs) {
        // Filtrar as transações que NÃO são de Cartão de Crédito e NÃO são dívidas legadas (já deduzidas no custo fixo)
        const nonCreditCardAccIds = accounts.filter(a => a.type !== "CREDIT_CARD").map(a => a.id);
        
        extraIncomeCents = monthTxs
          .filter(tx => tx.transaction_type === "INCOME")
          .reduce((sum, tx) => sum + tx.amount_cents, 0);
          
        currentMonthExpensesCents = monthTxs
          .filter(tx => tx.transaction_type === "EXPENSE" && nonCreditCardAccIds.includes(tx.account_id) && !tx.is_legacy_debt)
          .reduce((sum, tx) => sum + tx.amount_cents, 0);
      }

      // 4. Calcular fatura de cada cartão de crédito
      for (const acc of accounts) {
        if (acc.type === "CREDIT_CARD") {
          let invY = now.getUTCFullYear();
          let invM = now.getUTCMonth();
          
          if (now.getUTCDate() > (acc.closing_day || 1)) {
            invM++;
            if (invM > 11) { invM = 0; invY++; }
          }
          const invoiceStr = `${invY}-${String(invM + 1).padStart(2, '0')}-01`;

          const { data: txs } = await supabase
            .from("transactions")
            .select("amount_cents, date, is_legacy_debt")
            .eq("account_id", acc.id);
          
          const cardTotal = txs?.reduce((sum, tx) => {
            // Ignoramos dívidas legadas no cartão se o usuário as tratar como Custo Fixo!
            if (tx.is_legacy_debt) return sum;

            const txDate = new Date(tx.date);
            let tY = txDate.getUTCFullYear();
            let tM = txDate.getUTCMonth();
            
            if (txDate.getUTCDate() > (acc.closing_day || 1)) {
              tM++;
              if (tM > 11) { tM = 0; tY++; }
            }
            
            const txInvoiceStr = `${tY}-${String(tM + 1).padStart(2, '0')}-01`;
            return txInvoiceStr === invoiceStr ? sum + tx.amount_cents : sum;
          }, 0) || 0;

          totalCreditCardInvoices += cardTotal;
        }
      }
    }

    // 5. Matemática do Teto de Sobrevivência
    const survivalCeilingCents = Math.max(0, 
      (familyGroup.monthly_income_cents || 0) + 
      (familyGroup.accumulated_balance_cents || 0) + 
      extraIncomeCents - 
      (familyGroup.fixed_expenses_cents || 0) - 
      totalCreditCardInvoices - 
      currentMonthExpensesCents
    );

    return NextResponse.json({
      survivalCeilingCents,
      survivalCeilingFormatted: (survivalCeilingCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      breakdown: {
        monthlyIncomeCents: familyGroup.monthly_income_cents,
        accumulatedBalanceCents: familyGroup.accumulated_balance_cents,
        extraIncomeCents,
        fixedExpensesCents: familyGroup.fixed_expenses_cents,
        currentMonthExpensesCents,
        totalCreditCardInvoices
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
