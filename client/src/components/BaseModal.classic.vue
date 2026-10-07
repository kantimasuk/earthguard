<script setup>
// ============================================================
// ป๊อปอัปกลาง (ใช้ทั้งแอป) — โทนพาสเทล: พื้นขาวนวล ขอบสีอ่อน มุมโค้ง
// ============================================================
// ซ้อนกันหลายอัน → อันที่ "เปิดล่าสุด" อยู่บนสุดเสมอ
//   ทุกป๊อปอัปถูก Teleport ไปไว้ใน <body> ตามลำดับที่ประกาศในโค้ด (ไม่ใช่ลำดับที่เปิด)
//   จึงให้ z-index จากตัวนับกลางทุกครั้งที่เปิด: เปิดทีหลัง = เลขมากกว่า = อยู่บน
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import { openModals } from './modalState';
import { play } from '@/services/sound';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '26rem' },
  closable: { type: Boolean, default: true },
  tone: { type: String, default: 'green' }, // green | blue | gold | red
});
const emit = defineEmits(['close']);
const panel = ref(null);
const z = ref(500);

function close() {
  if (!props.closable) return;
  play('click');
  emit('close');
}
function onKey(e) {
  // Esc ปิดเฉพาะอันบนสุด
  if (e.key === 'Escape' && props.open && z.value === zTop()) close();
}
// นับจำนวนป๊อปอัปที่เปิดอยู่ (ปุ่มฟันเฟืองใช้ซ่อนตัวเอง ไม่ให้ทับ/ชิดปุ่ม X)
let counted = false;
function setCounted(v) {
  if (v === counted) return;
  counted = v;
  openModals.value += v ? 1 : -1;
}
onBeforeUnmount(() => setCounted(false));
watch(() => props.open, async (v) => {
  setCounted(Boolean(v));
  if (v) {
    z.value = nextZ();
    await nextTick();
    panel.value?.querySelector('input, button:not(.x)')?.focus({ preventScroll: true });
  }
}, { immediate: true });
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<script>
// ตัวนับร่วมของทุกป๊อปอัป (อยู่ระดับโมดูล → ใช้ร่วมกันทุก instance)
let counter = 500;
const nextZ = () => ++counter;
const zTop = () => counter;
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="backdrop" :style="{ zIndex: z }" @pointerdown.self="close">
        <div ref="panel" class="modal" :class="`tone-${tone}`" role="dialog" aria-modal="true" :aria-label="title" :style="{ '--w': width }">
          <!-- หัวป๊อปอัป: ชื่อ + ปุ่มปิด อยู่แถวเดียวกัน กึ่งกลางแนวตั้งพอดี -->
          <header v-if="title" class="head">
            <h3>{{ title }}</h3>
            <button v-if="closable" class="x" type="button" aria-label="ปิด" @click="close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17" /></svg>
            </button>
          </header>
          <button v-else-if="closable" class="x float" type="button" aria-label="ปิด" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17" /></svg>
          </button>
          <div class="body" :class="{ 'no-head': !title }"><slot /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed; inset: 0; z-index: 500;
  /* แถวกริดต้องสูงคงที่ (minmax(0,1fr)) ไม่งั้น max-height: 100% ของป๊อปอัปไม่มีผล → เนื้อหายาวล้นจอแทนที่จะเลื่อน */
  display: grid; place-items: center; grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, 1fr);
  padding: calc(var(--safe-t) + 14px) calc(var(--safe-r) + 12px) calc(var(--safe-b) + 14px) calc(var(--safe-l) + 12px);
  background: rgba(40, 70, 55, 0.32);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
/* ป้ายโทนพาสเทล: พื้นขาวนวล + ขอบสีอ่อน + มุมโค้ง + เงานุ่ม */
.modal {
  --c: #bfe6c9; --c-soft: #eef9f0; --t: #2f5a3a;
  position: relative;
  width: min(calc(var(--w) * 1.12), 100%);
  max-height: 100%; min-height: 0;
  display: flex; flex-direction: column;
  background: rgba(255, 255, 255, 0.96);
  border: 2px solid var(--c);
  border-radius: 1.4rem;
  box-shadow: 0 18px 44px rgba(30, 60, 45, 0.28);
}
.tone-blue { --c: #bcdcf5; --c-soft: #eef6fd; --t: #25557d; }
.tone-gold { --c: #ffe1a1; --c-soft: #fff8e6; --t: #7a5200; }
.tone-red { --c: #ffc9c1; --c-soft: #fff1ee; --t: #9a2f25; }

.head {
  flex: none; display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 0.55rem 0.5rem 1.2rem;
  border-radius: 1.3rem 1.3rem 0 0;
  background: var(--c-soft);
  border-bottom: 1.5px solid var(--c);
}
.head h3 {
  flex: 1; min-width: 0; margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 1.25rem; color: var(--t); line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.x {
  flex: none; width: 2.2rem; height: 2.2rem; border-radius: 50%; cursor: pointer; padding: 0;
  display: grid; place-items: center; color: var(--t);
  background: rgba(255, 255, 255, 0.85); border: 1.5px solid var(--c);
  transition: transform 0.2s, background 0.2s, color 0.2s;
}
.x.float { position: absolute; top: 0.5rem; right: 0.5rem; z-index: 2; }
.x svg { width: 1.05rem; height: 1.05rem; display: block; }
.x:hover { background: #fff1ee; color: #b8433a; border-color: #ffc9c1; transform: rotate(90deg); }
.x:active { transform: scale(0.92); }
.body {
  flex: 1 1 auto; min-height: 0; padding: 0.9rem 1.3rem 1.2rem; font-size: 1.02rem;
  overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y;
}
.body.no-head { padding-top: 1.3rem; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal { transition: transform 0.35s var(--ease-back), opacity 0.25s; }
.modal-leave-active .modal { transition: transform 0.2s ease, opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal { transform: scale(0.9) translateY(12px); opacity: 0; }
.modal-leave-to .modal { transform: scale(0.96); opacity: 0; }

/* มือถือแนวนอน */
@media (max-height: 500px) {
  .backdrop { padding: calc(var(--safe-t) + 8px) calc(var(--safe-r) + 12px) calc(var(--safe-b) + 8px) calc(var(--safe-l) + 12px); }
  .modal { border-radius: 1.1rem; }
  .head { padding: 0.3rem 0.4rem 0.3rem 1rem; border-radius: 1rem 1rem 0 0; }
  .head h3 { font-size: 1.05rem; }
  .x { width: 1.9rem; height: 1.9rem; }
  .body { padding: 0.6rem 1rem 0.8rem; font-size: 0.95rem; }
}
</style>
