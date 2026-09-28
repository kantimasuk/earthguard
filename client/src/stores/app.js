import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    booted: false, // ผ่านหน้า Loading แล้วหรือยัง
  }),
});
