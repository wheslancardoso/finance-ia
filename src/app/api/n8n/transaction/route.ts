import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");

  if (apiKey !== process.env.N8N_API_KEY && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      familyGroupId, 
      accountId, 
      categoryId, 
      amountCents, 
      description, 
      type = "EXPENSE",
      isLegacyDebt = false
    } = body;

    if (!familyGroupId || !accountId || !amountCents || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        family_group_id: familyGroupId,
        account_id: accountId,
        category_id: categoryId || null, // Optional
        amount_cents: amountCents,
        transaction_type: type,
        date: new Date().toISOString(),
        description: description,
        source: "N8N_WHATSAPP",
        is_legacy_debt: isLegacyDebt
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, transaction: data }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
