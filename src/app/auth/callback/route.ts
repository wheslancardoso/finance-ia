import { NextResponse } from "next/server";
// O cliente server-side é necessário aqui
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Se "next" estiver presente, use-o como a URL de redirecionamento após o login
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host"); // Host original (ex: vercel.app)
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // Em desenvolvimento, podemos redirecionar diretamente
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Redirecionar para uma página de erro se algo falhar
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
