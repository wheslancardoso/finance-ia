import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      // Verificar se usuário já existe
      const checkRes = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
      if (checkRes.rows.length > 0) {
        return NextResponse.json({ 
          msg: 'Usuário já existe',
          code: 'user_already_exists' 
        }, { status: 400 });
      }

      const res = await client.query(
        'INSERT INTO auth.users (email, encrypted_password) VALUES ($1, $2) RETURNING id, email',
        [email, hashedPassword]
      );
      
      const user = res.rows[0];

      // Gerar JWT compatível com o que o Supabase client espera
      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: 'authenticated',
          aud: 'authenticated',
        },
        JWT_SECRET,
        { expiresIn: '1y' }
      );

      return NextResponse.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 31536000,
        refresh_token: 'dummy-refresh-token',
        user: {
          id: user.id,
          email: user.email,
          aud: 'authenticated',
          role: 'authenticated',
          email_confirmed_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
