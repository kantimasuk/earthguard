// Socket.IO: เชื่อมผู้เล่นเข้ากับห้องเกม Single Player (เซิร์ฟเวอร์เป็นผู้ตรวจกติกาทั้งหมด)
//
// client → server
//   sp:join   { sessionId }         ack { ok, catalog, me, snapshot }  (เข้าใหม่หรือกลับเข้าห้องเดิม)
//   sp:action { type, ... }         ack { ok, error? }
//   sp:ready  { seq }               เล่นแอนิเมชันของอัปเดต seq เสร็จแล้ว
//   sp:speed  { fast }              เปิด/ปิด "AI เล่นเร็ว"
// server → client
//   sp:update { seq, events, view, serverNow }
//   sp:intent { player, action, delay }     AI กำลังจะทำอะไร (ไฮไลต์ค้างไว้)
//   sp:timer  { deadline, duration, stage } เริ่มนับเวลาตัดสินใจของผู้เล่น
//   sp:saved  { ok }                        บันทึกผลเกมลงฐานข้อมูลแล้ว

import { engine, clientCatalog } from '../game/index.js';
import { SinglePlayerRoom } from '../game/room.js';
import { newSeed } from '../game/engine/index.js';
import { getByUid } from '../services/users.js';
import { getOwnedSession, saveGameResult } from '../services/sessions.js';

const rooms = new Map(); // sessionId → { room, socket, userId, idleTimer }
const IDLE_MS = 3 * 60 * 1000; // หลุดการเชื่อมต่อเกิน 3 นาที → ปิดห้อง

export function destroyRoom(sessionId) {
  const entry = rooms.get(sessionId);
  if (!entry) return;
  entry.room.destroy();
  clearTimeout(entry.idleTimer);
  rooms.delete(sessionId);
}

export function registerSinglePlayer(socket) {
  let entry = null;
  const reply = (cb, data) => typeof cb === 'function' && cb(data);

  socket.on('sp:join', async (payload, cb) => {
    try {
      const sessionId = String(payload?.sessionId || '');
      const user = await getByUid(socket.data.user.uid);
      if (!user) return reply(cb, { ok: false, error: 'NOT_SYNCED' });
      const session = await getOwnedSession(sessionId, user.id);
      if (session.status !== 'in_progress') return reply(cb, { ok: false, error: 'SESSION_CLOSED' });
      if (session.gameFinished) return reply(cb, { ok: false, error: 'GAME_FINISHED' });
      if (!session.preDone) return reply(cb, { ok: false, error: 'PRETEST_REQUIRED' });

      entry = rooms.get(sessionId);
      let isNew = false;
      if (entry && entry.userId === user.id) {
        clearTimeout(entry.idleTimer);
        entry.socket = socket; // กลับเข้าห้องเดิม (เช่น รีเฟรชหน้า)
      } else {
        isNew = true;
        entry = { socket, userId: user.id, idleTimer: null, room: null };
        entry.room = new SinglePlayerRoom({
          engine,
          sessionId,
          human: { id: 'me', name: user.displayName, avatar: user.photoUrl || null },
          aiCount: session.aiCount,
          seed: newSeed(),
          emit: (type, data) => entry.socket?.emit(type, data),
          onEnd: async (summary) => {
            await saveGameResult(sessionId, user.id, summary);
            // เก็บห้องไว้อีกสักพักเผื่อ client ยังเล่นแอนิเมชันจบเกมอยู่ แล้วค่อยปิด
            setTimeout(() => destroyRoom(sessionId), 60 * 1000);
          },
        });
        rooms.set(sessionId, entry);
      }
      reply(cb, {
        ok: true,
        me: 'me',
        catalog: clientCatalog,
        snapshot: isNew ? null : entry.room.snapshot(),
      });
      if (isNew) entry.room.start(); // ส่ง sp:update แรก (สับการ์ด + แจกกองกลาง)
    } catch (e) {
      reply(cb, { ok: false, error: e.status ? e.message : 'SERVER_ERROR' });
      if (!e.status) console.error('[sp:join]', e);
    }
  });

  socket.on('sp:action', (action, cb) => {
    if (!entry || entry.socket !== socket) return reply(cb, { ok: false, error: 'NOT_IN_GAME' });
    reply(cb, entry.room.handleAction(action));
  });

  socket.on('sp:ready', (p) => {
    if (entry && entry.socket === socket) entry.room.ready(Number(p?.seq) || 0);
  });

  socket.on('sp:speed', (p) => {
    if (entry && entry.socket === socket) entry.room.setFast(Boolean(p?.fast));
  });

  socket.on('disconnect', () => {
    if (!entry || entry.socket !== socket) return;
    entry.socket = null;
    const sessionId = entry.room.sessionId;
    const e = entry;
    e.idleTimer = setTimeout(() => {
      if (rooms.get(sessionId) === e && !e.socket) destroyRoom(sessionId);
    }, IDLE_MS);
  });
}
