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
    // Tentar usar a função RPC se existir (com retry simples)
    let rpcResult: any;
    let retries = 0;
    while (retries < 2) {
      rpcResult = await supabase.rpc('get_financial_state_v5', { p_user_id: userId });
      if (!rpcResult.error) break;
      retries++;
      if (retries < 2) await new Promise(r => setTimeout(r, 500));
    }
    const { data, error } = rpcResult;

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

        const openCents = openInvoice ? (Number(openInvoice.amount_cents) || 0) : 0;
        const closedCents = closedInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);

        // Dívida Consolidada Pendente Real: soma de todas as faturas abertas (OPEN) e fechadas (CLOSED) pendentes
        const unpaidInvoices = sortedInvoices.filter((i: any) => i.status === "OPEN" || i.status === "CLOSED");
        const unpaidDebtCents = unpaidInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);
        const totalDebt = accountInvoices.reduce((sum: number, i: any) => sum + (Number(i.amount_cents) || 0), 0);

        return {
          ...acc,
          open_invoice_cents: openCents,
          closed_invoice_cents: closedCents,
          balance_cents: -totalDebt,
          total_debt_cents: unpaidDebtCents,
          open_invoice_month: openInvoice ? openInvoice.reference_month : null,
          closed_invoice_month: closedInvoices.length > 0 ? closedInvoices[0].reference_month : null
        };
      });

      data.accounts = enrichedAccounts;
      
      // Garantir consistência: Se a RPC retornou family_group mas não user_profile, mapeamos
      if (data.family_group && !data.user_profile) {
        data.user_profile = {
          monthly_income_cents: data.family_group.monthly_income_cents || 0,
          fixed_expenses_cents: data.family_group.fixed_expenses_cents || 0,
          accumulated_balance_cents: (data.accounts || []).reduce((acc: number, a: any) => acc + (Number(a.balance_cents) || 0), 0),
          financial_health_score: data.family_group.financial_health_score || 80,
        };
      }

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
  const supabase = await createAdminClient();

  const [
    accountsRes,
    categoriesRes,
    goalsRes,
    recurringRes,
    budgetsRes,
    transactionsRes,
    profileRes,
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

  const initialAccountMap = new Map((accounts || []).map((a: any) => [a.id, a]));

  // Transações recentes (10) + transações de cartão de crédito não pagas + transações criadas nas últimas 24h para sincronização segura
  const limitDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const unpaidOrNewTransactions = allTransactions.filter((t: any) => {
    const acc = initialAccountMap.get(t.account_id);
    const createdDate = new Date(t.created_at);
    const isUnpaidCredit = acc?.type === "CREDIT_CARD" && !t.is_paid;
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
    const isUnpaidCredit = acc?.type === "CREDIT_CARD" && !t.is_paid;
    return d > lastDayOfMonth || isUnpaidCredit;
  });

  // Estatísticas do mês
  let income = 0;
  let debit_expense = 0;
  let credit_expense = 0;
  let investments = 0;

  // Buscar faturas para contas de cartão de crédito (todas, para processar histórico)
  const { data: allInvoices } = await supabase
    .from('credit_card_invoices')
    .select('*, accounts!inner(user_id, closing_day, due_day)')
    .eq('accounts.user_id', userId);

  const currentMonthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthRef = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Enriquecer contas com dados de fatura
  const enrichedAccounts = (accounts || []).map((acc: any) => {
    if (acc.type !== "CREDIT_CARD") return acc;

    const accountInvoices = (allInvoices || []).filter((i: any) => i.account_id === acc.id);
    
    // 1. Processar faturas virtuais para o passado
    const processedInvoices = accountInvoices.map(inv => {
      // Se a fatura é de um mês anterior ao atual e ainda está OPEN ou CLOSED, tratamos como PAID
      // (conforme pedido pelo usuário para entrar contando como pago)
      if (inv.reference_month < currentMonthRef && inv.status !== 'PAID') {
        return { ...inv, status: 'PAID' };
      }
      return inv;
    });

    // 2. Determinar qual mês deve estar aberto baseado no dia de fechamento
    // Se hoje >= dia de fechamento, a fatura do mês atual já "fechou" e a aberta deve ser a próxima
    const today = now.getDate();
    const isCurrentMonthClosed = acc.closing_day && today >= acc.closing_day;
    const targetOpenMonth = isCurrentMonthClosed ? nextMonthRef : currentMonthRef;

    // 3. Filtrar e ordenar faturas ativas (não pagas após o processamento acima)
    const activeInvoices = processedInvoices
      .filter(i => i.status !== 'PAID')
      .sort((a, b) => (a.reference_month || "").localeCompare(b.reference_month || ""));

    // Tentar encontrar a fatura aberta do mês alvo ou a mais próxima futura
    let openInvoice = activeInvoices.find(i => i.status === 'OPEN' && i.reference_month >= targetOpenMonth);
    
    if (!openInvoice) {
      openInvoice = activeInvoices.find(i => i.status === 'OPEN');
    }

    const closedInvoices = activeInvoices.filter(i => i.status === 'CLOSED' && i.id !== openInvoice?.id);

    const openCents = openInvoice ? (Number(openInvoice.amount_cents) || 0) : 0;
    const closedCents = closedInvoices.reduce((sum, i) => sum + (Number(i.amount_cents) || 0), 0);
    
    // IMPORTANTE: totalDebt deve ser a soma de TODAS as transações não pagas do cartão,
    // inclusive parcelas futuras que ainda não entraram em faturas geradas.
    const accountTransactions = allTransactions.filter(t => t.account_id === acc.id && !t.is_paid);
    const totalDebt = accountTransactions.reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    // Próximo mês de alívio: quanto será liberado no próximo mês (fatura que vence após a atual)
    // Buscamos transações que terminam ou que têm parcelas no próximo mês
    const nextMonthTransactions = allTransactions.filter(t => {
      if (t.account_id !== acc.id || t.is_paid) return false;
      const d = new Date(t.date);
      const mRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mRef === targetOpenMonth;
    });
    const nextMonthReleaseCandidate = nextMonthTransactions.reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    return {
      ...acc,
      open_invoice_cents: openCents,
      closed_invoice_cents: closedCents,
      balance_cents: -totalDebt,
      total_debt_cents: totalDebt,
      next_month_impact_cents: nextMonthReleaseCandidate,
      open_invoice_month: openInvoice ? openInvoice.reference_month : targetOpenMonth,
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
      monthly_income_cents: profile?.monthly_income_cents || 0,
      fixed_expenses_cents: profile?.fixed_expenses_cents || 0,
      accumulated_balance_cents,
      financial_health_score: profile?.financial_health_score || 80,
    },
    categories: categories || [],
    accounts: enrichedAccounts,
    goals: goals || [],
    recurring_transactions: recurring_transactions || [],
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

