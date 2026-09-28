import { Howl, Howler } from 'howler';

// ค่าระดับเสียงเก็บไว้ในเครื่อง → คงอยู่ข้ามหน้าและข้ามรอบการเล่น
const KEY = 'eg.audio';

function readSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { volume: typeof s.volume === 'number' ? s.volume : 0.8, muted: Boolean(s.muted) };
  } catch {
    return { volume: 0.8, muted: false };
  }
}

const settings = readSettings();
Howler.volume(settings.volume);
Howler.mute(settings.muted);

export const SFX_FILES = {
  click: '/audio/click.wav',
  tap: '/audio/tap.wav',
  start: '/audio/start.wav',
  success: '/audio/success.wav',
  error: '/audio/error.wav',
  whoosh: '/audio/whoosh.wav',
  // หน้าเล่นเกม (สร้างด้วย tools/sfx/make_sfx.py)
  flip: '/audio/flip.wav',
  deal: '/audio/deal.wav',
  coin: '/audio/coin.wav',
  build: '/audio/build.wav',
  unlock: '/audio/unlock.wav',
  threat: '/audio/threat.wav',
  phase: '/audio/phase.wav',
  win: '/audio/win.wav',
  lose: '/audio/lose.wav',
  tick: '/audio/tick.wav',
  turn: '/audio/turn.wav',
};

const sounds = {};

/** สร้าง Howl หลังไฟล์ถูกโหลดเข้าแคชแล้ว (เรียกจาก preload) */
export function registerSounds() {
  for (const [name, src] of Object.entries(SFX_FILES)) {
    if (!sounds[name]) sounds[name] = new Howl({ src: [src], preload: true, volume: 0.7 });
  }
}

export function play(name) {
  try { sounds[name]?.play(); } catch { /* เสียงไม่ใช่เรื่องสำคัญ */ }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export const audioSettings = {
  get volume() { return settings.volume; },
  get muted() { return settings.muted; },
  setVolume(v) {
    settings.volume = Math.min(1, Math.max(0, Math.round(v * 10) / 10));
    Howler.volume(settings.volume);
    save();
  },
  setMuted(m) {
    settings.muted = Boolean(m);
    Howler.mute(settings.muted);
    save();
  },
};
