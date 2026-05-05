import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';
import { put } from '@vercel/blob';

// GET /api/frames - List all active frames (public) 
export async function GET() {
  try {
    const frames = await query(
      'SELECT f.*, COUNT(fp.id) as point_count FROM frames f LEFT JOIN frame_points fp ON f.id = fp.frame_id WHERE f.is_active = 1 GROUP BY f.id ORDER BY f.sort_order ASC'
    );
    return NextResponse.json({ frames });
  } catch (error) {
    console.error('Get frames error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/frames - Create new frame (admin only)
export async function POST(request) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description') || '';
    const file = formData.get('image');

    if (!name || !file) {
      return NextResponse.json({ error: 'Nama dan gambar frame wajib diisi' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `frame_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;

    let filepath;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Production: Upload to Vercel Blob
      const blob = await put(`frames/${filename}`, buffer, {
        access: 'public',
      });
      filepath = blob.url;
    } else {
      // Development: Save to local filesystem
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'frames');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      filepath = `/uploads/frames/${filename}`;
    }

    // Get max sort_order
    const maxOrder = await query('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM frames');
    const sortOrder = maxOrder[0].max_order + 1;

    const result = await query(
      'INSERT INTO frames (name, description, image_path, sort_order) VALUES (?, ?, ?, ?)',
      [name, description, filepath, sortOrder]
    );

    return NextResponse.json({
      success: true,
      frame: { id: result.insertId, name, description, image_path: filepath, sort_order: sortOrder }
    });
  } catch (error) {
    console.error('Create frame error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
