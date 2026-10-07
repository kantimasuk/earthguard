<!-- แสดงเมื่อ "โทรศัพท์ / แท็บเล็ต (iPad)" อยู่ในแนวตั้ง → บังคับให้หมุนเป็นแนวนอน (คอมพิวเตอร์ใช้ได้ทุกแนว) -->
<template>
  <div class="rotate" role="alertdialog" aria-live="assertive">
    <div class="phone">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="18" y="6" width="28" height="52" rx="5" fill="none" stroke="currentColor" stroke-width="3" />
        <circle cx="32" cy="51" r="2.2" fill="currentColor" />
      </svg>
    </div>
    <h2>หมุนหน้าจอเป็นแนวนอน</h2>
    <p>EarthGuard เล่นได้ในแนวนอนเท่านั้น</p>
    <small>ถ้าหมุนแล้วจอไม่เปลี่ยน ให้ปิดการล็อกการหมุนหน้าจอ</small>
  </div>
</template>

<style scoped>
.rotate {
  display: none;
  position: fixed; inset: 0; z-index: 1000;
  flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  padding: 24px; text-align: center;
  background: linear-gradient(180deg, #9fd6f2, #e9f8f0);
  color: var(--text);
}
/* โทรศัพท์และแท็บเล็ต (จอสัมผัส) ในแนวตั้ง
   any-pointer: coarse → iPad ที่ต่อคีย์บอร์ด/แทร็กแพดก็ยังนับเป็นจอสัมผัส
   max-width: 1100px → iPad Pro 12.9" แนวตั้งกว้าง 1024px ยังเข้าเงื่อนไข (คอมจอสัมผัสแนวตั้งแทบไม่มี) */
@media (orientation: portrait) and (any-pointer: coarse) and (max-width: 1100px) {
  .rotate { display: flex; }
}
.phone { color: var(--accent); width: 84px; height: 84px; animation: turn 2.4s var(--ease-out) infinite; }
.phone svg { width: 100%; height: 100%; }
h2 { font-size: 22px; }
p { font-size: 16px; color: var(--text-muted); }
small { font-size: 13px; color: var(--text-faint); max-width: 260px; }
@keyframes turn {
  0%, 20% { transform: rotate(0deg); }
  55%, 85% { transform: rotate(-90deg); }
  100% { transform: rotate(-90deg); opacity: 0; }
}
</style>
