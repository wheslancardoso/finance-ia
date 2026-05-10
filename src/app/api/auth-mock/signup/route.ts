import { NextResponse } from 'next/server';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    });

    await client.connect();

    try {
      // 1. Insert user with hashed password using pgcrypto
      const result = await client.query(
        'INSERT INTO auth.users (email, encrypted_password) VALUES ($1, crypt($2, gen_salt(\'bf\'))) RETURNING id',
        [email, password]
      );

      const user = result.rows[0];

      // 2. Generate JWT for PostgREST
      const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters';
      
      const payload = {
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        sub: user.id,
        email: email,
        role: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
      };

      const token = jwt.sign(payload, jwtSecret);

      return NextResponse.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: { 
          id: user.id, 
          email: email,
          role: 'authenticated',
          aud: 'authenticated',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          created_at: new Date().toISOString()
        }
      });
    } finally {
      await client.end();
    }
  } catch (error: any) {
    console.error('Auth Mock Signup Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
