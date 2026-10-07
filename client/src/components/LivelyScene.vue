<script setup>
// ============================================================
// นกบินบนท้องฟ้า (หน้าเลือกโหมด / หน้าตั้งค่าเกม) — วางทับพื้นหลัง ใต้เนื้อหาของหน้า
// ============================================================
// ให้ดูเป็นธรรมชาติ:
//   - ปีกซ้าย/ขวาหมุนที่หัวไหล่ (ไม่ใช่พลิกทั้งตัว) · กระพือ 2–3 ครั้ง แล้วร่อนนิ่ง ๆ สลับกัน
//   - ตัวนกยกขึ้นเล็กน้อยตอนตีปีกลง · เส้นทางบินเป็นคลื่นช้า ๆ ไม่ใช่เส้นตรง
//   - บินช้า (ข้ามจอ 35–60 วินาที) · แต่ละตัวในฝูงจังหวะไม่ตรงกัน · ตัวไกลเล็กและจางกว่า
// วาดด้วย SVG + CSS ล้วน · ไม่รับการคลิก · ผู้ใช้ที่ตั้งค่า "ลดการเคลื่อนไหว" จะไม่เห็นนก

// ฝูงนก: ความสูง (%) · ทิศ · เวลาข้ามจอ · ดีเลย์ · ขนาด · สมาชิก (ระยะห่าง x,y และจังหวะปีก)
const FLOCKS = [
  { top: 12, dir: 1, t: 42, d: -6, s: 1, birds: [[0, 0, 0], [34, 14, 0.35], [66, 4, 0.7]] },
  { top: 24, dir: -1, t: 55, d: -30, s: 0.75, birds: [[0, 0, 0.2], [30, 10, 0.9]] },
  { top: 7, dir: -1, t: 60, d: -48, s: 0.55, birds: [[0, 0, 0.5]] },
  { top: 30, dir: 1, t: 48, d: -24, s: 0.65, birds: [[0, 0, 0.1], [26, -8, 0.6]] },
];
</script>

<template>
  <div class="lively" aria-hidden="true">
    <div
      v-for="(f, i) in FLOCKS"
      :key="i"
      class="flock"
      :class="f.dir > 0 ? 'ltr' : 'rtl'"
      :style="{ top: f.top + '%', animationDuration: f.t + 's', animationDelay: f.d + 's', '--s': f.s, opacity: 0.55 + f.s * 0.4 }"
    >
      <div class="wave" :style="{ animationDelay: -i * 1.7 + 's' }">
        <span
          v-for="(b, k) in f.birds"
          :key="k"
          class="bird"
          :style="{ left: b[0] * f.s + 'px', top: b[1] * f.s + 'px', '--o': -b[2] * 1.9 + 's' }"
        >
          <svg viewBox="-24 -14 48 24">
            <g class="body"><ellipse cx="0" cy="1" rx="3.2" ry="2.2" /></g>
            <path class="wing l" d="M0 0 Q -8 -7 -21 -3" />
            <path class="wing r" d="M0 0 Q 8 -7 21 -3" />
          </svg>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lively { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }

/* ข้ามจอช้า ๆ */
.flock { position: absolute; left: 0; width: 0; height: 0; animation: fly-ltr linear infinite; }
.flock.rtl { animation-name: fly-rtl; }
.flock.rtl .bird svg { transform: scaleX(-1); }
@keyframes fly-ltr { from { transform: translateX(-12vw); } to { transform: translateX(112vw); } }
@keyframes fly-rtl { from { transform: translateX(112vw); } to { transform: translateX(-12vw); } }

/* เส้นทางเป็นคลื่นช้า ๆ (ขึ้น-ลง) */
.wave { position: relative; animation: wave 9s ease-in-out infinite; }
@keyframes wave {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(-18px); }
  65% { transform: translateY(10px); }
}

.bird {
  position: absolute; display: block;
  width: calc(46px * var(--s)); height: calc(23px * var(--s));
  animation: lift 1.9s ease-in-out infinite; animation-delay: var(--o);
}
.bird svg { width: 100%; height: 100%; overflow: visible; }
.body ellipse { fill: #40525f; }
.wing {
  fill: none; stroke: #40525f; stroke-width: 2.6; stroke-linecap: round;
  transform-box: view-box; transform-origin: 0 0; /* หมุนที่หัวไหล่ (กลางตัว) */
  animation: flap-l 1.9s ease-in-out infinite; animation-delay: var(--o);
}
.wing.r { animation-name: flap-r; }

/* กระพือ 3 ครั้ง แล้วร่อน (ปีกกางนิ่ง เอียงขึ้นนิด) */
@keyframes flap-l {
  0% { transform: rotate(0deg); }
  9% { transform: rotate(-32deg); }
  18% { transform: rotate(0deg); }
  27% { transform: rotate(-30deg); }
  36% { transform: rotate(0deg); }
  45% { transform: rotate(-26deg); }
  56%, 100% { transform: rotate(8deg); }
}
@keyframes flap-r {
  0% { transform: rotate(0deg); }
  9% { transform: rotate(32deg); }
  18% { transform: rotate(0deg); }
  27% { transform: rotate(30deg); }
  36% { transform: rotate(0deg); }
  45% { transform: rotate(26deg); }
  56%, 100% { transform: rotate(-8deg); }
}
/* ตัวยกขึ้นตอนตีปีก แล้วค่อย ๆ ร่อนลงตอนกางปีกนิ่ง */
@keyframes lift {
  0% { transform: translateY(0); }
  45% { transform: translateY(-5px); }
  100% { transform: translateY(0); }
}

@media (max-height: 500px) {
  .bird { width: calc(34px * var(--s)); height: calc(17px * var(--s)); }
}
@media (prefers-reduced-motion: reduce) {
  .flock { display: none; }
}
</style>
