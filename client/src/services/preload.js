import { SFX_FILES, registerSounds } from './sound';
import MODE_ART from '@/data/modeArt.json';
import { CARD_IMAGE_URLS } from '@/game/cardImages';

/**
 * โหลดทรัพยากรก่อนเข้าเกม และรายงานเปอร์เซ็นต์จริง
 * แต่ละงานมีน้ำหนัก (weight) — ไฟล์ที่ fetch ได้จะรายงานความคืบหน้าตามจำนวน byte ที่โหลดแล้ว
 */
async function fetchWithProgress(url, onFraction) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok || !res.body) { onFraction(1); return; }
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    if (total) onFraction(Math.min(1, loaded / total));
  }
  onFraction(1);
}

function buildTasks(extraTasks) {
  const tasks = [];
  // ฟอนต์ภาษาไทย
  for (const spec of ['400 1em Kodchasan', '500 1em Kodchasan', '600 1em Kodchasan', '700 1em Kodchasan']) {
    tasks.push({ weight: 3, run: () => document.fonts?.load(spec, 'กขค EarthGuard') });
  }
  // เสียง
  for (const src of Object.values(SFX_FILES)) {
    tasks.push({ weight: 2, run: (p) => fetchWithProgress(src, p) });
  }
  // รูปภาพ
  const modeArt = Object.values(MODE_ART).flatMap((a) => [a.base, ...a.parts.flatMap((p) => [p.href, p.cover?.href].filter(Boolean))]);
  // รูปการ์ดของทีม (ถ้ามี) โหลดเก็บแคชไว้ก่อน → เข้าเกมได้เร็ว
  for (const src of Object.values(CARD_IMAGE_URLS)) {
    tasks.push({ weight: 1, run: (p) => fetchWithProgress(src, p) });
  }
  for (const src of ['/images/avatar-default.svg', ...modeArt.map((f) => '/images/modes/' + f)]) {
    tasks.push({ weight: 1, run: (p) => fetchWithProgress(src, p) });
  }
  return tasks.concat(extraTasks);
}

/**
 * @param {(percent:number)=>void} onProgress 0–100
 * @param {Array<{weight:number, run:(p:(f:number)=>void)=>Promise<any>}>} extraTasks
 */
export async function preloadAll(onProgress, extraTasks = []) {
  const tasks = buildTasks(extraTasks);
  const totalWeight = tasks.reduce((s, t) => s + t.weight, 0);
  const fractions = tasks.map(() => 0);
  const report = () => {
    const done = tasks.reduce((s, t, i) => s + t.weight * fractions[i], 0);
    onProgress(Math.round((done / totalWeight) * 100));
  };
  await Promise.all(
    tasks.map(async (t, i) => {
      const setFraction = (f) => { fractions[i] = Math.max(fractions[i], f); report(); };
      try { await t.run(setFraction); } catch (e) { console.warn('[preload]', e); }
      setFraction(1);
    }),
  );
  registerSounds();
}
