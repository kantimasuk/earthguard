<script setup>
// ============================================================
// ภาพประกาศช่วงเกมแบบเต็มจอ (ช่วงที่ 1 / 2 / 3 / จบเกม)
// ============================================================
// ใช้รูปของทีมจาก src/assets/ui/  phase-1 · phase-2 · phase-3 · game-end
// ไม่มีรูป → แสดงตัวหนังสือขนาดใหญ่แทน (เอฟเฟกต์เหมือนกันทุกอย่าง)
//
// ลำดับเอฟเฟกต์ (CSS ล้วน ไม่ต้องใช้ไลบรารี):
//   0.00s  แฟลชขาววาบ + คลื่นกระแทก (วงแหวนขยายออก)
//   0.05s  ภาพพุ่งเข้าจากใหญ่ → เด้งเข้าที่ (ความเบลอหายไป)
//   ตลอด   ลำแสงหมุนด้านหลัง + ประกายไฟ/สะเก็ดพุ่งกระจาย + สีโทนช่วงเต้นเป็นจังหวะ
//   ท้าย    ภาพขยายออกและจางหาย
// ช่วงที่ 3 / จบเกม เพิ่มการสั่นของภาพ (จอสั่นทั้งหน้าทำใน GameView)
import { computed } from 'vue';
import { uiImg } from '@/services/uiArt';

const props = defineProps({
  // { kind: 'p1'|'p2'|'p3'|'end', title, sub, id, ms }
  splash: { type: Object, default: null },
});

const IMG = { p1: 'phase-1', p2: 'phase-2', p3: 'phase-3', end: 'game-end' };
const img = computed(() => (props.splash ? uiImg(IMG[props.splash.kind]) : null));

// ประกายไฟ 28 ดวง: มุม/ระยะ/ขนาด/ดีเลย์ คงที่ (คำนวณครั้งเดียว)
const sparks = Array.from({ length: 28 }, (_, i) => ({
  a: (i * 137.5) % 360,
  d: 28 + ((i * 53) % 30),
  s: 5 + (i % 4) * 3,
  delay: ((i * 0.041) % 0.5).toFixed(2),
}));
</script>

<template>
  <Transition name="splash">
    <div
      v-if="splash"
      :key="splash.id"
      class="splash"
      :class="splash.kind"
      :style="{ '--ms': (splash.ms || 2600) + 'ms' }"
      aria-live="assertive"
    >
      <div class="tint" />
      <div class="flash" />
      <div class="rays" />
      <div class="ring" />
      <div class="ring r2" />
      <div class="sparks">
        <i v-for="(p, i) in sparks" :key="i" :style="{ '--a': p.a + 'deg', '--d': p.d + 'vmin', '--s': p.s + 'px', animationDelay: p.delay + 's' }" />
      </div>

      <div class="hero">
        <img v-if="img" :src="img" :alt="splash.title" />
        <template v-else>
          <strong class="title" :data-t="splash.title">{{ splash.title }}</strong>
        </template>
        <span v-if="splash.sub" class="sub">{{ splash.sub }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.splash {
  --c: 255, 214, 90;       /* สีหลัก (r,g,b) */
  --c2: 255, 255, 255;
  position: fixed; inset: 0; z-index: 46; pointer-events: none; overflow: hidden;
  display: grid; place-items: center;
}
.splash.p1 { --c: 150, 220, 120; --c2: 255, 250, 210; }
.splash.p2 { --c: 255, 140, 30; --c2: 255, 210, 120; }
.splash.p3, .splash.end { --c: 225, 40, 30; --c2: 255, 150, 90; }

/* ---- สีโทนของช่วง (ส้มจาง / แดงจาง) เต้นเป็นจังหวะ ---- */
.tint {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0.35) 100%),
    radial-gradient(ellipse at center, rgba(var(--c), 0.22) 0%, rgba(var(--c), 0.48) 70%, rgba(var(--c), 0.66) 100%);
  animation: tint-in 0.35s ease-out both, tint-beat 0.9s ease-in-out 0.35s infinite;
}
.p1 .tint { background: radial-gradient(ellipse at center, rgba(var(--c2), 0.35) 0%, rgba(var(--c), 0.28) 75%); }

/* ---- แฟลชขาว ---- */
.flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: flash 0.55s ease-out both; }

