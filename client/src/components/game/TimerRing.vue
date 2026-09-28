<script setup>
// ตัวจับเวลาแบบวงกลม: ลดลงเรื่อย ๆ, เหลือ 5 วินาที → เปลี่ยนเป็นสีแดง + สั่น + มีเสียงติ๊ก
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { play } from '@/services/sound';

const props = defineProps({
  deadline: { type: Number, default: 0 },   // เวลาหมด (ms ตามนาฬิกาเครื่องนี้)
  duration: { type: Number, default: 20000 },
  size: { type: Number, default: 44 },
  big: { type: Boolean, default: false }, // แบบเด่น: ตัวเลขใหญ่ + ป้าย "วินาที" + พื้นไล่สี
});

const now = ref(Date.now());
const left = computed(() => Math.max(0, props.deadline - now.value));
const frac = computed(() => Math.min(1, left.value / props.duration));
const secs = computed(() => Math.ceil(left.value / 1000));
const urgent = computed(() => secs.value <= 5);
const warn = computed(() => secs.value <= 10 && !urgent.value);
let raf = 0;
let lastTick = -1;
function loop() {
  now.value = Date.now();
  const s = Math.ceil(left.value / 1000);
  if (s <= 5 && s > 0 && s !== lastTick) { lastTick = s; play('tick'); }
  if (left.value > 0) raf = requestAnimationFrame(loop);
}
watch(() => props.deadline, (d) => {
  cancelAnimationFrame(raf);
  lastTick = -1;
  if (d) loop();
}, { immediate: true });
onBeforeUnmount(() => cancelAnimationFrame(raf));

const R = 20;
const C = 2 * Math.PI * R;
</script>

<template>
  <div class="ring" :class="{ urgent, warn, big }" :style="{ width: size + 'px', height: size + 'px', '--fs': (big ? size * 0.4 : 15) + 'px' }" role="timer" :aria-label="`เหลือเวลา ${secs} วินาที`">
    <svg viewBox="0 0 48 48">
      <circle class="track" cx="24" cy="24" :r="R" />
      <circle class="bar" cx="24" cy="24" :r="R" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - frac)" />
    </svg>
    <b>{{ secs }}</b>
    <small v-if="big">วินาที</small>
  </div>
</template>

<style scoped>
.ring { position: relative; display: grid; place-items: center; flex: none; }
svg { position: absolute; inset: 0; transform: rotate(-90deg); }
circle { fill: none; stroke-width: 5; }
.track { stroke: rgba(47, 107, 44, 0.15); fill: #ffffff; }
.bar { stroke: var(--leaf); stroke-linecap: round; transition: stroke 0.3s; }
b { position: relative; font-family: var(--font-head); font-weight: 700; font-size: 0.95rem; color: var(--leaf-dark); font-variant-numeric: tabular-nums; }
.urgent .bar { stroke: #d9483b; }
.urgent b { color: #c0392b; }
.urgent { animation: shake 0.5s ease-in-out infinite; }
.big .track { fill: #ffffff; stroke: rgba(47, 107, 44, 0.18); }
.big { border-radius: 50%; background: radial-gradient(circle at 50% 35%, #ffffff 55%, #eef8ea 100%); box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9), 0 4px 12px rgba(50, 90, 70, 0.15); }
.big b { font-size: var(--fs); line-height: 1; margin-top: -0.25em; }
.big small { position: absolute; bottom: 18%; font-size: calc(var(--fs) * 0.32); font-weight: 700; color: var(--text-muted); }
.big.warn .bar { stroke: #f08a1c; }
.big.warn b { color: #b8640f; }
.big.warn { box-shadow: 0 0 0 3px #fff, 0 0 0 6px #ffd9a8; }
.big.urgent { box-shadow: 0 0 0 3px #fff, 0 0 0 6px #ffc2b8, 0 0 16px 5px rgba(240, 120, 100, 0.45); animation: shake 0.5s ease-in-out infinite, beat 1s ease-in-out infinite; }
@keyframes beat { 50% { filter: brightness(1.1); } }
b { font-size: var(--fs); }
@keyframes shake {
  0%, 100% { transform: translateX(0) rotate(0); }
  25% { transform: translateX(-2px) rotate(-4deg); }
  75% { transform: translateX(2px) rotate(4deg); }
}
</style>
