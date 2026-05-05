import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';
import { del } from '@vercel/blob';

// GET /api/frames/[id] - Get single frame with points
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const frames = await query('SELECT * FROM frames WHERE id = ?', [id]);
    if (frames.length === 0) {
      return NextResponse.json({ error: 'Frame tidak ditemukan' }, { status: 404 });
    }

    const points = await query('SELECT * FROM frame_points WHERE frame_id = ? ORDER BY id ASC', [id]);

    return NextResponse.json({ frame: frames[0], points });
  } catch (error) {
    console.error('Get frame error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT /api/frames/[id] - Update frame (admin only)
export async function PUT(request, { params }) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, is_active, sort_order, face_center_x, face_center_y } = body;

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
    if (face_center_x !== undefined) { updates.push('face_center_x = ?'); values.push(face_center_x); }
    if (face_center_y !== undefined) { updates.push('face_center_y = ?'); values.push(face_center_y); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diupdate' }, { status: 400 });
    }

    values.push(id);
    await query(`UPDATE frames SET ${updates.join(', ')} WHERE id = ?`, values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update frame error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/frames/[id] - Delete frame (admin only)
export async function DELETE(request, { params }) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get frame info to delete file
    const frames = await query('SELECT image_path FROM frames WHERE id = ?', [id]);
    if (frames.length > 0) {
      const imagePath = frames[0].image_path;

      if (imagePath.startsWith('http')) {
        // Production: Delete from Vercel Blob
        try {
          await del(imagePath);
        } catch (e) {
          console.error('Failed to delete blob:', e);
        }
      } else {
        // Development: Delete from local filesystem
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'public', imagePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    await query('DELETE FROM frames WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete frame error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
