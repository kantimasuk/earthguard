<script setup>
import { useId } from 'vue';
import { branding } from '@/services/branding';
// id ของ gradient ต้องไม่ซ้ำกันต่อชิ้น — ถ้าโลโก้อีกชิ้นถูกซ่อน (display:none) gradient ที่อ้างถึงจะหายไปด้วย
const uid = useId();
// โลโก้ EarthGuard: โล่ + โลก + ใบไม้  (size: xl | lg | md | sm)
defineProps({
  size: { type: String, default: 'md' },
  withText: { type: Boolean, default: true },
  stacked: { type: Boolean, default: true },
  // animated: โลโก้ลอยขึ้นลง + แสงวิ่งผ่าน (ใช้ในหน้า Loading / Login / Register)
  animated: { type: Boolean, default: false },
});
</script>

<template>
  <div class="logo" :class="[`logo--${size}`, { 'logo--row': !stacked, 'is-animated': animated }]">
    <!-- โลโก้ของทีม (client/public/images/logo.*) -->
    <span v-if="branding.logo" class="custom-wrap" :style="{ '--logo-url': `url(${branding.logo})` }">
      <img class="custom" :src="branding.logo" alt="It's All Rights: EarthGuard" draggable="false" />
      <span v-if="animated" class="shine" aria-hidden="true"></span>
    </span>
    <svg v-else class="emblem" viewBox="0 0 120 132" role="img" aria-label="EarthGuard">
      <defs>
        <linearGradient :id="`eg-shield-${uid}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#b6f28f" />
          <stop offset="1" stop-color="#3fae6a" />
        </linearGradient>
        <radialGradient :id="`eg-ocean-${uid}`" cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stop-color="#8fd3ff" />
          <stop offset="0.6" stop-color="#3a8fc8" />
          <stop offset="1" stop-color="#1d5d8f" />
        </radialGradient>
        <linearGradient :id="`eg-land-${uid}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#a4ee7f" />
          <stop offset="1" stop-color="#2f9a5a" />
        </linearGradient>
      </defs>
      <!-- โล่ -->
      <path d="M60 4 108 20v36c0 32-20 58-48 72C32 114 12 88 12 56V20Z" :fill="`url(#eg-shield-${uid})`" />
      <path d="M60 11 101 25v31c0 28-17 51-41 64C36 107 19 84 19 56V25Z" fill="#0b2e24" />
      <!-- โลก -->
      <circle cx="60" cy="62" r="30" :fill="`url(#eg-ocean-${uid})`" />
      <path d="M40 46c7-7 16-5 18 2s-4 11-9 14-10 1-11-5 0-8 2-11Zm29 20c4-5 12-3 12 3s-6 13-11 13-6-10-1-16Zm-5-30c6-1 12 2 14 6-5 1-10 0-14-6Z" :fill="`url(#eg-land-${uid})`" />
      <ellipse cx="50" cy="48" rx="11" ry="5" fill="#fff" opacity="0.18" transform="rotate(-30 50 48)" />
      <!-- ใบไม้ -->
      <path d="M78 22c14-8 28-4 32 4-10 2-18 12-30 8-4-2-5-8-2-12Z" fill="#ffd36b" />
      <path d="M82 30c8-3 16-4 24-2" stroke="#c9962a" stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>
    <div v-if="withText && !branding.logo" class="words">
      <span class="kicker">IT'S ALL RIGHTS</span>
      <span class="name">Earth<b>Guard</b></span>
    </div>
  </div>
</template>

<style scoped>
.logo { display: flex; flex-direction: column; align-items: center; gap: 0.35em; }
.logo--row { flex-direction: row; gap: 0.5em; }
.emblem { width: 5.5em; height: auto; filter: drop-shadow(0 0.4em 0.9em rgba(0, 0, 0, 0.45)); }
.words { display: flex; flex-direction: column; align-items: center; line-height: 1; }
.logo--row .words { align-items: flex-start; }
.kicker {
  font-family: var(--font-head); font-weight: 600;
  font-size: 0.62em; letter-spacing: 0.32em; color: var(--sun);
}
.name {
  font-family: var(--font-head); font-weight: 700; font-size: 2.1em; letter-spacing: 0.01em;
  color: #f2fff7;
  text-shadow: 0 0.08em 0 #1f6b45, 0 0.2em 0.6em rgba(0, 0, 0, 0.5);
}
.name b { color: var(--leaf-light); font-weight: 700; }

.logo--xl { font-size: clamp(14px, 4.4vh, 30px); }
.logo--lg { font-size: clamp(12px, 3.4vh, 24px); }
.logo--md { font-size: clamp(11px, 2.7vh, 18px); }
.logo--sm { font-size: 11px; }
.logo--sm .emblem { width: 2.6em; }
.logo--sm .name { font-size: 1.55em; }
.logo--sm .kicker { font-size: 0.55em; letter-spacing: 0.22em; color: var(--sun-ink); }
.logo--sm .name { color: var(--text); text-shadow: none; }
.logo--sm .name b { color: var(--accent); }

/* โลโก้รูปภาพ: จำกัดทั้งสูงและกว้าง รูปจะย่อให้พอดีโดยไม่ผิดสัดส่วน */
.custom-wrap { position: relative; display: block; max-width: 100%; }
.custom {
  display: block; height: 8.5em; width: auto; max-width: 100%; object-fit: contain;
  filter: drop-shadow(0 0.4em 0.9em rgba(0, 0, 0, 0.45));
  user-select: none; -webkit-user-drag: none;
}
.logo--sm .custom { height: 40px; max-width: 160px; filter: drop-shadow(0 1px 2px rgba(45, 95, 70, 0.35)); }
/* ขนาดโลโก้รูปภาพตามตำแหน่ง */
.logo--xl .custom { height: min(50vh, 30rem); max-width: 72vw; }
.logo--lg .custom { height: min(56vh, 26rem); }

/* ---------- แอนิเมชันแบบเกม ---------- */
.is-animated { animation: float 3.2s ease-in-out infinite; }
.is-animated .custom-wrap, .is-animated .emblem { animation: sway 6.4s ease-in-out infinite; transform-origin: 50% 80%; }
/* แสงวิ่งผ่านเฉพาะตัวโลโก้ (ใช้รูปโลโก้เป็น mask) */
.shine {
  position: absolute; inset: 0; pointer-events: none;
  -webkit-mask: var(--logo-url) center / contain no-repeat;
  mask: var(--logo-url) center / contain no-repeat;
  background: linear-gradient(110deg, transparent 38%, rgba(255, 255, 255, 0.75) 50%, transparent 62%);
  background-size: 300% 100%;
  animation: shine 3.8s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3.5%); }
}
@keyframes sway {
  0%, 100% { transform: rotate(-1.6deg) scale(1); }
  50% { transform: rotate(1.6deg) scale(1.025); }
}
@keyframes shine {
  0%, 55% { background-position: 150% 0; }
  100% { background-position: -50% 0; }
}
</style>
