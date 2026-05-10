import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Cria um cliente Supabase para uso no lado do servidor (Server Components, Server Actions, API Routes).
 * Esta versão é assíncrona para facilitar o uso do helper `cookies()` do Next.js.
 */
export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // O método `setAll` foi chamado de um Server Component.
            // Isso pode ser ignorado se você tiver um middleware atualizando a sessão.
          }
        },
      },
    }
  );
};

/**
 * Cria um cliente administrativo com permissões totais.
 * Use APENAS no lado do servidor e com extrema cautela.
 */
export const createAdminClient = async () => {
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!adminKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined");
  }

  return createServerClient(
    supabaseUrl!,
    adminKey,
    {
      cookies: {
        getAll() { return [] },
        setAll() {}
      },
    }
  );
};
