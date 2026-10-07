<script setup>
// ปุ่ม "?" เล็ก ๆ ข้างป้ายรหัสผ่าน → เปิด pop-up เงื่อนไข พร้อมติ๊กถูกแบบ real-time
import { computed, ref, onBeforeUnmount } from 'vue';
import { passwordChecks } from '@/utils/validation';

const props = defineProps({ password: { type: String, default: '' } });
const open = ref(false);
const root = ref(null);
const popEl = ref(null);
const pos = ref({ left: 0, top: 0, below: false });
const checks = computed(() => passwordChecks(props.password));
const rules = computed(() => [
  { ok: checks.value.length, text: 'อย่างน้อย 8 ตัว' },
  { ok: checks.value.letter, text: 'มีตัวอักษรภาษาอังกฤษ' },
  { ok: checks.value.digit, text: 'มีตัวเลข' },
]);
const allOk = computed(() => rules.value.every((r) => r.ok));

function outside(e) {
  if (root.value?.contains(e.target) || popEl.value?.contains(e.target)) return;
  close();
}
// ใช้ position: fixed + Teleport → ไม่ถูกตัดโดยกล่องฟอร์มที่เลื่อนได้
function place() {
  const r = root.value.getBoundingClientRect();
  const w = Math.min(230, window.innerWidth - 24);
  const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  const below = r.top < 140;
  pos.value = { left, width: w, top: below ? r.bottom + 8 : r.top - 8, below };
}
function toggle() {
  if (!open.value) place();
  open.value = !open.value;
  if (open.value) setTimeout(() => document.addEventListener('pointerdown', outside), 0);
  else document.removeEventListener('pointerdown', outside);
}
function close() {
  open.value = false;
  document.removeEventListener('pointerdown', outside);
}
onBeforeUnmount(close);
</script>

<template>
  <span ref="root" class="rules">
    <button type="button" class="q" :class="{ ok: allOk }" :aria-expanded="open" aria-label="เงื่อนไขรหัสผ่าน" @click="toggle">
      <svg v-if="allOk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 12.5 4 4 9-9.5" /></svg>
      <span v-else>?</span>
    </button>
    <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="open"
        ref="popEl"
        class="pop panel"
        :class="{ below: pos.below }"
        role="tooltip"
        :style="{ left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px' }"
      >
        <strong>เงื่อนไขรหัสผ่าน</strong>
        <ul>
          <li v-for="r in rules" :key="r.text" :class="{ ok: r.ok }">
            <span class="dot">{{ r.ok ? '✓' : '•' }}</span>{{ r.text }}
          </li>
        </ul>
        <small>ไม่บังคับอักขระพิเศษ</small>
      </div>
    </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.rules { position: relative; display: inline-flex; }
.q {
  width: 20px; height: 20px; border-radius: 50%;
  display: grid; place-items: center; padding: 0;
  border: 1px solid #f0d58f; background: #fff6dc;
  color: #9a6b00; font-family: var(--font-head); font-size: 12px; font-weight: 700; line-height: 1; cursor: pointer;
  position: relative;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s var(--ease-back);
}
.q::after { content: ''; position: absolute; inset: -10px; } /* ขยายพื้นที่แตะ */
.q:hover { transform: scale(1.08); }
/* ครบเงื่อนไข: วงสีเขียวทึบ + เครื่องหมายถูกสีขาว (ขนาดเท่าไอคอนตา ไม่มีขอบหนา) */
.q.ok {
  border-color: transparent; background: var(--leaf, #3a7d2c); color: #ffffff;
  box-shadow: 0 0 0 3px rgba(58, 125, 44, 0.16);
  animation: ok-pop 0.35s var(--ease-back);
}
.q svg { width: 12px; height: 12px; }
.q.ok svg path { stroke-dasharray: 20; stroke-dashoffset: 20; animation: draw 0.3s 0.1s var(--ease-out) forwards; }
@keyframes ok-pop { 0% { transform: scale(0.6); } 100% { transform: scale(1); } }
@keyframes draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) {
  .q.ok, .q.ok svg path { animation: none; stroke-dashoffset: 0; }
}
.pop {
  position: fixed; z-index: 700; transform: translateY(-100%);
  padding: 0.6rem 0.8rem; font-size: 0.88rem;
  background: var(--panel-solid);
}
.pop.below { transform: none; }
.pop strong { font-family: var(--font-head); color: var(--sun-ink); font-weight: 700; }
ul { list-style: none; margin: 0.3rem 0; padding: 0; display: grid; gap: 0.15rem; }
li { color: var(--text-muted); display: flex; gap: 0.4rem; }
li.ok { color: var(--accent); }
.dot { width: 1em; text-align: center; }
small { color: var(--text-faint); font-size: 0.78rem; }
.pop-enter-active, .pop-leave-active { transition: opacity 0.18s, transform 0.18s var(--ease-out); }
.pop-enter-from, .pop-leave-to { opacity: 0; }
</style>
