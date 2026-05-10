import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pg";

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

  try {
    // Tentar usar a função RPC se existir
    const { rows } = await pool.query(
      `SELECT get_financial_state_v5($1::uuid) as state`,
      [userId]
    );

    if (rows[0]?.state) {
      return NextResponse.json(rows[0].state);
    }

    // Fallback: montar o estado manualmente a partir das tabelas
    return NextResponse.json(await buildFinancialState(userId));
  } catch (error: any) {
    console.error("GET /api/financial-state RPC failed, using fallback:", error.message);
    
    try {
      const state = await buildFinancialState(userId);
      return NextResponse.json(state);
    } catch (fallbackError: any) {
      console.error("Fallback also failed:", fallbackError);
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }
  }
}

/**
 * Constrói o estado financeiro manualmente a partir das tabelas individuais.
 * Serve como fallback caso a RPC não exista ou falhe.
 */
async function buildFinancialState(userId: string) {
  const [
    accountsResult,
    categoriesResult,
    goalsResult,
    recurringResult,
    budgetsResult,
    transactionsResult,
  ] = await Promise.all([
    pool.query(`SELECT * FROM public.accounts WHERE user_id = $1 ORDER BY created_at`, [userId]),
    pool.query(`SELECT * FROM public.categories WHERE user_id = $1 ORDER BY name`, [userId]),
    pool.query(`SELECT * FROM public.goals WHERE user_id = $1 ORDER BY created_at`, [userId]),
    pool.query(`SELECT * FROM public.recurring_transactions WHERE user_id = $1 ORDER BY created_at`, [userId]),
    pool.query(`SELECT * FROM public.budgets WHERE user_id = $1`, [userId]),
    pool.query(
      `SELECT t.*, c.name as category_name, c.type as category_type
       FROM public.transactions t
       LEFT JOIN public.categories c ON t.category_id = c.id
       WHERE t.user_id = $1
       ORDER BY t.date DESC
       LIMIT 500`,
      [userId]
    ),
  ]);

  const accounts = accountsResult.rows;
  const categories = categoriesResult.rows;
  const goals = goalsResult.rows;
  const recurring_transactions = recurringResult.rows;
  const budgets = budgetsResult.rows;
  const allTransactions = transactionsResult.rows;

  // Saldo acumulado
  const accumulated_balance_cents = accounts.reduce(
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

  const accountMap = new Map(accounts.map((a: any) => [a.id, a]));

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
    categories,
    accounts,
    goals,
    recurring_transactions,
    budgets,
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
