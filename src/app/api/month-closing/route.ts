import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/server";

/**
 * GET /api/month-closing?month=YYYY-MM
 * 
 * Retorna o snapshot selado do mês solicitado.
 * Se não existir, executa auto-seal calculando retroativamente.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const month = request.nextUrl.searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Parâmetro 'month' inválido. Formato esperado: YYYY-MM" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Tentar buscar closing existente
    const { data: existing } = await supabase
      .from("month_closings")
      .select("*")
      .eq("user_id", user.id)
      .eq("reference_month", month)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ closing: existing, source: "sealed" });
    }

    // Auto-seal: calcular retroativamente
    const closing = await calculateAndSealMonth(supabase, user.id, month);
    return NextResponse.json({ closing, source: "auto-sealed" });

  } catch (error: any) {
    console.error("GET /api/month-closing failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/month-closing
 * 
 * Permite corrigir/sobrescrever o saldo de um mês já selado.
 * Usado pela tela de Reconciliação quando o usuário informa o saldo real.
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { reference_month, total_balance_cents, seal_method } = body;

    if (!reference_month || !/^\d{4}-\d{2}$/.test(reference_month) || total_balance_cents == null) {
      return NextResponse.json({ error: "Campos obrigatórios inválidos. reference_month deve ser YYYY-MM" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Buscar contas para montar account_balances
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, type, balance_cents")
      .eq("user_id", user.id);

    // Buscar transações do mês para income/expenses
    const [year, monthNum] = reference_month.split("-").map(Number);
    const monthStart = `${reference_month}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const monthEnd = `${reference_month}-${String(lastDay).padStart(2, "0")}`;

    const { data: txs } = await supabase
      .from("transactions")
      .select("amount_cents, transaction_type")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd);

    const totalIncome = (txs || [])
      .filter(t => t.transaction_type === "INCOME")
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    const totalExpenses = (txs || [])
      .filter(t => t.transaction_type === "EXPENSE")
      .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

    // Dívida de cartão de crédito usando faturas do mês (SSOT fix)
    const creditCardIds = (accounts || [])
      .filter(a => a.type === "CREDIT_CARD")
      .map(a => a.id);

    let totalCreditDebt = 0;
    if (creditCardIds.length > 0) {
      const { data: monthInvoices } = await supabase
        .from("credit_card_invoices")
        .select("amount_cents, status")
        .in("account_id", creditCardIds)
        .eq("reference_month", reference_month)
        .in("status", ["OPEN", "CLOSED"]);

      totalCreditDebt = (monthInvoices || [])
        .reduce((sum, inv) => sum + (Number(inv.amount_cents) || 0), 0);
    }

    const checkingAccounts = (accounts || []).filter(a => a.type !== "CREDIT_CARD");

    // Upsert: se já existe, atualiza; senão, cria
    const { data, error } = await supabase
      .from("month_closings")
      .upsert({
        user_id: user.id,
        reference_month,
        total_balance_cents,
        account_balances: checkingAccounts.map(a => {
          const currentTotal = checkingAccounts.reduce((sum, acc) => sum + (Number(acc.balance_cents) || 0), 0);
          const proportion = currentTotal > 0
            ? (Number(a.balance_cents) || 0) / currentTotal
            : 1 / checkingAccounts.length;
          return {
            account_id: a.id,
            name: a.name,
            balance_cents: Math.round(total_balance_cents * proportion)
          };
        }),
        total_income_cents: totalIncome,
        total_expenses_cents: totalExpenses,
        total_credit_debt_cents: totalCreditDebt,
        sealed_at: new Date().toISOString(),
        seal_method: seal_method || "manual"
      }, { onConflict: "user_id,reference_month" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ closing: data, source: "manual" });

  } catch (error: any) {
    console.error("PUT /api/month-closing failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Calcula retroativamente o estado financeiro de um mês passado
 * e sela na tabela month_closings.
 * 
 * Estratégia:
 * 1. Busca todas as transações do mês-alvo
 * 2. Se for o mês anterior ao atual, usa saldo atual das contas
 *    e reverte as transações do mês atual para derivar o saldo de fim do mês-alvo
 * 3. Se for mais antigo, encadeia com closings existentes ou faz best-effort
 */
