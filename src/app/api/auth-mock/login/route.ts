import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Supabase client can send email/password directly or via grant_type
    const email = body.email || body.username; 
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ 
        error: 'invalid_grant',
        error_description: 'Email and password are required' 
      }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT id, email, encrypted_password FROM auth.users WHERE email = $1',
        [email]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ 
          error: 'invalid_grant',
          error_description: 'Credenciais inválidas' 
        }, { status: 401 });
      }

      const user = res.rows[0];
      
      // Supporting both hashed and plain text for legacy reasons during transition if needed
      // but the user complained about plain text, so we prioritize bcrypt.
      let isPasswordValid = false;
      try {
        isPasswordValid = await bcrypt.compare(password, user.encrypted_password);
      } catch (e) {
        // Fallback to plain text comparison only if bcrypt fails (e.g. not a hash)
        // This helps users who were already in the DB with plain text
        isPasswordValid = password === user.encrypted_password;
      }

      if (!isPasswordValid) {
        return NextResponse.json({ 
          error: 'invalid_grant',
          error_description: 'Credenciais inválidas' 
        }, { status: 401 });
      }

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
          created_at: new Date().toISOString(), // In a real app, these would come from DB
          updated_at: new Date().toISOString(),
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      error: 'server_error',
      error_description: error.message 
    }, { status: 500 });
  }
}
