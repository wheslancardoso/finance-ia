import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pg";

/**
 * GET /api/transactions?user_id=xxx&limit=100
 * Lista transações de um usuário.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "200");

  if (!userId) {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT t.*, c.name as category_name, c.type as category_type
       FROM public.transactions t
       LEFT JOIN public.categories c ON t.category_id = c.id
       WHERE t.user_id = $1
       ORDER BY t.date DESC
       LIMIT $2`,
      [userId, limit]
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/transactions
 * Cria ou atualiza uma transação (upsert).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      user_id,
      account_id,
      category_id,
      amount_cents,
      transaction_type,
      date,
      description,
      installment_current = 1,
      installment_total = 1,
      installment_group_id,
      is_paid = false,
      source = "MANUAL",
    } = body;

    if (!user_id || !amount_cents || !transaction_type || !date || !description) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando" },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO public.transactions (
        id, user_id, account_id, category_id, amount_cents, 
        transaction_type, date, description, installment_current,
        installment_total, installment_group_id, is_paid, source
      )
      VALUES (
        COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, 
        $6, $7, $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        category_id = EXCLUDED.category_id,
        amount_cents = EXCLUDED.amount_cents,
        transaction_type = EXCLUDED.transaction_type,
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        installment_current = EXCLUDED.installment_current,
        installment_total = EXCLUDED.installment_total,
        is_paid = EXCLUDED.is_paid,
        source = EXCLUDED.source,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      id || null,
      user_id,
      account_id || null,
      category_id || null,
      amount_cents,
      transaction_type,
      date,
      description,
      installment_current,
      installment_total,
      installment_group_id || null,
      is_paid,
      source,
    ]);

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error("POST /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions?id=xxx
 * Remove uma transação.
 */
export async function DELETE(request: NextRequest) {
  const txId = request.nextUrl.searchParams.get("id");
  if (!txId) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  try {
    await pool.query(`DELETE FROM public.transactions WHERE id = $1`, [txId]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
