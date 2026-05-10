import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pg";

export const dynamic = 'force-dynamic';

/**
 * GET /api/accounts?user_id=xxx
 * Lista todas as contas de um usuário.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.accounts WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/accounts
 * Cria ou atualiza uma conta (upsert).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      user_id,
      name,
      type,
      balance_cents = 0,
      credit_limit_cents = 0,
      closing_day,
      due_day,
      color_hex = "#7C3AED",
    } = body;

    if (!user_id || !name || !type) {
      return NextResponse.json(
        { error: "user_id, name e type são obrigatórios" },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO public.accounts (id, user_id, name, type, balance_cents, credit_limit_cents, closing_day, due_day, color_hex)
      VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        balance_cents = EXCLUDED.balance_cents,
        credit_limit_cents = EXCLUDED.credit_limit_cents,
        closing_day = EXCLUDED.closing_day,
        due_day = EXCLUDED.due_day,
        color_hex = EXCLUDED.color_hex,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      id || null,
      user_id,
      name,
      type,
      balance_cents,
      credit_limit_cents,
      closing_day || null,
      due_day || null,
      color_hex,
    ]);

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/accounts?id=xxx
 * Desativa uma conta (soft delete).
 */
export async function DELETE(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("id");
  if (!accountId) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  try {
    await pool.query(
      `DELETE FROM public.accounts WHERE id = $1`,
      [accountId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/accounts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
