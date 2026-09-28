// เชื่อมต่อห้องเกม Single Player ผ่าน Socket.IO (เซิร์ฟเวอร์เป็นผู้ตรวจกติกาและควบคุมเกม)
import { io } from 'socket.io-client';
import { auth } from './firebase';
import { API_URL } from './api';

/**
 * @returns {Promise<import('socket.io-client').Socket>}
 */
export async function connectGameSocket() {
  const token = await auth?.currentUser?.getIdToken();
  const socket = io(API_URL || undefined, {
    auth: (cb) => {
      // ขอ token ใหม่ทุกครั้งที่ต่อใหม่ (token หมดอายุทุก 1 ชม.)
      auth?.currentUser?.getIdToken().then((t) => cb({ token: t })).catch(() => cb({ token }));
    },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 800,
  });
  return socket;
}

/** ส่ง event แบบรอคำตอบ (ack) พร้อม timeout */
export function request(socket, event, payload, timeout = 10000) {
  return new Promise((resolve) => {
    socket.timeout(timeout).emit(event, payload, (err, res) => {
      resolve(err ? { ok: false, error: 'TIMEOUT' } : res);
    });
  });
}
