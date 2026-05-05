import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

// GET /api/frames/all - List ALL frames including inactive (admin only)
export async function GET() {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const frames = await query(
      'SELECT f.*, COUNT(fp.id) as point_count FROM frames f LEFT JOIN frame_points fp ON f.id = fp.frame_id GROUP BY f.id ORDER BY f.sort_order ASC'
    );
    return NextResponse.json({ frames });
  } catch (error) {
    console.error('Get all frames error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
