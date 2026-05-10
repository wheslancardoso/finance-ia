import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/financial-state?user_id=xxx
 * Retorna o estado financeiro completo via RPC get_financial_state_v5.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    // Tentar usar a função RPC se existir
    const { data, error } = await supabase.rpc('get_financial_state_v5', {
      p_user_id: userId
    });

    if (error) {
      console.warn("RPC get_financial_state_v5 failed, using manual build:", error.message);
    } else if (data) {
      // Enriquecer contas de cartão com dados de fatura retornados na própria RPC
      const enrichedAccounts = (data.accounts || []).map((acc: any) => {
        if (acc.type !== "CREDIT_CARD") return acc;

        const accountInvoices = (data.invoices || []).filter((i: any) => i.account_id === acc.id);
        
        // Ordenar faturas por reference_month de forma crescente (mais antigas primeiro)
        const sortedInvoices = [...accountInvoices].sort((a, b) => 
          (a.reference_month || "").localeCompare(b.reference_month || "")
        );

        const openInvoice = sortedInvoices.find((i: any) => i.status === "OPEN");
        const closedInvoices = sortedInvoices.filter((i: any) => i.status === "CLOSED");

        const openCents = openInvoice ? Number(openInvoice.amount_cents) : 0;
        const closedCents = closedInvoices.reduce((sum: number, i: any) => sum + Number(i.amount_cents), 0);
        const totalDebt = accountInvoices.reduce((sum: number, i: any) => sum + Number(i.amount_cents), 0);

        return {
          ...acc,
          open_invoice_cents: openCents,
          closed_invoice_cents: closedCents,
          balance_cents: -totalDebt,
          open_invoice_month: openInvoice ? openInvoice.reference_month : null,
          closed_invoice_month: closedInvoices.length > 0 ? closedInvoices[0].reference_month : null
        };
      });

      data.accounts = enrichedAccounts;
      return NextResponse.json(data);
    }

    // Fallback: montar o estado manualmente a partir das tabelas usando Supabase
    const state = await buildFinancialState(userId);
    return NextResponse.json(state);
  } catch (error: any) {
    console.error("GET /api/financial-state failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Constrói o estado financeiro manualmente a partir das tabelas individuais.
 * Serve como fallback caso a RPC não exista ou falhe.
 */
async function buildFinancialState(userId: string) {
  const supabase = await createClient();

  const [
    { data: accounts },
    { data: categories },
    { data: goals },
    { data: recurring_transactions },
    { data: budgets },
    { data: transactionsData },
    { data: profile },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('categories').select('*').or(`user_id.eq.${userId},is_system_default.eq.true`).order('name'),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('recurring_transactions').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('budgets').select('*').eq('user_id', userId),
    supabase.from('transactions')
      .select('*, categories(name, type)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(500),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ]);

  const allTransactions = (transactionsData || []).map((t: any) => ({
    ...t,
    category_name: t.categories?.name,
    category_type: t.categories?.type,
  }));

  // Saldo acumulado
  const accumulated_balance_cents = (accounts || []).reduce(
    (acc: number, a: any) => acc + (Number(a.balance_cents) || 0),
    0
  );

  // Transações recentes (10)
  const recent_transactions = allTransactions.slice(0, 10);

  // Transações do mês atual
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const month_transactions = allTransactions.filter((t: any) => {
    const d = new Date(t.date);
    return d >= firstDayOfMonth && d <= lastDayOfMonth;
  });

  // Estatísticas do mês
  let income = 0;
  let debit_expense = 0;
  let credit_expense = 0;
  let investments = 0;

  // Buscar faturas para contas de cartão de crédito
  const { data: allInvoices } = await supabase
    .from('credit_card_invoices')
    .select('*, accounts!inner(user_id)')
    .eq('accounts.user_id', userId)
    .neq('status', 'PAID');

  // Enriquecer contas com dados de fatura
  const enrichedAccounts = (accounts || []).map((acc: any) => {
    if (acc.type !== "CREDIT_CARD") return acc;

    const accountInvoices = (allInvoices || []).filter((i: any) => i.account_id === acc.id);
    
    const sortedInvoices = [...accountInvoices].sort((a, b) => 
      (a.reference_month || "").localeCompare(b.reference_month || "")
    );

    const openInvoice = sortedInvoices.find((i: any) => i.status === "OPEN");
    const closedInvoices = sortedInvoices.filter((i: any) => i.status === "CLOSED");

    const openCents = openInvoice ? Number(openInvoice.amount_cents) : 0;
    const closedCents = closedInvoices.reduce((sum, i) => sum + Number(i.amount_cents), 0);
    const totalDebt = accountInvoices.reduce((sum, i) => sum + Number(i.amount_cents), 0);

    return {
      ...acc,
      open_invoice_cents: openCents,
      closed_invoice_cents: closedCents,
      balance_cents: -totalDebt,
      open_invoice_month: openInvoice ? openInvoice.reference_month : null,
      closed_invoice_month: closedInvoices.length > 0 ? closedInvoices[0].reference_month : null
    };
  });

  const accountMap = new Map(enrichedAccounts.map((a: any) => [a.id, a]));

  month_transactions.forEach((t: any) => {
    const amountCents = Number(t.amount_cents) || 0;
    if (t.transaction_type === "INCOME") income += amountCents;
    if (t.transaction_type === "EXPENSE") {
      const acc = accountMap.get(t.account_id);
      if (acc && acc.type === "CREDIT_CARD") {
        credit_expense += amountCents;
      } else {
        debit_expense += amountCents;
      }
    }
  });

  return {
    user_profile: {
      monthly_income_cents: 0,
      fixed_expenses_cents: 0,
      accumulated_balance_cents,
      financial_health_score: 80,
    },
    categories: categories || [],
    accounts: enrichedAccounts,
    goals: goals || [],
    recurring_transactions: recurring_transactions || [],
    budgets: budgets || [],
    recent_transactions,
    month_transactions,
    month_stats: {
      income,
      debit_expense,
      credit_expense,
      investments,
    },
  };
}
