import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { month_key, balance_cents } = body;

    if (!month_key || typeof balance_cents !== 'number') {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Upsert na tabela do Supabase
    const { data, error } = await supabase
      .from('monthly_balance_overrides')
      .upsert({
        user_id: authData.user.id,
        month_key,
        balance_cents,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, month_key' })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar override no Supabase:', error);
      return NextResponse.json({ error: 'Erro no banco' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month_key = searchParams.get('month_key');

    if (!month_key) {
      return NextResponse.json({ error: 'month_key obrigatório' }, { status: 400 });
    }

    const { error } = await supabase
      .from('monthly_balance_overrides')
      .delete()
      .match({ user_id: authData.user.id, month_key });

    if (error) {
      console.error('Erro ao remover override no Supabase:', error);
      return NextResponse.json({ error: 'Erro no banco' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
