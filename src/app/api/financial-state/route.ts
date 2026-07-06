import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/server";

/**
 * GET /api/financial-state
 * Retorna o estado financeiro completo via RPC get_financial_state_v5.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  );

  const { data: { user } } = await supabaseAuth.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = user.id;
  const supabase = await createAdminClient();

  try {
    // Fechar automaticamente faturas cuja data de fechamento já passou
    try {
      await supabase.rpc('fn_auto_close_invoices');
    } catch {
      // Se a função não existir ou falhar, segue normalmente
    }

    // Processar transações recorrentes do mês atual
    try {
      await supabase.rpc('fn_process_recurring_transactions');
    } catch {
      // Se a função não existir ou falhar, segue normalmente
    }

    // Tentar usar a função RPC se existir (com retry simples)
    try {
      let rpcResult: any;
      let retries = 0;
      while (retries < 2) {
        rpcResult = await supabase.rpc('get_financial_state_v5', { p_user_id: userId });
        if (!rpcResult.error) break;
        retries++;
        if (retries < 2) await new Promise(r => setTimeout(r, 500));
      }
      const { data, error } = rpcResult;

      if (!error && data) {
        // Enriquecer contas de cartão com dados de fatura retornados na própria RPC
        const enrichedAccounts = enrichCreditCardAccounts(data.accounts, data.invoices);

        data.accounts = enrichedAccounts;

        // Garantir que todas as transações recorrentes (incluindo as pausadas) sejam retornadas
        try {
          const { data: dbRecurring, error: recError } = await supabase
            .from('recurring_transactions')
            .select('*')
            .eq('user_id', userId);

          if (!recError && dbRecurring) {
            const catMap = new Map((data.categories || []).map((c: any) => [c.id, c]));
            const accMap = new Map((enrichedAccounts || []).map((a: any) => [a.id, a]));
            
            data.recurring_transactions = dbRecurring.map((rt: any) => ({
              ...rt,
              category: rt.category_id ? catMap.get(rt.category_id) || null : null,
              account: rt.account_id ? accMap.get(rt.account_id) || null : null
            }));
          }
        } catch (err) {
          console.warn("⚠️ Falha ao buscar transações recorrentes pausadas:", err);
        }
        
        // Garantir consistência: Se a RPC retornou family_group mas não user_profile, mapeamos
        if (data.family_group && !data.user_profile) {
          data.user_profile = {
            monthly_income_cents: data.family_group.monthly_income_cents || 0,
            fixed_expenses_cents: data.family_group.fixed_expenses_cents || 0,
            accumulated_balance_cents: (data.accounts || [])
              .filter((a: any) => a.type !== "CREDIT_CARD")
              .reduce((acc: number, a: any) => acc + (Number(a.balance_cents) || 0), 0),
            financial_health_score: data.family_group.financial_health_score || 80,
          };
        }

        return NextResponse.json(data);
      } else {
        console.warn("RPC get_financial_state_v5 failed, using manual build:", error?.message);
      }
    } catch (rpcErr: any) {
      console.warn("Error calling get_financial_state_v5 RPC:", rpcErr.message);
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
  const supabase = await createAdminClient();

  const [
    accountsRes,
    categoriesRes,
    goalsRes,
    recurringRes,
    budgetsRes,
    transactionsRes,
    profileRes,
    invoicesRes,
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
    supabase.from('credit_card_invoices').select('*').eq('user_id', userId).order('reference_month', { ascending: true }),
  ]);

  if (accountsRes.error || categoriesRes.error || goalsRes.error) {
    const error = accountsRes.error || categoriesRes.error || goalsRes.error;
    console.error("Database error in buildFinancialState:", error);
    throw new Error(`Database connection failed: ${error?.message}`);
  }

  const accounts = accountsRes.data;
  const categories = categoriesRes.data;
  const goals = goalsRes.data;
  const recurring_transactions = recurringRes.data;
  const budgets = budgetsRes.data;
  const transactionsData = transactionsRes.data;
  const profile = profileRes.data;
  const invoices = invoicesRes.data || [];

  const allTransactions = (transactionsData || []).map((t: any) => ({
    ...t,
    category_name: t.categories?.name,
    category_type: t.categories?.type,
  }));

  // Saldo acumulado (desconsidera contas do tipo CREDIT_CARD)
  const accumulated_balance_cents = (accounts || [])
    .filter((a: any) => a.type !== "CREDIT_CARD")
    .reduce(
      (acc: number, a: any) => acc + (Number(a.balance_cents) || 0),
      0
    );

  const initialAccountMap = new Map((accounts || []).map((a: any) => [a.id, a]));

  // Transações recentes (10) + transações de cartão de crédito não pagas + transações criadas nas últimas 24h para sincronização segura
  const limitDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const unpaidOrNewTransactions = allTransactions.filter((t: any) => {
    const acc = initialAccountMap.get(t.account_id);
    const createdDate = new Date(t.created_at);
    const isUnpaidCredit = (acc as any)?.type === "CREDIT_CARD" && !t.is_paid;
    const isNew = createdDate >= limitDate;
    return isUnpaidCredit || isNew;
  });
  
  const recent_transactions = Array.from(
    new Map(
      [...allTransactions.slice(0, 10), ...unpaidOrNewTransactions].map((t: any) => [t.id, t])
    ).values()
  );

  // Transações do mês atual
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const month_transactions = allTransactions.filter((t: any) => {
    const d = new Date(t.date);
    return d >= firstDayOfMonth && d <= lastDayOfMonth;
  });

  // Transações futuras (parcelas de cartão, agendamentos e transações de cartão de crédito não pagas)
  const future_transactions = allTransactions.filter((t: any) => {
    const d = new Date(t.date);
    const acc = initialAccountMap.get(t.account_id);
    const isUnpaidCredit = (acc as any)?.type === "CREDIT_CARD" && !t.is_paid;
    return d > lastDayOfMonth || isUnpaidCredit;
  });

  // Estatísticas do mês
  let income = 0;
  let debit_expense = 0;
  let credit_expense = 0;
  let investments = 0;

  // Faturas foram descontinuadas - Agregação é 100% dinâmica via transações



    // Enriquecer contas de cartão com dados de faturas reais
  const enrichedAccounts = enrichCreditCardAccounts(accounts, invoices);

  const accountMap = new Map(enrichedAccounts.map((a: any) => [a.id, a]));

  month_transactions.forEach((t: any) => {
    const amountCents = Number(t.amount_cents) || 0;
    if (t.transaction_type === "INCOME") income += amountCents;
    if (t.transaction_type === "INVESTMENT") investments += amountCents;
    if (t.transaction_type === "EXPENSE") {
      const acc = accountMap.get(t.account_id);
      if (acc && (acc as any).type === "CREDIT_CARD") {
        credit_expense += amountCents;
      } else {
        debit_expense += amountCents;
      }
    }
  });

  const catMap = new Map((categories || []).map((c: any) => [c.id, c]));
  const accMap = new Map((enrichedAccounts || []).map((a: any) => [a.id, a]));
  const enrichedRecurring = (recurring_transactions || []).map((rt: any) => ({
    ...rt,
    category: rt.category_id ? catMap.get(rt.category_id) || null : null,
    account: rt.account_id ? accMap.get(rt.account_id) || null : null
  }));

  return {
    user_profile: {
      monthly_income_cents: profile?.monthly_income_cents || 0,
      fixed_expenses_cents: profile?.fixed_expenses_cents || 0,
      accumulated_balance_cents,
      financial_health_score: profile?.financial_health_score || 80,
    },
    categories: categories || [],
    accounts: enrichedAccounts,
    invoices: invoices || [],
    goals: goals || [],
    recurring_transactions: enrichedRecurring,
    budgets: budgets || [],
    recent_transactions,
    month_transactions,
    future_transactions,
    month_stats: {
      income,
      debit_expense,
      credit_expense,
      investments,
    },
  };
}

/**
 * Enriquecer contas de cartão com dados de fatura.
 * Refatorado para remover a duplicação e evitar o acúmulo infinito de dívida por faturas pagas (Bug #1 e #8).
 */
