<script setup>
import { branding } from '@/services/branding';
import { sceneBg, uiImg } from '@/services/uiArt';
// ฉากพื้นหลังที่ใช้ร่วมกันทุกหน้า (อยู่นอก Transition → ไม่กระพริบตอนเปลี่ยนหน้า)
// plain: ใช้พื้นหลังปกติเสมอ (ไม่เปลี่ยนตามช่วงเกม) — ใช้ในหน้าโหลด
const props = defineProps({ calm: { type: Boolean, default: false }, plain: { type: Boolean, default: false } });

// ตำแหน่งหิ่งห้อย/ละอองแสง (คงที่ เพื่อไม่ให้ layout เปลี่ยนทุกครั้งที่ render)
// พื้นหลังระหว่างเล่นเกม (จุดที่ 4–6) — ซ้อนทับพื้นหลังปกติแล้วค่อย ๆ เฟดเข้า/ออก
// ไม่มีรูปของช่วงนั้น → ใช้สีโทนส้ม/แดงจาง ๆ ทับพื้นหลังเดิมแทน
const GAME_LAYERS = [
  { key: 'game', img: uiImg('bg-game') },
  { key: 'phase2', img: uiImg('bg-phase-2'), tint: 'rgba(255, 140, 30, 0.16)' },
  { key: 'phase3', img: uiImg('bg-phase-3'), tint: 'rgba(210, 40, 30, 0.18)' },
  { key: 'test', img: uiImg('bg-test') }, // หน้าแบบทดสอบ Pre-test / Post-test
];
const layerOn = (l) => {
  const k = props.plain ? null : sceneBg.key;
  if (!k) return false;
  if (l.key === k) return true;
  if (l.key === 'test' || k === 'test') return false;
  // ช่วงที่ 2/3 ไม่มีรูป → คงรูปของช่วงก่อนหน้าไว้ (แล้วทับด้วยสี)
  const order = ['game', 'phase2', 'phase3'];
  const want = order.indexOf(k);
  const idx = order.indexOf(l.key);
  if (idx > want || !l.img) return false;
  return !GAME_LAYERS.slice(idx + 1, want + 1).some((x) => x.img);
};

const motes = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61) % 100,
  top: 30 + ((i * 37) % 60),
  delay: (i * 0.73) % 6,
  dur: 6 + ((i * 1.3) % 5),
  size: 3 + (i % 3) * 2,
}));
</script>

<template>
  <div class="scene" :class="{ calm }" aria-hidden="true">
    <!-- รูปพื้นหลังของทีม (client/public/images/background.*) -->
    <template v-if="branding.background">
      <div class="photo" :style="{ backgroundImage: `url(${branding.background})` }"></div>
      <div class="shade"></div>
    </template>
    <template v-else>
    <div class="sky"></div>
    <div class="glow"></div>
    <svg class="hills" viewBox="0 0 1600 500" preserveAspectRatio="xMidYMax slice">
      <path class="h1" d="M0 260 C 200 180 380 240 560 200 S 940 120 1120 190 S 1450 170 1600 140 V500 H0Z" />
      <path class="h2" d="M0 330 C 160 280 330 330 520 300 S 880 250 1060 300 S 1400 280 1600 250 V500 H0Z" />
      <g class="trees">
        <path d="M150 318 l18 -46 l18 46z M190 312 l14 -36 l14 36z M1330 282 l20 -52 l20 52z M1375 280 l14 -34 l14 34z M760 300 l16 -40 l16 40z" />
      </g>
      <path class="h3" d="M0 410 C 220 360 420 410 640 390 S 1060 350 1280 390 S 1500 380 1600 360 V500 H0Z" />
    </svg>
    </template>
    <!-- พื้นหลังของหน้าเกม (ช่วงที่ 1–3) -->
    <template v-for="l in GAME_LAYERS" :key="l.key">
      <div v-if="l.img" class="photo game-bg" :class="{ on: layerOn(l) }" :style="{ backgroundImage: `url(${l.img})` }"></div>
      <div v-if="l.tint && !l.img" class="tint" :class="{ on: !plain && sceneBg.key === l.key }" :style="{ background: l.tint }"></div>
    </template>
    <div class="motes">
      <span
        v-for="(m, i) in motes"
        :key="i"
        :style="{ left: m.left + '%', top: m.top + '%', width: m.size + 'px', height: m.size + 'px', animationDelay: m.delay + 's', animationDuration: m.dur + 's' }"
      ></span>
    </div>
    <div class="vignette"></div>
  </div>
</template>

<style scoped>
.scene { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.sky {
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg, #9fd6f2 0%, #cdeefa 45%, #e9f8f0 100%);
}
.glow {
  position: absolute; left: 50%; top: 38%;
  width: 70vmax; height: 70vmax; transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 245, 200, 0.55) 0%, rgba(255, 245, 200, 0.15) 35%, transparent 65%);
  animation: breathe 9s ease-in-out infinite;
}
.photo {
  position: absolute; inset: 0;
  background-size: cover; background-position: center; background-repeat: no-repeat;
}
/* ชั้นสีทับรูป ให้ตัวหนังสือและพาเนลอ่านง่ายเสมอ ปรับความเข้มได้ที่ค่า alpha */
.shade {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(40, 80, 60, 0.12) 100%);
}
.game-bg, .tint { opacity: 0; transition: opacity 1.4s ease; }
.game-bg { transform: scale(1.04); transition: opacity 1.4s ease, transform 6s ease-out; }
.game-bg.on { opacity: 1; transform: scale(1); }
.tint { position: absolute; inset: 0; mix-blend-mode: multiply; }
.tint.on { opacity: 1; animation: tint-pulse 5s ease-in-out infinite; }
@keyframes tint-pulse { 50% { opacity: 0.65; } }
.calm .shade { background: rgba(255, 255, 255, 0.12); }
.hills { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 62%; }
.h1 { fill: #b9e4c0; }
.h2 { fill: #9fd8a9; }
.trees { fill: #86cc93; }
.h3 { fill: #84c98f; }
.motes span {
  position: absolute; border-radius: 50%;
  background: radial-gradient(circle, #ffffff 0%, rgba(255, 250, 210, 0.7) 45%, transparent 70%);
  opacity: 0;
  animation: float linear infinite;
}
.calm .motes span:nth-child(odd) { display: none; }
.vignette {
  position: absolute; inset: 0;
  background: radial-gradient(130% 100% at 50% 45%, transparent 60%, rgba(40, 80, 60, 0.18) 100%);
}
@keyframes float {
  0% { transform: translate(0, 0); opacity: 0; }
  15% { opacity: 0.9; }
  85% { opacity: 0.7; }
  100% { transform: translate(18px, -90px); opacity: 0; }
}
@keyframes breathe {
  0%, 100% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
}
</style>
