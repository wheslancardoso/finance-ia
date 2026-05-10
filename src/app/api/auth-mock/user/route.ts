import { NextResponse } from 'next/server';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters';

  try {
    const payload: any = jwt.verify(token, jwtSecret);
    const userId = payload.sub;

    if (!userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
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
      const result = await client.query(
        'SELECT id, email, created_at FROM auth.users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = result.rows[0];

      return NextResponse.json({
        id: user.id,
        email: user.email,
        role: 'authenticated',
        aud: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        created_at: user.created_at
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Auth Mock User Error:', error);
    return NextResponse.json({ error: 'Token verification failed' }, { status: 401 });
  }
}
