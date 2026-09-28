// หน้าอื่นโหลดแบบ lazy — ถูกโหลดล่วงหน้าระหว่างหน้า Loading
export const lazyViews = {
  login: () => import('@/views/LoginView.vue'),
  register: () => import('@/views/RegisterView.vue'),
  reset: () => import('@/views/ResetPasswordView.vue'),
  menu: () => import('@/views/MainMenuView.vue'),
  setup: () => import('@/views/GameSetupView.vue'),
  test: () => import('@/views/TestView.vue'),
  game: () => import('@/views/GameView.vue'),
  summary: () => import('@/views/SummaryView.vue'),
};
