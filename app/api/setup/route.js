import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

export async function GET() {
  const results = [];

  try {
    // Connect using environment variables
    const connectionConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    };

    // Add SSL for cloud databases
    if (process.env.DB_SSL === 'true') {
      connectionConfig.ssl = { rejectUnauthorized: false };
    }

    const connection = await mysql.createConnection(connectionConfig);

    results.push('✅ Connected to MySQL');

    // Create database
    const dbName = process.env.DB_NAME || 'ar_photobooth';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    results.push(`✅ Database ${dbName} created`);

    // Use database
    await connection.changeUser({ database: dbName });

    // Create admin_users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    results.push('✅ Table admin_users created');

    // Create frames table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS frames (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        image_path VARCHAR(255) NOT NULL,
        face_center_x DECIMAL(5,2) DEFAULT 50.00,
        face_center_y DECIMAL(5,2) DEFAULT 42.00,
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    results.push('✅ Table frames created');

    // Migration: Add face_center columns if they don't exist
    try {
      await connection.execute('ALTER TABLE frames ADD COLUMN face_center_x DECIMAL(5,2) DEFAULT 50.00 AFTER image_path');
      await connection.execute('ALTER TABLE frames ADD COLUMN face_center_y DECIMAL(5,2) DEFAULT 42.00 AFTER face_center_x');
      results.push('✅ Migration: face_center columns added');
    } catch {
      // Columns already exist, ignore
    }

    // Create frame_points table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS frame_points (
        id INT AUTO_INCREMENT PRIMARY KEY,
        frame_id INT NOT NULL,
        x_percent DECIMAL(5,2) NOT NULL,
        y_percent DECIMAL(5,2) NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (frame_id) REFERENCES frames(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    results.push('✅ Table frame_points created');

    // Check if admin exists
    const [admins] = await connection.execute('SELECT id FROM admin_users WHERE username = ?', ['admin']);
    if (admins.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await connection.execute('INSERT INTO admin_users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
      results.push('✅ Admin user created (admin / admin123)');
    } else {
      results.push('ℹ️ Admin user already exists');
    }

    // Check if seed frames exist
    const [existingFrames] = await connection.execute('SELECT COUNT(*) as count FROM frames');
    if (existingFrames[0].count === 0) {
      await connection.execute(`
        INSERT INTO frames (name, description, image_path, is_active, sort_order) VALUES
        ('Kafe Merah Putih - Classic', 'Frame bertema sejarah kemerdekaan Indonesia dengan nuansa kafe Merah Putih', '/uploads/frames/Frame1.png', 1, 1),
        ('Kafe Merah Putih - Heritage', 'Frame bergaya heritage dengan elemen sejarah perjuangan bangsa', '/uploads/frames/Frame2.png', 1, 2),
        ('Kafe Merah Putih - Patriotic', 'Frame patriotik dengan simbol kemerdekaan dan semangat nusantara', '/uploads/frames/Frame3.png', 1, 3)
      `);
      results.push('✅ Seed frames inserted (3 frames)');
    } else {
      results.push(`ℹ️ Frames already exist (${existingFrames[0].count} frames)`);
    }

    await connection.end();
    results.push('');
    results.push('🎉 Setup complete! Sistem siap digunakan.');

    return NextResponse.json({ success: true, results });
  } catch (error) {
    results.push(`❌ Error: ${error.message}`);
    return NextResponse.json({ success: false, results, error: error.message }, { status: 500 });
  }
}
