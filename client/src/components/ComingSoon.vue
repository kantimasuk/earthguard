<script setup>
// ครอบเมนูที่ยังไม่เปิดใช้: เมาส์ชี้ → ขึ้น "เร็ว ๆ นี้" / จอสัมผัส แตะ → ขึ้นชั่วคราว
import { ref } from 'vue';
import { play } from '@/services/sound';

defineProps({ text: { type: String, default: 'เร็ว ๆ นี้' } });
const shown = ref(false);
let timer = 0;
function tap() {
  play('click');
  shown.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => { shown.value = false; }, 1500);
}
</script>

<template>
  <span class="soon" :class="{ shown }" @click="tap">
    <slot />
    <span class="bubble" role="tooltip">{{ text }}</span>
  </span>
</template>

<style scoped>
.soon { position: relative; display: inline-flex; }
.bubble {
  position: absolute; left: 50%; top: calc(100% + 6px); z-index: 80;
  transform: translate(-50%, -4px); opacity: 0; pointer-events: none;
  padding: 0.25rem 0.6rem; border-radius: 999px; white-space: nowrap;
  background: var(--sun); color: var(--sun-ink);
  font-family: var(--font-head); font-size: 0.8rem; font-weight: 600;
  box-shadow: 0 0.3rem 0.8rem rgba(45, 95, 70, 0.25);
  transition: opacity 0.18s, transform 0.18s var(--ease-out);
}
.bubble::before {
  content: ''; position: absolute; left: 50%; top: -4px; width: 8px; height: 8px;
  background: var(--sun); transform: translateX(-50%) rotate(45deg);
}
.shown .bubble { opacity: 1; transform: translate(-50%, 0); }
@media (hover: hover) {
  .soon:hover .bubble { opacity: 1; transform: translate(-50%, 0); }
}
</style>
