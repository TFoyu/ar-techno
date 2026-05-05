import { NextResponse } from 'next/server';
import { login, setSessionCookie, clearSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = await login(username, password);
    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    await setSessionCookie(user.token);

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
