import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  // Log all cookies
  const cookieNames = allCookies.map(c => ({ name: c.name, valueLen: c.value?.length }));
  
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  return NextResponse.json({
    rawCookie: req.headers.get('cookie'),
    cookies: cookieNames,
    user: user ? { id: user.id, email: user.email } : null,
    authError: error?.message || null,
  });
}
