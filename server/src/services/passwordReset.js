import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { firebaseAuth } from './firebaseAdmin.js';
import { sendResetEmail } from './mailer.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** ส่งลิงก์รีเซ็ต ถ้ามีบัญชีนี้ (เงียบถ้าไม่มี — ผู้เรียกตอบข้อความเดียวกันเสมอ) */
export async function requestReset(email) {
  let user;
  try {
    user = await firebaseAuth.getUserByEmail(email);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') return;
    throw err;
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const conn = await pool.getConnection();
  try {
    // ยกเลิกลิงก์เก่าที่ยังไม่ได้ใช้ → ลิงก์ล่าสุดเท่านั้นที่ใช้ได้
    await conn.query(
      'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE firebase_uid = ? AND used_at IS NULL',
      [user.uid],
    );
    await conn.query(
      `INSERT INTO password_reset_tokens (firebase_uid, token_hash, expires_at)
       VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)`,
      [user.uid, sha256(token), config.resetTokenTtlMinutes],
    );
  } finally {
    conn.release();
  }
  const link = `${config.clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendResetEmail(user.email, link);
}

async function findValid(token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const [[row]] = await pool.query(
    `SELECT * FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
    [sha256(token)],
  );
  return row || null;
}

export async function isTokenValid(token) {
  return Boolean(await findValid(token));
}

/** ตั้งรหัสผ่านใหม่ — คืนค่า false ถ้าลิงก์หมดอายุ/ถูกใช้ไปแล้ว */
export async function resetPassword(token, newPassword) {
  const row = await findValid(token);
  if (!row) return false;
  // ล็อกให้ใช้ได้ครั้งเดียว: อัปเดตได้เฉพาะแถวที่ยังไม่ถูกใช้
  const [res] = await pool.query(
    'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL',
    [row.id],
  );
  if (res.affectedRows !== 1) return false;
  try {
    await firebaseAuth.updateUser(row.firebase_uid, { password: newPassword });
    await firebaseAuth.revokeRefreshTokens(row.firebase_uid); // ออกจากระบบทุกอุปกรณ์
  } catch (err) {
    await pool.query('UPDATE password_reset_tokens SET used_at = NULL WHERE id = ?', [row.id]);
    throw err;
  }
  return true;
}