/* ---- ลำแสงหมุน ---- */
.rays {
  position: absolute; left: 50%; top: 50%; width: 180vmax; height: 180vmax; margin: -90vmax 0 0 -90vmax;
  background: repeating-conic-gradient(from 0deg, rgba(var(--c2), 0.5) 0deg 7deg, transparent 7deg 20deg);
  mask-image: radial-gradient(circle, #000 0%, rgba(0, 0, 0, 0.6) 22%, transparent 48%);
  -webkit-mask-image: radial-gradient(circle, #000 0%, rgba(0, 0, 0, 0.6) 22%, transparent 48%);
  animation: rays-in 0.6s ease-out both, spin 9s linear infinite;
}
.p3 .rays, .end .rays { animation: rays-in 0.6s ease-out both, spin 5s linear infinite; }

/* ---- คลื่นกระแทก ---- */
.ring {
  position: absolute; left: 50%; top: 50%; width: 20vmin; height: 20vmin; margin: -10vmin 0 0 -10vmin;
  border-radius: 50%; border: 6px solid rgba(var(--c2), 0.9);
  box-shadow: 0 0 30px rgba(var(--c), 0.9), inset 0 0 30px rgba(var(--c), 0.7);
  opacity: 0; animation: shock 0.9s cubic-bezier(0.1, 0.7, 0.3, 1) 0.05s both;
}
.ring.r2 { animation-delay: 0.3s; border-width: 3px; }

/* ---- ประกายไฟพุ่งกระจาย ---- */
/* ต้องเป็น absolute: ถ้าเป็นแถวหนึ่งของ grid จะดันภาพหลักลงไปครึ่งล่างของจอ */
.sparks { position: absolute; inset: 0; pointer-events: none; }
.sparks i {
  position: absolute; left: 50%; top: 50%; width: var(--s); height: var(--s); margin: calc(var(--s) / -2);
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, rgba(var(--c2), 1) 40%, rgba(var(--c), 0) 72%);
  opacity: 0;
  animation: spark 1.4s cubic-bezier(0.15, 0.8, 0.3, 1) both;
}
.p3 .sparks i, .end .sparks i { animation-duration: 1.1s; animation-iteration-count: 2; }

/* ---- ภาพหลัก (อยู่กึ่งกลางจอพอดี · ข้อความรองลอยอยู่ใต้ภาพ ไม่ดันภาพขึ้น/ลง) ---- */
.hero {
  position: relative; grid-area: 1 / 1; display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  animation: slam 0.75s cubic-bezier(0.2, 0.9, 0.25, 1.25) both, float 1.6s ease-in-out 0.8s infinite;
}
.p3 .hero, .end .hero { animation: slam 0.75s cubic-bezier(0.2, 0.9, 0.25, 1.25) both, quake 0.14s linear 0.75s 7, float 1.6s ease-in-out 1.8s infinite; }
.hero img {
  display: block; width: auto; height: auto;
  max-width: min(92vw, 70rem); max-height: 76vh; object-fit: contain;
  filter: drop-shadow(0 0 22px rgba(var(--c), 1)) drop-shadow(0 0 4px #fff) drop-shadow(0 12px 28px rgba(0, 0, 0, 0.45));
  animation: glow 0.9s ease-in-out 0.6s infinite alternate;
}
.title {
  position: relative; display: block;
  font-family: var(--font-head); font-weight: 700; line-height: 1.1; text-align: center;
  font-size: clamp(3.4rem, 15vmin, 8.5rem); white-space: nowrap;
  color: #fff;
  -webkit-text-stroke: 0.08em rgba(var(--c), 1);
  paint-order: stroke fill;
  text-shadow: 0 0 22px rgba(var(--c), 0.95), 0 6px 0 rgba(0, 0, 0, 0.25);
}
.sub {
  position: absolute; top: calc(100% - 0.6rem); left: 50%; translate: -50% 0; white-space: nowrap;
  padding: 0.3rem 1rem; border-radius: 999px; font-weight: 600; font-size: clamp(0.8rem, 3.2vmin, 1.1rem);
  background: rgba(255, 255, 255, 0.92); color: #3a2a12; text-align: center; max-width: 86vw;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  animation: sub-in 0.45s ease-out 0.45s both;
}

/* ---- เข้า / ออก ---- */
.splash-leave-active { transition: opacity 0.45s ease-in; }
.splash-leave-active .hero { animation: zoom-out 0.45s ease-in forwards; }
.splash-leave-to { opacity: 0; }

@keyframes tint-in { from { opacity: 0; } }
@keyframes tint-beat { 50% { opacity: 0.7; } }
@keyframes flash { 0% { opacity: 0; } 12% { opacity: 0.85; } 100% { opacity: 0; } }
@keyframes rays-in { from { opacity: 0; transform: scale(0.3); } }
@keyframes spin { to { rotate: 360deg; } }
@keyframes shock {
  0% { opacity: 1; transform: scale(0.2); }
  100% { opacity: 0; transform: scale(7); }
}
@keyframes spark {
  0% { opacity: 1; transform: rotate(var(--a)) translateX(0) scale(1.4); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--a)) translateX(var(--d)) scale(0.4); }
}
@keyframes slam {
  0% { opacity: 0; transform: scale(2.6) rotate(-4deg); filter: blur(14px); }
  55% { opacity: 1; transform: scale(0.9) rotate(1deg); filter: blur(0); }
  75% { transform: scale(1.07); }
  100% { transform: scale(1); }
}
@keyframes quake {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-6px, 3px) rotate(-0.6deg); }
  50% { transform: translate(5px, -4px) rotate(0.5deg); }
  75% { transform: translate(-3px, -2px); }
}
@keyframes float { 50% { transform: translateY(-6px) scale(1.02); } }
@keyframes glow { to { filter: drop-shadow(0 0 40px rgba(var(--c), 1)) drop-shadow(0 0 6px #fff) drop-shadow(0 12px 28px rgba(0, 0, 0, 0.45)); } }
@keyframes zoom-out { from { transform: scale(1); } to { transform: scale(1.6); filter: blur(6px); } }
@keyframes sub-in { from { opacity: 0; transform: translateY(10px); } }

@media (prefers-reduced-motion: reduce) {
  .rays, .sparks, .ring { display: none; }
  .hero, .hero img, .tint { animation: none !important; }
}
</style>
