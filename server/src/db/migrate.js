// อัปเกรดโครงสร้างฐานข้อมูลที่มีอยู่แล้วให้ตรงกับโค้ดเวอร์ชันนี้ (รันอัตโนมัติตอนเซิร์ฟเวอร์เริ่ม)
// schema.sql ใช้ CREATE TABLE IF NOT EXISTS → ตารางที่สร้างไปแล้วบน Railway จะไม่ได้คอลัมน์ใหม่
// ไฟล์นี้จึงตรวจทีละคอลัมน์ ถ้ายังไม่มีค่อย ALTER TABLE (รันซ้ำกี่ครั้งก็ปลอดภัย)
import { pool } from './pool.js';

const COLUMNS = [
  // ความยินยอมนโยบายความเป็นส่วนตัว (เวอร์ชันที่ยอมรับล่าสุด + เวลา)
  ['users', 'privacy_version', 'VARCHAR(20) NULL'],
  ['users', 'privacy_accepted_at', 'DATETIME NULL'],
];

export async function migrate() {
  for (const [table, column, def] of COLUMNS) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    if (!row.n) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
      console.log(`[migrate] เพิ่มคอลัมน์ ${table}.${column}`);
    }
  }
}