function enrichCreditCardAccounts(accounts: any[], invoices: any[]) {
  return (accounts || []).map((acc: any) => {
    if (acc.type !== "CREDIT_CARD") return acc;

    const accountInvoices = (invoices || []).filter((i: any) => i.account_id === acc.id);
    
    // Ordenar faturas por reference_month de forma crescente (mais antigas primeiro)
    const sortedInvoices = [...accountInvoices].sort((a, b) => 
      (a.reference_month || "").localeCompare(b.reference_month || "")
    );

    const openInvoice = sortedInvoices.find((i: any) => i.status === "OPEN");
    const closedInvoices = sortedInvoices.filter((i: any) => i.status === "CLOSED");

    const openCents = openInvoice ? (Number(openInvoice.amount_cents) || 0) : 0;
    const closedCents = closedInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);

    // Dívida Consolidada Pendente Real: soma de todas as faturas abertas (OPEN) e fechadas (CLOSED) pendentes
    const unpaidInvoices = sortedInvoices.filter((i: any) => i.status === "OPEN" || i.status === "CLOSED");
    const unpaidDebtCents = unpaidInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);
    
    // BUG #1: `balance_cents` antes somava TUDO (incluindo PAID). Agora só soma as não pagas.
    const totalDebt = unpaidDebtCents;

    return {
      ...acc,
      open_invoice_id: openInvoice ? openInvoice.id : null,
      closed_invoice_id: closedInvoices.length > 0 ? closedInvoices[0].id : null,
      open_invoice_cents: openCents,
      closed_invoice_cents: closedCents,
      balance_cents: -totalDebt,
      total_debt_cents: unpaidDebtCents,
      open_invoice_month: openInvoice ? openInvoice.reference_month : null,
      closed_invoice_month: closedInvoices.length > 0 ? closedInvoices[0].reference_month : null
    };
  });
}

