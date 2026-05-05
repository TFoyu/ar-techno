import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

// PUT /api/points/[id] - Update point (admin only)
export async function PUT(request, { params }) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { x_percent, y_percent, title, description } = await request.json();

    const updates = [];
    const values = [];

    if (x_percent !== undefined) { updates.push('x_percent = ?'); values.push(x_percent); }
    if (y_percent !== undefined) { updates.push('y_percent = ?'); values.push(y_percent); }
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diupdate' }, { status: 400 });
    }

    values.push(id);
    await query(`UPDATE frame_points SET ${updates.join(', ')} WHERE id = ?`, values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update point error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/points/[id] - Delete point (admin only)
export async function DELETE(request, { params }) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await query('DELETE FROM frame_points WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete point error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
