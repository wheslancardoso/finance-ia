import { Page } from '@playwright/test';

/**
 * Simula uma sessão ativa do Supabase Auth para o Playwright.
 * Isso satisfaz tanto o Middleware (via cookie) quanto o SDK no Cliente (via localStorage/Mocks).
 */
export async function setupAuthMock(page: Page, user: { id: string; email?: string }) {
  const projectRef = 'cydoupnzyucrenuteiwj';
  const cookieName = `sb-${projectRef}-auth-token`;
  
  // 1. Mock do Cookie apenas para o Middleware (Bypass)
  await page.context().addCookies([
    {
      name: 'sb-mock-user-id',
      value: user.id,
      url: 'http://localhost:3000',
    }
  ]);

  // 2. Mock ultra-realista das chamadas de API de Autenticação do Supabase
  await page.route('**/auth/v1/**', async (route) => {
    const session = {
      access_token: 'mock-token-' + Math.random(),
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh',
      user: {
        id: user.id,
        email: user.email || 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: {},
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
      },
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    });
  });

  // 3. Mock do LocalStorage para o cliente JS não tentar deslogar
  await page.addInitScript(({ id, email, projectRef }) => {
    const session = {
      access_token: 'mock-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh',
      user: { 
        id, 
        email,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    window.localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(session));
  }, { id: user.id, email: user.email || 'test@example.com', projectRef });
}
