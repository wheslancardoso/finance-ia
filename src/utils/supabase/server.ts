import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = async () => {
  const cookieStore = await cookies();
  
  const supabaseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  
  const allCookies = cookieStore.getAll();
  console.log(`[SSR SUPABASE] Found ${allCookies.length} cookies. url: ${supabaseUrl}`);
  const sbCookies = allCookies.filter(c => c.name.includes('sb-'));
  console.log(`[SSR SUPABASE] Auth cookies:`, sbCookies.map(c => c.name));

  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    },
  );
};
