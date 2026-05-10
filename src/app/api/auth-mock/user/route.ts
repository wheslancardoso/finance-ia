import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT id, email, created_at, updated_at FROM auth.users WHERE id = $1',
        [decoded.sub]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = res.rows[0];

      return NextResponse.json({
        id: user.id,
        email: user.email,
        aud: 'authenticated',
        role: 'authenticated',
        email_confirmed_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        created_at: user.created_at,
        updated_at: user.updated_at,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {}
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('User route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
