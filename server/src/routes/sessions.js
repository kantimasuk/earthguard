// REST API ของรอบการเล่น: ตั้งค่าเกม → Pre-test → (เล่นเกมผ่าน Socket.IO) → Post-test → สรุปผล
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getByUid } from '../services/users.js';
import {
  createSession, getOwnedSession, getTest, submitTest, getSummary, deleteSession,
} from '../services/sessions.js';
import { destroyRoom } from '../socket/singlePlayer.js';

const router = Router();

// ทุก route ต้อง login + มีบัญชีใน MySQL แล้ว (sync ตอน login)
router.use(requireAuth, async (req, res, next) => {
  const profile = await getByUid(req.firebaseUser.uid);
  if (!profile) return res.status(403).json({ error: 'NOT_SYNCED' });
  req.userId = profile.id;
  next();
});

const phaseOf = (p) => (p === 'pre' || p === 'post' ? p : null);

// เริ่มรอบใหม่ (หน้าตั้งค่าเกม → กดเริ่ม)   body: { difficulty: 'easy' | 'medium' | 'hard' }
router.post('/', async (req, res) => {
  res.status(201).json(await createSession(req.userId, String(req.body?.difficulty || '')));
});

router.get('/:id', async (req, res) => {
  res.json(await getOwnedSession(req.params.id, req.userId));
});

// ข้อสอบ Pre/Post
router.get('/:id/tests/:phase', async (req, res) => {
  const phase = phaseOf(req.params.phase);
  if (!phase) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(await getTest(req.params.id, req.userId, phase));
});

// ส่งคำตอบ   body: { answers: [true|false|null x5], timeUsedSec, timedOut }
router.post('/:id/tests/:phase', async (req, res) => {
  const phase = phaseOf(req.params.phase);
  if (!phase) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(await submitTest(req.params.id, req.userId, phase, req.body || {}));
});

router.get('/:id/summary', async (req, res) => {
  res.json(await getSummary(req.params.id, req.userId));
});

// ออกจากเกม → ไม่เก็บอะไรของรอบนี้เลย
router.delete('/:id', async (req, res) => {
  await deleteSession(req.params.id, req.userId);
  destroyRoom(req.params.id);
  res.json({ ok: true });
});

export default router;
