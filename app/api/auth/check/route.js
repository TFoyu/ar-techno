import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await isAuthenticated();
    return NextResponse.json({ authenticated: auth });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}
