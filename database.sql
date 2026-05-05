-- AR Photo Booth Database Schema
-- Run this in MySQL (phpMyAdmin or CLI)

CREATE DATABASE IF NOT EXISTS ar_photobooth
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ar_photobooth;

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Frames table
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
) ENGINE=InnoDB;

-- Frame points (interactive history points)
CREATE TABLE IF NOT EXISTS frame_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  frame_id INT NOT NULL,
  x_percent DECIMAL(5,2) NOT NULL,
  y_percent DECIMAL(5,2) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (frame_id) REFERENCES frames(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Insert default admin (password: admin123)
-- Password hash for 'admin123' using bcryptjs
INSERT INTO admin_users (username, password) VALUES
('admin', '$2b$10$99f9OwlqtF700NSrJAgykO5qzr2bWOec/4hAGmLEycTJZSrpTBLXW');

-- Insert seed frames
INSERT INTO frames (name, description, image_path, face_center_x, face_center_y, is_active, sort_order) VALUES
('Kafe Merah Putih - Classic', 'Frame bertema sejarah kemerdekaan Indonesia dengan nuansa kafe Merah Putih', '/uploads/frames/Frame1.png', 50.00, 42.00, 1, 1),
('Kafe Merah Putih - Heritage', 'Frame bergaya heritage dengan elemen sejarah perjuangan bangsa', '/uploads/frames/Frame2.png', 50.00, 42.00, 1, 2),
('Kafe Merah Putih - Patriotic', 'Frame patriotik dengan simbol kemerdekaan dan semangat nusantara', '/uploads/frames/Frame3.png', 50.00, 42.00, 1, 3);
