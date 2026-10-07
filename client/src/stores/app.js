import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    booted: false, // ผ่านหน้า Loading แล้วหรือยัง
    privacyOpen: false, // ป๊อปอัปนโยบายความเป็นส่วนตัว (โหมดอ่าน) — เปิดได้จากทุกหน้า
  }),
  actions: {
    openPrivacy() { this.privacyOpen = true; },
  },
});
