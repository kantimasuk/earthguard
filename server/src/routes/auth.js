import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { upsertFromToken, getByUid, acceptPrivacy } from '../services/users.js';

const router = Router();

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

// ยอมรับนโยบายความเป็นส่วนตัว (เก็บเวอร์ชัน + เวลา เป็นหลักฐานความยินยอมตาม PDPA)
router.post('/privacy-consent', requireAuth, async (req, res) => {
  const version = String(req.body?.version || '');
  if (!/^[\w.-]{1,20}$/.test(version)) return res.status(400).json({ error: 'BAD_VERSION' });
  const profile = await acceptPrivacy(req.firebaseUser.uid, version);
  if (!profile) return res.status(404).json({ error: 'NOT_SYNCED' });
  res.json({ profile });
});

// ลืมรหัสผ่าน / ตั้งรหัสใหม่: ใช้อีเมลรีเซ็ตของ Firebase Authentication โดยตรงจากฝั่งเว็บ
// (เดิมส่งอีเมลจากเซิร์ฟเวอร์ด้วย SMTP แต่ Railway แพ็กเกจ Hobby ปิดพอร์ต SMTP อีเมลจึงไม่ถูกส่งออก)

export default router;
