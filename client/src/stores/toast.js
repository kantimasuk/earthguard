import { defineStore } from 'pinia';

let seq = 0;

export const useToastStore = defineStore('toast', {
  state: () => ({ items: [] }),
  actions: {
    show(message, { type = 'info', duration = 2200 } = {}) {
      const id = ++seq;
      this.items.push({ id, message, type });
      if (this.items.length > 3) this.items.shift();
      setTimeout(() => this.dismiss(id), duration);
    },
    dismiss(id) {
      this.items = this.items.filter((t) => t.id !== id);
    },
  },
});
