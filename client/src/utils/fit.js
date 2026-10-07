// v-fit: วัดขนาดจริงของกล่องแล้วตั้งเป็นตัวแปร CSS --rw / --rh (หน่วย px)
// ใช้แทน container query (cqh / @container) ที่ Safari < 16 และเว็บวิวบน Android รุ่นเก่าไม่รองรับ
// v-fit="[260, 210]" → เพิ่มคลาส fit-lt-260 / fit-lt-210 เมื่อกล่องแคบกว่าค่านั้น
const obs = new WeakMap();

function apply(el, rect, steps) {
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (el.__fitW !== w) { el.__fitW = w; el.style.setProperty('--rw', `${w}px`); }
  if (el.__fitH !== h) { el.__fitH = h; el.style.setProperty('--rh', `${h}px`); }
  for (const s of steps || []) el.classList.toggle(`fit-lt-${s}`, w > 0 && w < s);
}

export const vFit = {
  mounted(el, binding) {
    const steps = Array.isArray(binding.value) ? binding.value : null;
    apply(el, { width: el.clientWidth, height: el.clientHeight }, steps);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => apply(el, { width: el.clientWidth, height: el.clientHeight }, steps));
    ro.observe(el);
    obs.set(el, ro);
  },
  // Vue เขียน class ใหม่ทั้งชุดเมื่อ :class เปลี่ยน → ใส่คลาส fit-lt-* กลับ
  updated(el, binding) {
    if (!Array.isArray(binding.value)) return;
    const w = el.__fitW;
    for (const s of binding.value) el.classList.toggle(`fit-lt-${s}`, w > 0 && w < s);
  },
  beforeUnmount(el) {
    obs.get(el)?.disconnect();
    obs.delete(el);
  },
};