async function calculateAndSealMonth(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  month: string
) {
  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  // Buscar contas atuais
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, type, balance_cents")
    .eq("user_id", userId);

  // Buscar TODAS as transações desde o início do mês-alvo até hoje
  // para poder reverter o saldo atual
  const { data: txsSinceTarget } = await supabase
    .from("transactions")
    .select("amount_cents, transaction_type, account_id, date, is_paid")
    .eq("user_id", userId)
    .gt("date", monthEnd)
    .eq("is_paid", true)
    .order("date", { ascending: false });

  // Buscar transações DO mês-alvo (para income/expenses)
  const { data: txsInMonth } = await supabase
    .from("transactions")
    .select("amount_cents, transaction_type, account_id, is_paid")
    .eq("user_id", userId)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const totalIncome = (txsInMonth || [])
    .filter(t => t.transaction_type === "INCOME")
    .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

  const totalExpenses = (txsInMonth || [])
    .filter(t => t.transaction_type === "EXPENSE")
    .reduce((sum, t) => sum + (Number(t.amount_cents) || 0), 0);

  // Saldo atual das contas correntes (não cartão)
  const checkingAccounts = (accounts || []).filter(a => a.type !== "CREDIT_CARD");
  const currentCheckingBalance = checkingAccounts.reduce(
    (sum, a) => sum + (Number(a.balance_cents) || 0), 0
  );

  // Reverter transações pós mês-alvo para derivar saldo de fim do mês-alvo
  // Income após o mês-alvo = dinheiro que entrou DEPOIS → subtrair
  // Expense após o mês-alvo = dinheiro que saiu DEPOIS → somar de volta
  const checkingAccountIds = new Set(checkingAccounts.map(a => a.id));

  let reversedBalance = currentCheckingBalance;
  for (const tx of txsSinceTarget || []) {
    // Só reverter transações de contas correntes (não cartão)
    if (!checkingAccountIds.has(tx.account_id)) continue;

    if (tx.transaction_type === "INCOME") {
      reversedBalance -= Number(tx.amount_cents) || 0;
    } else if (tx.transaction_type === "EXPENSE") {
      reversedBalance += Number(tx.amount_cents) || 0;
    }
  }

  // Dívida de cartão de crédito usando faturas do mês (SSOT fix)
  const creditCardIds = (accounts || [])
    .filter(a => a.type === "CREDIT_CARD")
    .map(a => a.id);

  let totalCreditDebt = 0;
  if (creditCardIds.length > 0) {
    const { data: monthInvoices } = await supabase
      .from("credit_card_invoices")
      .select("amount_cents, status")
      .in("account_id", creditCardIds)
      .eq("reference_month", month)
      .in("status", ["OPEN", "CLOSED"]);

    totalCreditDebt = (monthInvoices || [])
      .reduce((sum, inv) => sum + (Number(inv.amount_cents) || 0), 0);
  }

  // Montar account_balances retroativo (proporcional ao saldo revertido)
  const accountBalances = checkingAccounts.map(a => {
    const proportion = currentCheckingBalance > 0
      ? (Number(a.balance_cents) || 0) / currentCheckingBalance
      : 1 / checkingAccounts.length;
    return {
      account_id: a.id,
      name: a.name,
      balance_cents: Math.round(reversedBalance * proportion)
    };
  });

  // Inserir no banco
  const { data, error } = await supabase
    .from("month_closings")
    .upsert({
      user_id: userId,
      reference_month: month,
      total_balance_cents: reversedBalance,
      account_balances: accountBalances,
      total_income_cents: totalIncome,
      total_expenses_cents: totalExpenses,
      total_credit_debt_cents: totalCreditDebt,
      sealed_at: new Date().toISOString(),
      seal_method: "auto"
    }, { onConflict: "user_id,reference_month" })
    .select()
    .single();

  if (error) {
    console.error("Falha ao auto-selar mês:", error);
    throw new Error(`Falha ao auto-selar mês ${month}: ${error.message}`);
  }

  return data;
}
