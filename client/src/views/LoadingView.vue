<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppLogo from '@/components/AppLogo.vue';
import LoadBar from '@/components/loading/LoadBar.vue';
import { preloadAll } from '@/services/preload';
import { enterGameMode } from '@/services/device';
import { play } from '@/services/sound';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { lazyViews } from '@/router/views';

const router = useRouter();
const route = useRoute();
const app = useAppStore();
const auth = useAuthStore();

const target = ref(0);    // เปอร์เซ็นต์จริงจากการโหลด
const shown = ref(0);     // ตัวเลขที่แสดง (ไล่ตามค่าจริงให้ดูลื่น แต่ไม่เกินค่าจริง)
const ready = ref(false);
const leaving = ref(false);
let raf = 0;
const MIN_LOADING_MS = 3000; // เวลาขั้นต่ำของหน้าโหลด (ปรับได้)

function tick() {
  if (shown.value < target.value) {
    // ค่อย ๆ ไล่ขึ้น (ไม่เกิน ~0.9% ต่อเฟรม) → แถบโหลดเคลื่อนนุ่ม ไม่กระโดด และไม่แสดงเกินค่าจริง
    const step = Math.min(0.9, Math.max(0.25, (target.value - shown.value) * 0.05));
    shown.value = Math.min(target.value, shown.value + step);
  }
  if (Math.round(shown.value) >= 100 && target.value >= 100) {
    ready.value = true;
    return;
  }
  raf = requestAnimationFrame(tick);
}

onMounted(async () => {
  raf = requestAnimationFrame(tick);
  const views = Object.values(lazyViews).map((load) => ({ weight: 4, run: () => load() }));
  const authTask = { weight: 4, run: () => auth.init() };
  await Promise.all([
    preloadAll((p) => { target.value = p; }, [...views, authTask]),
    new Promise((r) => setTimeout(r, MIN_LOADING_MS)), // ให้ผู้เล่นได้เห็นโลโก้และแถบโหลด
  ]);
  target.value = 100;
});
onBeforeUnmount(() => cancelAnimationFrame(raf));

async function start() {
  if (!ready.value || leaving.value) return;
  leaving.value = true;
  play('start');
  enterGameMode(); // โทรศัพท์: เต็มจอ + ล็อกแนวนอน (ต้องเรียกจากการแตะ)
  app.booted = true;
  // หลังหน้าโหลด → ไปหน้า Login เสมอ (ถ้า login ค้างไว้อยู่แล้ว ระบบพาไปหน้าหลักเอง)
  // ยกเว้นเปิดมาจากลิงก์ตั้งรหัสผ่านใหม่ในอีเมล
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  const fromEmail = redirect.startsWith('/reset-password') || redirect.startsWith('/auth/action');
  router.replace(fromEmail ? redirect : '/login');
}
</script>

<template>
  <main class="page loading" :class="{ ready }" @click="start" @keydown.enter="start" @keydown.space.prevent="start" tabindex="0">
    <div class="center">
      <div class="logo-in"><AppLogo size="xl" animated /></div>
      <div class="meter">
        <Transition name="swap" mode="out-in">
          <div v-if="!ready" key="bar" class="bar"><LoadBar :value="shown" /></div>
          <button v-else key="tap" type="button" class="tap" @click.stop="start">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
            แตะเพื่อเริ่ม
          </button>
        </Transition>
      </div>
    </div>
  </main>
</template>

<style scoped>
.loading { outline: none; cursor: default; }
.loading.ready { cursor: pointer; }
.center {
  flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(8px, 3vh, 26px);
}
.center :deep(.logo--xl .custom) { height: min(58vh, 30rem); }

/* โลโก้จางเข้า + ขยายจากเล็กเป็นปกติ */
.logo-in { animation: logo-in 1.2s var(--ease-back) both; }
@keyframes logo-in {
  0% { opacity: 0; transform: scale(0.55); filter: blur(6px); }
  60% { opacity: 1; filter: blur(0); }
  100% { opacity: 1; transform: scale(1); }
}

.meter { width: min(70vw, 32rem); min-height: 4.2rem; display: grid; place-items: center; }

.bar { width: 100%; }

/* ---------- ปุ่ม "แตะเพื่อเริ่ม" ---------- */
.tap {
  display: inline-flex; align-items: center; gap: 0.6rem;
  padding: 0.55rem 2rem 0.6rem 1.5rem; border-radius: 999px; cursor: pointer;
  font-family: var(--font-head); font-weight: 700; font-size: 1.6rem; letter-spacing: 0.02em;
  color: #ffffff; background: linear-gradient(180deg, #7fd35c, #3f9a3a);
  border: 3px solid #ffffff;
  box-shadow: 0 0.35rem 0 #2c6e28, 0 0.8rem 1.6rem rgba(20, 50, 20, 0.35);
  text-shadow: 0 2px 0 rgba(33, 79, 31, 0.5);
  animation: pulse 1.6s ease-in-out infinite;
}
.tap svg { width: 1.4rem; height: 1.4rem; fill: #ffffff; }

@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes fade { from { opacity: 0; } }
.swap-enter-active, .swap-leave-active { transition: opacity 0.35s, transform 0.35s var(--ease-back); }
.swap-enter-from { opacity: 0; transform: scale(0.8); }
.swap-leave-to { opacity: 0; }

/* มือถือแนวนอน */
@media (max-height: 440px) {
  .center :deep(.logo--xl .custom) { height: min(56vh, 30rem); }
  .meter { min-height: 3.6rem; }
  .tap { font-size: 1.3rem; padding: 0.4rem 1.6rem 0.45rem 1.2rem; }
}
</style>
