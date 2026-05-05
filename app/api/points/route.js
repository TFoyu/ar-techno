import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

// GET /api/points?frame_id=X - Get points for a frame
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const frameId = searchParams.get('frame_id');

    if (!frameId) {
      return NextResponse.json({ error: 'frame_id wajib diisi' }, { status: 400 });
    }

    const points = await query(
      'SELECT * FROM frame_points WHERE frame_id = ? ORDER BY id ASC',
      [frameId]
    );

    return NextResponse.json({ points });
  } catch (error) {
    console.error('Get points error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/points - Create new point (admin only)
export async function POST(request) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { frame_id, x_percent, y_percent, title, description } = await request.json();

    if (!frame_id || x_percent === undefined || y_percent === undefined || !title || !description) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
    }

    const result = await query(
      'INSERT INTO frame_points (frame_id, x_percent, y_percent, title, description) VALUES (?, ?, ?, ?, ?)',
      [frame_id, x_percent, y_percent, title, description]
    );

    return NextResponse.json({
      success: true,
      point: { id: result.insertId, frame_id, x_percent, y_percent, title, description }
    });
  } catch (error) {
    console.error('Create point error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
