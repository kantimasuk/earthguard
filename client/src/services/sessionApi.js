// เรียก REST API ของรอบการเล่น (ดู server/src/routes/sessions.js)
import { api } from './api';

export const sessionApi = {
  /** เริ่มรอบใหม่ → { sessionId, difficulty, aiCount } */
  create: (difficulty) => api('/api/sessions', { method: 'POST', body: { difficulty } }),
  get: (id) => api(`/api/sessions/${id}`),
  /** ข้อสอบ ('pre' ไม่มีเฉลย, 'post' มีเฉลย+คำอธิบาย) */
  getTest: (id, phase) => api(`/api/sessions/${id}/tests/${phase}`),
  submitTest: (id, phase, body) => api(`/api/sessions/${id}/tests/${phase}`, { method: 'POST', body }),
  summary: (id) => api(`/api/sessions/${id}/summary`),
  /** ออกจากเกม → ลบรอบนี้ทั้งหมด (ไม่เก็บผล) */
  remove: (id) => api(`/api/sessions/${id}`, { method: 'DELETE' }),
};

export const DIFFICULTIES = [
  { key: 'easy', label: 'ง่าย', ai: 2, desc: 'เล่นกับ AI 2 ตัว · เหมาะกับการเริ่มต้น' },
  { key: 'medium', label: 'ปานกลาง', ai: 3, desc: 'เล่นกับ AI 3 ตัว · แย่งการ์ดกันมากขึ้น' },
  { key: 'hard', label: 'ยาก', ai: 4, desc: 'เล่นกับ AI 4 ตัว · ต้องวางแผนให้ดี' },
];

/** ข้อความ error ที่ผู้ใช้อ่านเข้าใจ */
export function sessionErrorMessage(e) {
  switch (e?.code) {
    case 'NETWORK': return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
    case 'NOT_SYNCED': return 'บัญชียังไม่พร้อม ลองออกจากระบบแล้วเข้าใหม่อีกครั้ง';
    case 'SESSION_NOT_FOUND': return 'ไม่พบรอบการเล่นนี้แล้ว';
    case 'ALREADY_SUBMITTED': return 'ส่งคำตอบชุดนี้ไปแล้ว';
    case 'GAME_NOT_FINISHED': return 'ต้องเล่นเกมให้จบก่อนทำแบบทดสอบหลังเล่น';
    case 'NOT_ENOUGH_QUESTIONS': return 'คลังข้อสอบในฐานข้อมูลยังไม่พร้อม (รัน npm run db:init ที่ server)';
    default: return 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
  }
}
