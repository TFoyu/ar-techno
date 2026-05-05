import { cookies } from 'next/headers';
import { query } from './db';
import bcrypt from 'bcryptjs';

const SESSION_COOKIE = 'ar_admin_session';

export async function login(username, password) {
  const users = await query('SELECT * FROM admin_users WHERE username = ?', [username]);
  if (users.length === 0) return null;

  const user = users[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  // Create a simple session token
  const token = Buffer.from(`${user.id}:${Date.now()}:${Math.random()}`).toString('base64');

  return { id: user.id, username: user.username, token };
}

export async function setSessionCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  return session?.value || null;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}
