// ============================================================
// เพลงประกอบ (วนลูปไม่มีรอยต่อ + ค่อย ๆ เปลี่ยนเพลงแบบครอสเฟด)
// ============================================================
// เพลงทั้งหมดแต่ง/สังเคราะห์เองด้วย tools/music/make_music.py → ไม่มีลิขสิทธิ์ของใคร
//   menu = ผ่อนคลาย (เมนู/ห้องรอ/แบบทดสอบ) · p1 = สดใส · p2 = ตึงเครียด · p3 = ดราม่าลุ้นระทึก
//
// ใช้ AudioContext ของตัวเอง (แยกจาก Howler)
//   เดิมใช้ร่วมกับ Howler แต่ Howler "พักเสียงอัตโนมัติ" (autoSuspend) เมื่อไม่มีเสียงเอฟเฟกต์ดังเกิน 30 วินาที
//   → เพลงเงียบหายไปด้วย จึงแยกออกมา · ระดับเสียง/ปิดเสียงในหน้าตั้งค่า ส่งมาที่นี่ผ่าน setMusicMaster()
// ไฟล์เพลงมีช่วงเผื่อหัว-ท้าย 1 วินาที → วนเฉพาะช่วง loopStart..loopStart+loopLength (ดู make_music.py)
import META from '@/data/music.json';

const KEY = 'eg.music';
const TRIM = { menu: 0.42, p1: 0.55, p2: 0.55, p3: 0.6, end: 0.6 }; // ความดังของแต่ละเพลง (เพลงเมนูเบาสุด)
const MAX_CACHE = 2;                                        // เก็บเพลงที่ถอดรหัสแล้วไว้แค่ 2 เพลง (ประหยัดหน่วยความจำมือถือ)

let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();
let ctx = null;
let bus = null;          // gain รวมของเพลง (เปิด/ปิดเพลง + ลดเสียงชั่วคราว)
let master = null;       // ระดับเสียงหลักจากหน้าตั้งค่า (เหมือนเสียงเอฟเฟกต์)
let masterLevel = 0.8;
let want = null;         // เพลงที่ควรเล่นอยู่ตอนนี้
let cur = null;          // { key, src, gain }
const buffers = new Map();
const loading = new Map();

function audio() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = masterLevel;
  master.connect(ctx.destination);
  bus = ctx.createGain();
  bus.gain.value = enabled ? 1 : 0;
  bus.connect(master);
  // เบราว์เซอร์ไม่ให้เล่นเสียงก่อนผู้ใช้แตะจอ → รอแตะครั้งแรกแล้วค่อยเริ่ม
  // (ฟังทุกครั้งที่แตะ — ถ้าระบบพักเสียงไป เช่น สลับแอปบนมือถือ แตะครั้งถัดไปก็กลับมาเล่นต่อ)
  const resume = () => {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (want && !cur) start(want);
  };
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, resume, true);
  ctx.addEventListener?.('statechange', () => { if (ctx.state === 'running' && want && !cur) start(want); });
  return ctx;
}

async function load(key) {
  if (buffers.has(key)) return buffers.get(key);
  if (loading.has(key)) return loading.get(key);
  const p = (async () => {
    const res = await fetch(META[key].file);
    const data = await res.arrayBuffer();
    const buf = await new Promise((ok, bad) => audio().decodeAudioData(data, ok, bad));
    buffers.set(key, buf);
    // เกินจำนวน → ทิ้งเพลงที่ไม่ได้เล่น/ไม่ได้ต้องการ
    for (const k of buffers.keys()) {
      if (buffers.size <= MAX_CACHE) break;
      if (k !== key && k !== cur?.key && k !== want) buffers.delete(k);
    }
    return buf;
  })().finally(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

function fadeTo(g, v, sec) {
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(v, t + Math.max(0.02, sec));
}

let starting = null; // เพลงที่กำลังโหลดเพื่อเริ่มเล่น (กันเริ่มซ้อน 2 ตัว)
async function start(key, fade = 1.6) {
  const c = audio();
  if (starting === key || cur?.key === key) return;
  starting = key;
  let buf;
  try { buf = await load(key); } catch { starting = null; return; }
  starting = null;
  if (c.state !== 'running') { c.resume().catch(() => {}); }
  if (want !== key || cur?.key === key || c.state === 'closed') return;
  const m = META[key];
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = m.loopStart;
  src.loopEnd = m.loopStart + m.loopLength;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(bus);
  src.start(0, m.loopStart);
  fadeTo(gain, TRIM[key] ?? 0.5, fade);
  stopCurrent(fade);
  cur = { key, src, gain };
}

function stopCurrent(fade) {
  if (!cur) return;
  const { src, gain } = cur;
  fadeTo(gain, 0, fade);
  setTimeout(() => { try { src.stop(); src.disconnect(); gain.disconnect(); } catch { /* ignore */ } }, fade * 1000 + 100);
  cur = null;
}

/** เปลี่ยนเพลง (เรียกซ้ำด้วยเพลงเดิมได้ ไม่มีผล) · key = null → หยุดเพลง */
export function setMusic(key, { fade = 1.6 } = {}) {
  if (key && !META[key]) return;
  want = key;
  if (!key) { if (ctx) stopCurrent(fade); return; }
  if (cur?.key === key) return;
  start(key, fade);
}

/** โหลดเพลงไว้ล่วงหน้า (เช่น เพลงช่วงถัดไป) */
export function preloadMusic(key) { if (META[key]) load(key).catch(() => {}); }

/** ลดเสียงเพลงชั่วคราว (0–1) เช่น ระหว่างฉากเปลี่ยนช่วง */
export function duckMusic(level = 0.3, sec = 0.8) {
  audio();
  fadeTo(bus, enabled ? level : 0, sec);
}
export function unduckMusic(sec = 1.2) {
  audio();
  fadeTo(bus, enabled ? 1 : 0, sec);
}

/** ระดับเสียงหลัก (0–1, ปิดเสียง = 0) — sound.js เรียกทุกครั้งที่ผู้ใช้ปรับ */
export function setMusicMaster(v) {
  masterLevel = v;
  if (master) fadeTo(master, v, 0.15);
}

export const musicSettings = {
  get on() { return enabled; },
  setOn(v) {
    enabled = Boolean(v);
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* ignore */ }
    audio();
    fadeTo(bus, enabled ? 1 : 0, 0.4);
  },
};

if (import.meta.env.DEV) window.__musicDbg = () => ({ want, cur: cur?.key, state: ctx?.state, cached: [...buffers.keys()] });
