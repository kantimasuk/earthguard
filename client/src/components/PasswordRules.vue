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
      <svg v-if="allOk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg>
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
  width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; padding: 0;
  border: 1.5px solid var(--sun-dark); background: #fff4d6;
  color: var(--sun-ink); font-family: var(--font-head); font-size: 13px; font-weight: 700; cursor: pointer;
  position: relative;
}
.q::after { content: ''; position: absolute; inset: -9px; } /* ขยายพื้นที่แตะ */
.q.ok { border-color: var(--leaf-dark); background: var(--leaf-light); color: var(--accent); }
.q svg { width: 13px; height: 13px; }
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
