/**
 * เข้าโหมดเกม: เต็มจอ + ล็อกแนวนอน
 * ต้องเรียกจาก user gesture (เช่น ตอนแตะ "แตะเพื่อเริ่ม")
 * - Android Chrome: ได้ทั้งเต็มจอและล็อกแนวนอน
 * - iPhone / iPad Safari: ไม่รองรับทั้งคู่ → ใช้หน้า "กรุณาหมุนจอ" (RotateOverlay) แทน
 */
/** เป็นโทรศัพท์/แท็บเล็ตหรือไม่ (จอสัมผัส + ด้านสั้นของจอไม่เกิน 1100px) — คอมพิวเตอร์จะไม่ถูกบังคับ */
export function isPhone() {
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return window.matchMedia('(any-pointer: coarse)').matches && shortSide <= 1100;
}

export async function enterGameMode() {
  if (!isPhone()) return; // จอใหญ่ไม่ต้องเต็มจอ/ล็อกแนว
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch { /* ไม่รองรับ */ }
  try {
    await screen.orientation?.lock?.('landscape');
  } catch { /* ไม่รองรับ หรือไม่ได้อยู่ในโหมดเต็มจอ */ }
}

export const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

/**
 * ระดับประสิทธิภาพของเครื่อง (ใช้ลดภาระการวาด โดยไม่เปลี่ยนกติกาหรือจังหวะเกม)
 * - lite: Android หรือเครื่องสเปกต่ำ → ปิดเบลอกระจก (backdrop-filter) + แอนิเมชันตกแต่งที่วนตลอด
 * - low : RAM ≤ 4GB หรือ CPU ≤ 4 คอร์ → ลดความละเอียดการวาดของโต๊ะเกมลงอีก
 */
export const perf = (() => {
  if (typeof window === 'undefined') return { lite: false, low: false };
  const ua = navigator.userAgent || '';
  const android = /Android/i.test(ua);
  const mem = navigator.deviceMemory || 8;      // Chrome เท่านั้น (Safari ไม่มี → ถือว่าแรง)
  const cores = navigator.hardwareConcurrency || 8;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const low = coarse && (mem <= 4 || cores <= 4);
  return { lite: android || low, low, android };
})();

/** ความละเอียดสูงสุดของ canvas เกม (devicePixelRatio) */
export const maxDpr = () => (perf.low ? 1.75 : perf.lite ? 2 : 3);
