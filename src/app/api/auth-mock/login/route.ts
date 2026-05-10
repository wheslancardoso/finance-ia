import { NextResponse } from 'next/server';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    });

    await client.connect();

    try {
      // 1. Find user
      const result = await client.query(
        'SELECT id, email, encrypted_password FROM auth.users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const user = result.rows[0];

      // 2. Verify password with pgcrypto
      const verifyResult = await client.query(
        'SELECT ($1 = crypt($2, $3)) as is_valid',
        [user.encrypted_password, password, user.encrypted_password]
      );

      if (!verifyResult.rows[0].is_valid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // 3. Generate JWT for PostgREST
      const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters';
      
      const payload = {
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        sub: user.id,
        email: user.email,
        role: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
      };

      const token = jwt.sign(payload, jwtSecret);

      // Retornar no formato que o Supabase GoTrue espera
      return NextResponse.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: user.id,
          email: user.email,
          role: 'authenticated',
          aud: 'authenticated',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          created_at: new Date().toISOString(),
        }
      });
    } finally {
      await client.end();
    }
  } catch (error: any) {
    console.error('Auth Mock Login Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
