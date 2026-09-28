<script setup>
import { useToastStore } from '@/stores/toast';
const toast = useToastStore();
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toast.items" :key="t.id" class="toast" :class="`toast--${t.type}`" @click="toast.dismiss(t.id)">
        <span class="ic" aria-hidden="true">
          <svg v-if="t.type === 'ok'" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <svg v-else-if="t.type === 'error'" viewBox="0 0 24 24"><path d="M12 7v6 M12 16.8v.01" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M12 11v5.5 M12 7.6v.01" /></svg>
        </span>
        <span class="msg">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed; z-index: 900; left: 50%; top: calc(var(--safe-t) + 6px); transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
  width: min(92vw, 520px);
}
/* ในหน้าเกม: เลื่อนลงมาใต้แถบบน ไม่บังป้าย "ตาของใคร" */
:global(body.in-game) .toasts { top: calc(var(--safe-t) + 3.6rem); }
/* ป้ายแจ้งเตือนแบบเกม: ขอบขาวหนา + ขอบสี + เงาเป็นชั้น */
.toast {
  --c: #e5b457; --c-deep: #b8870f; --ink: #5a3d0a;
  pointer-events: auto; display: flex; align-items: center; gap: 0.55rem;
  padding: 0.4rem 1.1rem 0.4rem 0.4rem; border-radius: 999px;
  background: linear-gradient(180deg, #fffefa, #fff4d6);
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 2px var(--c), 0 0.22rem 0 2px var(--c-deep), 0 0.6rem 1.2rem rgba(0, 0, 0, 0.25);
  font-family: var(--font-head); font-weight: 700; font-size: 1rem; color: var(--ink); text-align: left;
}
.toast--ok { --c: #4caf3f; --c-deep: #2c6e28; --ink: #1f4d1d; background: linear-gradient(180deg, #fbfff7, #e6f6dc); }
.toast--error { --c: #d9443a; --c-deep: #9e2c24; --ink: #8e1f18; background: linear-gradient(180deg, #fffaf9, #ffe6e2); }
.ic {
  width: 1.8rem; height: 1.8rem; flex: none; border-radius: 50%;
  display: grid; place-items: center; background: var(--c); box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.15);
}
.ic svg { width: 62%; height: 62%; fill: none; stroke: #fff; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
.msg { line-height: 1.35; }
.toast-enter-active { transition: transform 0.4s var(--ease-back), opacity 0.25s; }
.toast-leave-active { transition: transform 0.25s ease-in, opacity 0.25s; }
.toast-enter-from { opacity: 0; transform: translateY(-14px) scale(0.7); }
.toast-leave-to { opacity: 0; transform: scale(0.9); }
@media (max-height: 500px) {
  :global(body.in-game) .toasts { top: calc(var(--safe-t) + 3rem); }
  .toast { font-size: 0.85rem; padding: 0.3rem 0.9rem 0.3rem 0.3rem; }
  .ic { width: 1.45rem; height: 1.45rem; }
}
</style>
