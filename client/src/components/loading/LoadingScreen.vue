<script setup>
// ============================================================
// หน้าโหลดเต็มจอ — หน้าตาเดียวกับหน้าเปิดแอป (โลโก้ + แถบโหลด) แต่ไม่มี "แตะเพื่อเริ่ม"
// ============================================================
// วิธีใช้ (ในหน้าที่ต้องรอข้อมูล):
//   <LoadingScreen v-if="showLoader" :done="!loading" label="กำลังโหลดข้อสอบ" @finished="showLoader = false" />
//
// props
//   done      true เมื่อโหลดเสร็จ → แถบวิ่งไปถึง 100% แล้วจางหาย (ส่ง event finished)
//   progress  ความคืบหน้าจริง 0–100 (ไม่บังคับ) · ไม่ส่งมา = ประมาณเอง ค่อย ๆ ขยับเข้าใกล้ 90%
//   label     ข้อความบนแถบ
//
// ทำไมต้องมีเวลาขั้นต่ำ: ถ้าโหลดเสร็จเร็วมาก หน้าโหลดจะวาบแล้วหาย ดูเหมือนจอกระพริบ
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppLogo from '@/components/AppLogo.vue';
import SceneBackground from '@/components/SceneBackground.vue';
import LoadBar from './LoadBar.vue';

const props = defineProps({
  done: { type: Boolean, default: false },
  progress: { type: Number, default: null },
  label: { type: String, default: 'กำลังโหลด' },
  minMs: { type: Number, default: 900 },
});
const emit = defineEmits(['finished']);

const shown = ref(0);
const visible = ref(true);
let fake = 0;
let raf = 0;
let startedAt = 0;
let last = 0;

function tick(now) {
  if (!startedAt) startedAt = last = now;
  // คิดตามเวลาจริง ไม่ใช่ต่อเฟรม → เครื่องช้า (เฟรมเรตต่ำ ตอนวาดโต๊ะเกม) แถบก็ยังวิ่งด้วยความเร็วเท่าเดิม
  const f = Math.min(now - last, 250) / 16.7;
  last = now;
  const finishing = props.done && now - startedAt >= props.minMs;
  // ค่าประมาณ: วิ่งเร็วช่วงแรก แล้วช้าลงเรื่อย ๆ ไม่เกิน 90% จนกว่าจะโหลดเสร็จจริง
  fake += (90 - fake) * Math.min(1, 0.012 * f);
  const target = finishing ? 100 : Math.min(95, props.progress ?? fake);
  if (shown.value < target) {
    const maxStep = finishing ? 2.2 : 0.9; // เสร็จแล้ว → วิ่งปิดท้ายเร็วขึ้น
    const step = Math.min(maxStep, Math.max(0.25, (target - shown.value) * 0.06)) * f;
    shown.value = Math.min(target, shown.value + step);
  }
  if (finishing && shown.value >= 100) {
    setTimeout(() => { visible.value = false; }, 220); // ค้างที่ 100% แป๊บหนึ่งให้เห็นว่าเสร็จ
    return;
  }
  raf = requestAnimationFrame(tick);
}

onMounted(() => { raf = requestAnimationFrame(tick); });
onBeforeUnmount(() => cancelAnimationFrame(raf));
watch(() => props.done, (d) => { if (!d && !visible.value) visible.value = true; });
</script>

<template>
  <!-- Teleport ไปไว้ใน <body> → เต็มจอเสมอ แม้หน้าที่เรียกใช้จะมี transform (position: fixed จะเพี้ยนถ้าอยู่ใต้ transform) -->
  <Teleport to="body">
  <Transition name="ls" @after-leave="emit('finished')">
    <div v-if="visible" class="ls" aria-live="polite">
      <SceneBackground plain />
      <div class="center">
        <div class="logo-in"><AppLogo size="xl" animated /></div>
        <div class="meter"><LoadBar :value="shown" :label="label" /></div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>

<style scoped>
.ls {
  position: fixed; inset: 0; z-index: 400;
  display: flex; flex-direction: column;
  padding: var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l);
  background: #cdeefa; /* สีรองพื้นระหว่างรูปพื้นหลังกำลังโหลด */
}
.center {
  position: relative; z-index: 1;
  flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(8px, 3vh, 26px);
}
.center :deep(.logo--xl .custom) { height: min(58vh, 30rem); }
.logo-in { animation: logo-in 0.8s var(--ease-back) both; }
@keyframes logo-in {
  0% { opacity: 0; transform: scale(0.7); filter: blur(4px); }
  60% { opacity: 1; filter: blur(0); }
  100% { opacity: 1; transform: scale(1); }
}
.meter { width: min(70vw, 32rem); min-height: 4.2rem; display: grid; place-items: center; }

.ls-leave-active { transition: opacity 0.45s ease; }
.ls-leave-active .center { transition: transform 0.45s ease; transform: scale(1.04); }
.ls-leave-to { opacity: 0; }

@media (max-height: 440px) {
  .center :deep(.logo--xl .custom) { height: min(56vh, 30rem); }
  .meter { min-height: 3.6rem; }
}
</style>
