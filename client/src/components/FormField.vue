<script setup>
import { ref, computed, useId } from 'vue';

const model = defineModel({ type: String, default: '' });
const props = defineProps({
  // ป้ายชื่อซ่อนไว้สำหรับโปรแกรมอ่านหน้าจอ — บนจอแสดงเป็นไอคอน + placeholder (ประหยัดพื้นที่บนโทรศัพท์)
  label: { type: String, required: true },
  inlineLabel: { type: Boolean, default: false }, // แสดงชื่อช่องไว้ในช่อง (หน้าสมัครสมาชิก)
  type: { type: String, default: 'text' },
  error: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  inputmode: { type: String, default: undefined },
  maxlength: { type: [Number, String], default: undefined },
  icon: { type: String, default: '' }, // mail | lock | user
});
const emit = defineEmits(['blur']);
const id = useId();
const reveal = ref(false);
const isPassword = computed(() => props.type === 'password');
const inputType = computed(() => (isPassword.value && reveal.value ? 'text' : props.type));

const ICONS = {
  mail: 'M3.5 6h17v12h-17z M3.5 6.5l8.5 6.5 8.5-6.5',
  lock: 'M6.5 11h11v9h-11z M8.5 11V8a3.5 3.5 0 0 1 7 0v3 M12 14.5v2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5',
};

// มือถือแนวนอน: คีย์บอร์ดบังเกือบทั้งจอ → เลื่อนช่องที่กำลังพิมพ์ให้อยู่ในสายตา
function onFocus(e) {
  const el = e.target;
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
}
</script>

<template>
  <div class="field" :class="{ 'has-error': error }">
    <div class="control">
      <svg v-if="icon" class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="ICONS[icon]" />
      </svg>
      <label :for="id" :class="inlineLabel ? 'inline-label' : 'sr-only'">{{ label }}</label>
      <input
        :id="id"
        v-model="model"
        :type="inputType"
        :placeholder="placeholder || label"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? id + '-err' : undefined"
        autocapitalize="off"
        spellcheck="false"
        @focus="onFocus"
        @blur="emit('blur')"
      />
      <slot name="trailing" />
      <button
        v-if="isPassword && model"
        type="button"
        class="toggle"
        :aria-label="reveal ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'"
        @click="reveal = !reveal"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path v-if="!reveal" d="M4 20 20 4" />
        </svg>
      </button>
    </div>
    <Transition name="err">
      <p v-if="error" :id="id + '-err'" class="error" role="alert">{{ error }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }

/* กล่องทรงแคปซูล: [ไอคอน][ช่องพิมพ์][ปุ่มเสริม][ปุ่มตา] */
.control {
  display: flex; align-items: center; gap: 0.6rem;
  min-height: var(--control-h);
  padding: 0 0.4rem 0 1rem;
  border-radius: var(--radius-s);
  border: 1.5px solid var(--input-border);
  background: var(--input-bg);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.control:focus-within { border-color: var(--leaf-soft); box-shadow: 0 0 0 3px rgba(140, 196, 126, 0.3); }
.has-error .control { border-color: var(--danger); background: #fffafa; }
.has-error .control:focus-within { box-shadow: 0 0 0 3px rgba(217, 83, 79, 0.15); }

.lead { width: 1.35rem; height: 1.35rem; flex: none; color: var(--text-muted); }
.inline-label {
  flex: none; width: 7.6rem; white-space: nowrap;
  font-family: var(--font-head); font-size: 0.95rem; font-weight: 500; color: var(--text);
}


input {
  flex: 1; min-width: 0; height: calc(var(--control-h) - 4px);
  padding: 0; border: 0; outline: none; background: transparent;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 16px; /* ≥16px กัน iOS ซูมอัตโนมัติตอนแตะช่อง */
}
input::placeholder { color: var(--text-faint); }
/* ซ่อนปุ่มตา/ปุ่มล้างที่เบราว์เซอร์ (Edge/IE) ใส่มาเอง → เหลือปุ่มตาของเราอันเดียว */
input::-ms-reveal, input::-ms-clear { display: none; }
input::-webkit-credentials-auto-fill-button { visibility: hidden; }

.toggle {
  flex: none; width: 42px; height: 42px; display: grid; place-items: center;
  background: none; border: 0; color: var(--text-muted); cursor: pointer;
}
.toggle svg { width: 1.25rem; height: 1.25rem; }

.error { font-size: 0.82rem; color: var(--danger); line-height: 1.25; padding-left: 0.4rem; }
.err-enter-active, .err-leave-active { transition: opacity 0.2s, transform 0.2s; }
.err-enter-from, .err-leave-to { opacity: 0; transform: translateY(-3px); }

/* มือถือแนวนอน */
@media (max-height: 500px) {
  .control { padding-left: 0.75rem; gap: 0.5rem; border-radius: 0.7rem; }
  /* viewport ตั้ง maximum-scale=1 ไว้แล้ว → iOS ไม่ซูมอัตโนมัติ ใช้ตัวอักษรเล็กลงได้ */
  input { font-size: 12px; }
  .toggle { width: var(--control-h); height: var(--control-h); }
  .error { font-size: 0.74rem; }
  .lead { width: 1.1rem; height: 1.1rem; }
  .inline-label { width: 6.4rem; font-size: 0.75rem; }
}
</style>
