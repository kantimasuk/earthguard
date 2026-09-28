// ตัวสุ่มแบบกำหนด seed ได้ (mulberry32)
// - ใช้ seed เดียวกัน → ผลสุ่มเหมือนเดิมทุกครั้ง → ทดสอบ/ย้อนดูเกมได้
// - เก็บสถานะเป็นตัวเลขตัวเดียวใน state.rng → state ยังเป็น JSON ธรรมดา (ส่งผ่านเครือข่าย/บันทึกได้)

/** คืนเลขสุ่ม 0 ≤ x < 1 และเลื่อนสถานะใน holder.rng */
export function random(holder) {
  let t = (holder.rng = (holder.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(holder, n) {
  return Math.floor(random(holder) * n);
}

export function pick(holder, arr) {
  return arr[randInt(holder, arr.length)];
}

/** สับไพ่แบบ Fisher–Yates (สร้าง array ใหม่) */
export function shuffle(holder, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(holder, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** seed เริ่มต้นแบบสุ่ม (ใช้ตอนสร้างเกมจริง) */
export function newSeed() {
  return (Math.random() * 4294967296) >>> 0;
}
