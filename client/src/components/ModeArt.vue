<script setup>
// ภาพตัวละครของการ์ดโหมด แบบเคลื่อนไหว (SVG ซ้อนเลเยอร์)
// - base: ภาพหลักที่ตัดชิ้นส่วนที่ขยับออกแล้ว
// - parts: แขน/ไม้ชี้/ใบไม้ ฯลฯ หมุนรอบจุด pivot (+ แผ่นปิดรอยต่อ cover)
// - eyes: วางเปลือกตาปิดทับตาเป็นระยะ → กะพริบตา
// ข้อมูลตำแหน่งอยู่ใน src/data/modeArt.json (สร้างจาก tools/mode-art/build_layers.py)
import { computed } from 'vue';
import ART from '@/data/modeArt.json';

const props = defineProps({ name: { type: String, required: true }, label: { type: String, default: '' } });
const DIR = '/images/modes/';
const art = computed(() => ART[props.name]);

// จัดกลุ่มตาเป็นคู่ (ใบหน้าเดียวกัน) เพื่อให้กะพริบพร้อมกัน แต่ละหน้ากะพริบไม่ตรงกัน
const faces = computed(() => {
  const eyes = [...art.value.eyes].sort((a, b) => a.y - b.y || a.x - b.x);
  const used = new Set();
  const out = [];
  eyes.forEach((e, i) => {
    if (used.has(i)) return;
    let best = -1;
    let bestD = Infinity;
    eyes.forEach((f, j) => {
      if (j === i || used.has(j)) return;
      const d = Math.abs(f.y - e.y) * 3 + Math.abs(f.x - e.x);
      if (Math.abs(f.y - e.y) < 30 && Math.abs(f.x - e.x) < 140 && d < bestD) { best = j; bestD = d; }
    });
    used.add(i);
    const pair = [e];
    if (best >= 0) { used.add(best); pair.push(eyes[best]); }
    out.push(pair);
  });
  return out;
});

function closedEye(e) {
  const cy = e.y + e.h * 0.62;
  return `M${e.x + 2} ${cy} Q${e.x + e.w / 2} ${cy + e.h * 0.24} ${e.x + e.w - 2} ${cy}`;
}
const delay = (i) => `${(i * 1.37) % 4.1}s`;
</script>

<template>
  <svg class="mode-art" :class="`art-${name}`" :viewBox="`0 0 ${art.w} ${art.h}`" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="label">
    <g class="idle">
      <image :href="DIR + art.base" x="0" y="0" :width="art.w" :height="art.h" />

      <g v-for="p in art.parts" :key="p.name">
        <g class="part" :class="`p-${p.name}`" :style="{ transformOrigin: `${p.pivot[0]}px ${p.pivot[1]}px` }">
          <image :href="DIR + p.href" :x="p.x" :y="p.y" :width="p.w" :height="p.h" />
        </g>
        <image v-if="p.cover" :href="DIR + p.cover.href" :x="p.cover.x" :y="p.cover.y" :width="p.cover.w" :height="p.cover.h" />
      </g>

      <!-- กะพริบตา -->
      <g v-for="(pair, i) in faces" :key="'f' + i" class="blink" :style="{ animationDelay: delay(i) }">
        <template v-for="(e, j) in pair" :key="j">
          <ellipse :cx="e.x + e.w / 2" :cy="e.y + e.h / 2" :rx="e.w / 2 + 2" :ry="e.h / 2 + 2" :fill="e.skin" />
          <path :d="closedEye(e)" fill="none" stroke="#2a1d17" stroke-width="4" stroke-linecap="round" />
        </template>
      </g>
      <g v-if="art.robotEyes.length" class="blink" style="animation-delay: 2.2s">
        <template v-for="(e, j) in art.robotEyes" :key="'r' + j">
          <rect :x="e.x - 3" :y="e.y - 3" :width="e.w + 6" :height="e.h + 6" fill="#303b4a" />
          <line :x1="e.x + 4" :y1="e.y + e.h * 0.62" :x2="e.x + e.w - 4" :y2="e.y + e.h * 0.62" stroke="#7fcdf2" stroke-width="7" stroke-linecap="round" />
        </template>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.mode-art { display: block; width: 100%; height: 100%; overflow: visible; }
.part, .idle { transform-box: view-box; }
.idle { transform-origin: 50% 100%; animation: idle 3.6s ease-in-out infinite; }

/* กะพริบตา: ปิดตาแวบเดียวทุก ~4 วินาที */
.blink { opacity: 0; animation: blink 4.2s infinite; }
@keyframes blink {
  0%, 93% { opacity: 0; }
  94%, 97% { opacity: 1; }
  98%, 100% { opacity: 0; }
}
@keyframes idle {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-1.2%) scale(1.01); }
}

/* ----- TUTORIAL ----- */
.p-stick { animation: stick 2.4s ease-in-out infinite; }
.art-tutorial .p-leaf { animation: sway 3s ease-in-out infinite; }
.art-tutorial .p-spark { animation: spark 1.6s ease-in-out infinite; }
@keyframes stick { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(3deg); } }

/* ----- SINGLE PLAYER ----- */
.p-hand { animation: wave 1.6s ease-in-out infinite; }
.p-bubble { animation: pop 2.2s ease-in-out infinite; }
.p-sprout { animation: sway 2.4s ease-in-out infinite; }
.art-single .p-spark, .art-single .p-spark2 { animation: spark 1.4s ease-in-out infinite; }
.art-single .p-spark2 { animation-delay: 0.7s; }
@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-14deg); }
  40% { transform: rotate(4deg); }
  60% { transform: rotate(-12deg); }
  80% { transform: rotate(2deg); }
}
@keyframes pop { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.07) rotate(-3deg); } }

/* ----- MULTIPLAYER ----- */
.p-fist1 { animation: cheer 1.2s ease-in-out infinite; }
.p-fist2 { animation: cheer2 1.4s ease-in-out infinite 0.3s; }
.p-vsign { animation: vsign 1.8s ease-in-out infinite; }
@keyframes cheer { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-9deg); } }
@keyframes cheer2 { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(9deg); } }
@keyframes vsign { 0%, 100% { transform: rotate(0deg); } 30% { transform: rotate(-7deg); } 60% { transform: rotate(4deg); } }

@keyframes sway { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
@keyframes spark { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: 0.55; } }
</style>
