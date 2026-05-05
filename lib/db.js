import mysql from 'mysql2/promise';

let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ar_photobooth',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      // Enable SSL for cloud databases (Aiven, PlanetScale, etc.)
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export default { getPool, query };
