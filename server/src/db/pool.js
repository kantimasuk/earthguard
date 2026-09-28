import mysql from 'mysql2/promise';
import { config } from '../config.js';

if (!config.databaseUrl) {
  console.warn('[db] ยังไม่ได้ตั้งค่า DATABASE_URL — API ที่ใช้ฐานข้อมูลจะใช้งานไม่ได้');
}

export const pool = mysql.createPool({
  uri: config.databaseUrl || 'mysql://localhost/none',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',            // เก็บ/อ่านเวลาเป็น UTC
  charset: 'utf8mb4',
  dateStrings: false,
});
