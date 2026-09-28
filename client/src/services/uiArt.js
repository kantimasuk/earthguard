// รูปตกแต่ง UI ของทีม (ไม่บังคับ) — วางไฟล์ไว้ที่ client/src/assets/ui/ แล้วระบบใช้อัตโนมัติ
// ไม่มีไฟล์ไหน → ใช้หน้าตาเดิมที่วาดด้วยโค้ดแทน (เกมไม่พัง)
// รายชื่อไฟล์ทั้งหมดดูที่ client/src/assets/ui/README.md
import { reactive } from 'vue';

const files = import.meta.glob('../assets/ui/*.{png,jpg,jpeg,webp,gif}', { eager: true, query: '?url', import: 'default' });

/** ชื่อไฟล์ (ไม่มีนามสกุล) → URL  เช่น UI['ai-leaf'] */
export const UI = Object.fromEntries(
  Object.entries(files).map(([p, url]) => [p.split('/').pop().replace(/\.[^.]+$/, ''), url]),
);

export const uiImg = (name) => UI[name] || null;

/** โหลดรูปล่วงหน้า (เช่น ภาพประกาศช่วง) ให้ขึ้นทันทีไม่กระตุก */
export function preloadUi(names) {
  return Promise.all(names.map((n) => {
    const url = UI[n];
    if (!url) return null;
    const img = new Image();
    img.src = url;
    return img.decode().then(() => img).catch(() => null);
  }));
}

/**
 * พื้นหลังของหน้าเกม (SceneBackground อ่านค่านี้)
 *   null = พื้นหลังปกติของแอป · 'game' = เริ่มเกม · 'phase2' / 'phase3' = ช่วงที่ 2 / 3
 */
export const sceneBg = reactive({ key: null });
