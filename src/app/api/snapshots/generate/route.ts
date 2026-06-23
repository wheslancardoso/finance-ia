import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/server";

function formatCurrency(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function escapeCSV(val: string | number | null | undefined) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes(';') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function POST(request: NextRequest) {
  try {
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
    const body = await request.json().catch(() => ({}));
    
    // reference_month format: YYYY-MM
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const referenceMonth = body.reference_month || defaultMonth;

    const supabase = await createAdminClient();

    // Buscar Contas
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId);

    if (accountsError) throw accountsError;

    // Buscar Transações do mês (aproximado, baseando-se no string do referenceMonth)
    const year = parseInt(referenceMonth.split('-')[0]);
    const month = parseInt(referenceMonth.split('-')[1]) - 1;
    
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (txError) throw txError;

    // Calcular Totais
    let totalBalanceCents = 0;
    (accounts || []).forEach(acc => {
      totalBalanceCents += Number(acc.balance_cents) || 0;
    });

    let totalIncomeCents = 0;
    let totalExpensesCents = 0;

    (transactions || []).forEach(tx => {
      const amt = Number(tx.amount_cents) || 0;
      if (tx.transaction_type === 'INCOME') totalIncomeCents += amt;
      if (tx.transaction_type === 'EXPENSE') totalExpensesCents += amt;
    });

    // Montar o CSV
    let csvContent = "";
    const delimiter = ";"; // Melhor para Excel no Brasil

    // Cabeçalho do Resumo
    csvContent += `RESUMO DO MÊS: ${referenceMonth}\n`;
    csvContent += `Saldo Total Contas;Receitas no Mês;Despesas no Mês\n`;
    csvContent += `${escapeCSV(formatCurrency(totalBalanceCents))};${escapeCSV(formatCurrency(totalIncomeCents))};${escapeCSV(formatCurrency(totalExpensesCents))}\n\n`;

    // Seção de Contas
    csvContent += `ESTADO DAS CONTAS\n`;
    csvContent += `Conta;Tipo;Saldo Final\n`;
    (accounts || []).forEach(acc => {
      csvContent += `${escapeCSV(acc.name)};${escapeCSV(acc.type)};${escapeCSV(formatCurrency(acc.balance_cents))}\n`;
    });
    csvContent += `\n`;

    // Seção de Transações
    csvContent += `TRANSAÇÕES DO MÊS\n`;
    csvContent += `Data;Descrição;Categoria;Conta;Tipo;Status;Valor\n`;
    (transactions || []).forEach(tx => {
      const accName = (accounts || []).find(a => a.id === tx.account_id)?.name || "Desconhecida";
      const catName = tx.categories?.name || "Sem categoria";
      const dateStr = new Date(tx.date).toLocaleDateString('pt-BR');
      const statusStr = tx.is_paid ? "Efetivado" : "Pendente";
      
      csvContent += `${escapeCSV(dateStr)};${escapeCSV(tx.description)};${escapeCSV(catName)};${escapeCSV(accName)};${escapeCSV(tx.transaction_type)};${escapeCSV(statusStr)};${escapeCSV(formatCurrency(tx.amount_cents))}\n`;
    });

    // Converter string para Buffer
    const fileBuffer = Buffer.from('\uFEFF' + csvContent, 'utf-8'); // \uFEFF é o BOM para o Excel ler acentos no UTF-8
    const fileName = `${userId}/${referenceMonth}_snapshot.csv`;

    // Upload pro Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('monthly_dumps')
      .upload(fileName, fileBuffer, {
        contentType: 'text/csv;charset=utf-8',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Registrar no banco de dados (monthly_snapshots)
    const { error: dbError } = await supabase
      .from('monthly_snapshots')
      .upsert({
        user_id: userId,
        reference_month: referenceMonth,
        file_path: fileName,
        total_balance_cents: totalBalanceCents,
        total_income_cents: totalIncomeCents,
        total_expenses_cents: totalExpensesCents
      }, { onConflict: 'user_id, reference_month' });

    if (dbError) throw dbError;

    // Obter URL assinada para download imediato
    const { data: signedUrlData } = await supabase.storage
      .from('monthly_dumps')
      .createSignedUrl(fileName, 60 * 60); // 1 hora de validade

    return NextResponse.json({ 
      success: true, 
      message: "Dump mensal gerado com sucesso.",
      url: signedUrlData?.signedUrl || null,
      reference_month: referenceMonth
    });

  } catch (error: any) {
    console.error("Erro ao gerar dump CSV:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
