import { defineStore } from 'pinia';

// รอบการเล่นปัจจุบัน: ตั้งค่าเกม → Pre-test → เกม → Post-test → สรุปผล
// เก็บใน sessionStorage ด้วย → รีเฟรชหน้าระหว่างรอบแล้วยังเล่นต่อได้
const KEY = 'eg.session';

function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    current: load(), // { id, difficulty, aiCount, step: 'pre'|'game'|'post'|'summary', pre?:{score,total} }
  }),
  getters: {
    id: (s) => s.current?.id || null,
    step: (s) => s.current?.step || null,
  },
  actions: {
    start({ sessionId, difficulty, aiCount }) {
      this.current = { id: sessionId, difficulty, aiCount, step: 'pre' };
      this.save();
    },
    setStep(step, extra = {}) {
      if (!this.current) return;
      this.current = { ...this.current, ...extra, step };
      this.save();
    },
    clear() {
      this.current = null;
      this.save();
    },
    save() {
      try {
        if (this.current) sessionStorage.setItem(KEY, JSON.stringify(this.current));
        else sessionStorage.removeItem(KEY);
      } catch { /* ignore */ }
    },
  },
});
