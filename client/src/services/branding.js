import { reactive } from 'vue';

/**
 * รูปพื้นหลัง / โลโก้ของทีม — วางไฟล์ใน client/public/images/ แล้วระบบจะใช้อัตโนมัติ
 *   พื้นหลัง: background.webp | background.jpg | background.png
 *   โลโก้:    logo.svg | logo.webp | logo.png
 * ถ้าไม่มีไฟล์ จะใช้พื้นหลัง/โลโก้เริ่มต้นที่วาดด้วย SVG
 */
const CANDIDATES = {
  background: ['/images/background.webp', '/images/background.jpg', '/images/background.png'],
  logo: ['/images/logo.svg', '/images/logo.webp', '/images/logo.png'],
};

export const branding = reactive({ background: null, logo: null });

// dev server และ Vercel ตอบ index.html (status 200) เมื่อไม่พบไฟล์ → ต้องเช็กว่าเป็นรูปจริง
async function findImage(urls) {
  for (const url of urls) {
    try {
      // no-cache: ถามเซิร์ฟเวอร์ใหม่ทุกครั้ง — กันกรณีเคยเปิดเว็บก่อนวางรูป แล้วเบราว์เซอร์จำ "ไม่มีไฟล์" ไว้
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) continue;
      await res.blob(); // ให้ไฟล์อยู่ในแคช → แสดงผลทันทีไม่กระพริบ
      return url;
    } catch { /* ลองไฟล์ถัดไป */ }
  }
  return null;
}

/** เรียกครั้งเดียวก่อน mount แอป (ใช้เวลาไม่กี่มิลลิวินาทีเมื่อไม่มีไฟล์) */
export async function detectBranding() {
  const [background, logo] = await Promise.all([findImage(CANDIDATES.background), findImage(CANDIDATES.logo)]);
  branding.background = background;
  branding.logo = logo;
}
