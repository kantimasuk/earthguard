import { pool } from '../db/pool.js';
import { firebaseAuth } from './firebaseAdmin.js';
import { cleanDisplayName } from '../utils/validation.js';

function toProfile(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    providers: row.auth_providers ? row.auth_providers.split(',') : [],
  };
}

/**
 * สร้าง/อัปเดตผู้ใช้ใน MySQL จาก Firebase token
 * - เจอ uid เดิม → อัปเดต
 * - ไม่เจอ uid แต่เจออีเมลเดิม → ผูกเข้าบัญชีเดิม (ไม่สร้างใหม่)
 * - ไม่เจอเลย → สร้างใหม่
 */
export async function upsertFromToken(decoded, requestedName) {
  const uid = decoded.uid;
  const email = String(decoded.email || '').toLowerCase();
  if (!email) throw Object.assign(new Error('NO_EMAIL'), { status: 400 });

  const fbUser = await firebaseAuth.getUser(uid);
  const providers = fbUser.providerData.map((p) => p.providerId).sort().join(',');
  const photo = fbUser.photoURL || decoded.picture || null;
  const name = cleanDisplayName(requestedName) || null;

  const [[byUid]] = await pool.query('SELECT * FROM users WHERE firebase_uid = ?', [uid]);
  let row = byUid;
  if (!row) {
    const [[byEmail]] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    row = byEmail;
    if (row) await pool.query('UPDATE users SET firebase_uid = ? WHERE id = ?', [uid, row.id]);
  }

  if (row) {
    await pool.query(
      `UPDATE users SET auth_providers = ?, photo_url = COALESCE(?, photo_url),
         display_name = COALESCE(?, display_name), last_login_at = UTC_TIMESTAMP() WHERE id = ?`,
      [providers, photo, name, row.id],
    );
    if (name && fbUser.displayName !== name) await firebaseAuth.updateUser(uid, { displayName: name });
  } else {
    const displayName = name || cleanDisplayName(fbUser.displayName) || email.split('@')[0].slice(0, 20);
    await pool.query(
      `INSERT INTO users (firebase_uid, email, display_name, photo_url, auth_providers, last_login_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [uid, email, displayName, photo, providers],
    );
  }
  const [[fresh]] = await pool.query('SELECT * FROM users WHERE firebase_uid = ?', [uid]);
  return toProfile(fresh);
}

export async function getByUid(uid) {
  const [[row]] = await pool.query('SELECT * FROM users WHERE firebase_uid = ?', [uid]);
  return row ? toProfile(row) : null;
}
