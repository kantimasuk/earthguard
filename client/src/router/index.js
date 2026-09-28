import { createRouter, createWebHistory } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useSessionStore } from '@/stores/session';
import LoadingView from '@/views/LoadingView.vue';

import { lazyViews } from './views';

const routes = [
  { path: '/', name: 'loading', component: LoadingView },
  { path: '/login', name: 'login', component: lazyViews.login, meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: lazyViews.register, meta: { guestOnly: true } },
  { path: '/reset-password', name: 'reset-password', component: lazyViews.reset },
  { path: '/menu', name: 'menu', component: lazyViews.menu, meta: { requiresAuth: true } },
  { path: '/setup', name: 'setup', component: lazyViews.setup, meta: { requiresAuth: true } },
  // เส้นทางของ 1 รอบการเล่น: Pre-test → เกม → Post-test → สรุปผล (ต้องมีรอบการเล่นอยู่)
  { path: '/pretest', name: 'pretest', component: lazyViews.test, props: { phase: 'pre' }, meta: { requiresAuth: true, step: 'pre' } },
  { path: '/game', name: 'game', component: lazyViews.game, meta: { requiresAuth: true, step: 'game' } },
  { path: '/posttest', name: 'posttest', component: lazyViews.test, props: { phase: 'post' }, meta: { requiresAuth: true, step: 'post' } },
  { path: '/summary', name: 'summary', component: lazyViews.summary, meta: { requiresAuth: true, step: 'summary' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const app = useAppStore();
  const auth = useAuthStore();

  // ทุกหน้าต้องผ่านหน้า Loading ก่อน (โหลดทรัพยากร + ปลดล็อกเสียง + เต็มจอ)
  if (!app.booted) {
    if (to.name === 'loading') return true;
    return { name: 'loading', query: { redirect: to.fullPath } };
  }
  if (to.name === 'loading') return { name: auth.isLoggedIn ? 'menu' : 'login' };

  await auth.init();
  // ยังไม่ login เข้าหน้าอื่นไม่ได้ → กลับไปหน้า Login
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: to.fullPath !== '/menu' ? { redirect: to.fullPath } : {} };
  }
  if (to.meta.guestOnly && auth.isLoggedIn) return { name: 'menu' };

  // หน้าในรอบการเล่น: ไม่มีรอบ → กลับหน้าหลัก, ข้ามขั้นตอน → พาไปขั้นตอนปัจจุบัน
  if (to.meta.step) {
    const session = useSessionStore();
    if (!session.id) return { name: 'menu' };
    const byStep = { pre: 'pretest', game: 'game', post: 'posttest', summary: 'summary' };
    if (session.step !== to.meta.step) return { name: byStep[session.step] || 'menu' };
  }
  return true;
});

export default router;
