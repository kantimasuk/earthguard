// รูปการ์ดของทีม (ไม่บังคับ) — ถ้ามีไฟล์จะใช้แทนการ์ดที่วาดด้วยโค้ด ถ้าไม่มีก็ใช้แบบวาดเหมือนเดิม
//
// วางไฟล์ไว้ที่  client/src/assets/cards/
//   ชื่อไฟล์ = รหัสแบบการ์ด (design) เช่น R-AIR-A.webp, A-INF-1-A.png, T-HEAT.jpg, E-TIP.webp
//          หรือรหัสการ์ดรายใบ (code) เช่น A-INF-1-03.webp  (ใช้เมื่ออยากให้แต่ละใบต่างกัน — มีสิทธิ์ก่อน design)
//   หลังการ์ด = back.webp
// รายชื่อทั้งหมดดูที่ client/src/assets/cards/README.md
//
// ใช้ import.meta.glob ของ Vite: ตอน build Vite จะรู้เองว่ามีไฟล์อะไรบ้าง (ไม่ต้องแก้โค้ดเมื่อเพิ่ม/ลบรูป)
// และบีบอัด/ตั้งชื่อไฟล์ให้แคชได้ถูกต้อง

const files = import.meta.glob('../assets/cards/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });

/** ชื่อไฟล์ (ไม่มีนามสกุล) → URL */
export const CARD_IMAGE_URLS = Object.fromEntries(
  Object.entries(files).map(([p, url]) => [p.split('/').pop().replace(/\.[^.]+$/, ''), url]),
);

export const hasCardImages = Object.keys(CARD_IMAGE_URLS).length > 0;

let loading = null;

/** โหลดรูปทั้งหมดให้พร้อมก่อนวาดลง Phaser → Map(ชื่อ → HTMLImageElement) */
export function loadCardImages() {
  if (loading) return loading;
  loading = Promise.all(
    Object.entries(CARD_IMAGE_URLS).map(async ([name, url]) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      try {
        await img.decode();
        return [name, img];
      } catch {
        console.warn('[card image] โหลดไม่ได้:', url);
        return null;
      }
    }),
  ).then((list) => new Map(list.filter(Boolean)));
  return loading;
}
