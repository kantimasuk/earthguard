import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { upsertFromToken, getByUid } from '../services/users.js';
import { requestReset, isTokenValid, resetPassword } from '../services/passwordReset.js';
import { isValidEmail, isValidPassword } from '../utils/validation.js';

const router = Router();

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
});

// เรียกหลัง login/register ทุกครั้ง เพื่อสร้าง/ผูกผู้ใช้ใน MySQL
router.post('/sync', requireAuth, async (req, res) => {
  const profile = await upsertFromToken(req.firebaseUser, req.body?.displayName);
  res.json({ profile });
});

router.get('/me', requireAuth, async (req, res) => {
  const profile = await getByUid(req.firebaseUser.uid);
  if (!profile) return res.status(404).json({ error: 'NOT_SYNCED' });
  res.json({ profile });
});

// ลืมรหัสผ่าน — ตอบข้อความเดียวกันเสมอ ไม่ว่าจะมีอีเมลนี้หรือไม่
const SAME_MESSAGE = { message: 'ถ้ามีบัญชีนี้ ระบบได้ส่งลิงก์ไปแล้ว' };
router.post('/forgot-password', resetLimiter, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  res.json(SAME_MESSAGE);
  // ทำงานหลังตอบกลับ → เวลาตอบสนองเท่ากัน เดาไม่ได้ว่ามีบัญชีหรือไม่
  requestReset(email).catch((err) => console.error('[forgot-password]', err));
});

router.get('/reset-password/verify', async (req, res) => {
  res.json({ valid: await isTokenValid(req.query.token) });
});

router.post('/reset-password', resetLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (!isValidPassword(password)) return res.status(400).json({ error: 'WEAK_PASSWORD' });
  const ok = await resetPassword(token, password);
  if (!ok) return res.status(400).json({ error: 'INVALID_OR_EXPIRED' });
  res.json({ ok: true });
});

export default router;
