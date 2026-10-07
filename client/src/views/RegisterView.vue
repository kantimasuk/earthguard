<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import AuthLayout from '@/components/AuthLayout.vue';
import FormField from '@/components/FormField.vue';
import PasswordRules from '@/components/PasswordRules.vue';
import { validateEmail, validatePassword, validateConfirm, validateDisplayName } from '@/utils/validation';
import { registerError } from '@/utils/authErrors';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { useAppStore } from '@/stores/app';
import { play } from '@/services/sound';

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();
const app = useAppStore();

// ยอมรับนโยบายความเป็นส่วนตัว (บังคับก่อนสมัคร)
const agree = ref(false);
const agreeError = ref(false);
function needAgree() {
  if (agree.value) return false;
  agreeError.value = true;
  play('error');
  return true;
}
function openPolicy() { play('click'); app.openPrivacy(); }

const form = reactive({ displayName: '', email: '', password: '', confirm: '' });
const errors = reactive({ displayName: '', email: '', password: '', confirm: '' });
const formError = ref('');
const loading = ref(false);

const validators = {
  displayName: () => validateDisplayName(form.displayName),
  email: () => validateEmail(form.email),
  password: () => validatePassword(form.password),
  confirm: () => validateConfirm(form.password, form.confirm),
};

// ตรวจเมื่อออกจากช่อง (เฉพาะช่องที่กรอกแล้ว) — ไม่รบกวนตอนกำลังพิมพ์
function check(field) {
  if (form[field]) errors[field] = validators[field]();
}
function clear(field) {
  errors[field] = '';
  formError.value = '';
}

async function submit() {
  formError.value = '';
  let firstBad = null;
  for (const f of Object.keys(validators)) {
    errors[f] = validators[f]();
    if (errors[f] && !firstBad) firstBad = f;
  }
  if (firstBad) { play('error'); return; }
  if (needAgree()) return;

  loading.value = true;
  try {
    await auth.register({ ...form });
    await auth.acceptPrivacy();
    play('success');
    toast.show(`ยินดีต้อนรับ ${auth.displayName}!`, { type: 'ok' });
    router.replace('/menu'); // สมัครสำเร็จ → เข้าสู่ระบบให้ทันที
  } catch (e) {
    play('error');
    const { field, message } = registerError(e);
    if (field) errors[field] = message;
    else formError.value = message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout wide-form>
    <header class="head">
      <h1 class="title">สร้างบัญชีผู้เล่นใหม่</h1>
      <p class="sub">กรุณากรอกข้อมูลให้ครบถ้วน</p>
    </header>

    <form class="form" novalidate @submit.prevent="submit">
      <div class="grid">
        <FormField
          v-model="form.displayName"
          label="ชื่อที่แสดง"
          inline-label
          icon="user"
          autocomplete="nickname"
          maxlength="20"
          placeholder="นักปกป้องโลก"
          :error="errors.displayName"
          @update:model-value="clear('displayName')"
          @blur="check('displayName')"
        />
        <FormField
          v-model="form.email"
          label="อีเมล"
          inline-label
          type="email"
          icon="mail"
          inputmode="email"
          autocomplete="email"
          placeholder="example@email.com"
          :error="errors.email"
          @update:model-value="clear('email')"
          @blur="check('email')"
        />
        <FormField
          v-model="form.password"
          label="รหัสผ่าน"
          inline-label
          type="password"
          icon="lock"
          autocomplete="new-password"
          placeholder="อย่างน้อย 8 ตัวอักษร"
          :error="errors.password"
          @update:model-value="clear('password')"
          @blur="check('password')"
        >
          <template #trailing><PasswordRules :password="form.password" /></template>
        </FormField>
        <FormField
          v-model="form.confirm"
          label="ยืนยันรหัสผ่าน"
          inline-label
          type="password"
          icon="lock"
          autocomplete="new-password"
          placeholder="กรอกรหัสผ่านอีกครั้ง"
          :error="errors.confirm"
          @update:model-value="clear('confirm')"
          @blur="check('confirm')"
        />
      </div>

      <div class="agree" :class="{ bad: agreeError && !agree }">
        <label class="check">
          <input v-model="agree" class="check-input" type="checkbox" @change="agreeError = false" />
          <span class="box" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <span>ฉันได้อ่านและยอมรับ</span>
        </label>
        <button type="button" class="link-btn policy" @click="openPolicy">นโยบายความเป็นส่วนตัว</button>
      </div>
      <p v-if="agreeError && !agree" class="agree-err" role="alert">กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัครสมาชิก</p>

      <p v-if="formError" class="alert alert--error" role="alert">{{ formError }}</p>

      <div class="actions">
        <button class="btn btn--block" type="submit" :disabled="loading">
          <span v-if="loading" class="spinner" />
          <span>{{ loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก' }}</span>
        </button>
      </div>
    </form>

    <p class="switch">
      มีบัญชีอยู่แล้ว?
      <router-link class="link-btn" to="/login" @click="play('click')">เข้าสู่ระบบ</router-link>
    </p>
  </AuthLayout>
</template>

<style scoped>
.head { text-align: center; margin-bottom: 1.6rem; }
.title { font-size: 2rem; font-weight: 700; color: var(--accent); }
.sub { margin-top: 0.4rem; font-size: 1.1rem; color: var(--text-muted); }
.form { display: flex; flex-direction: column; gap: 1.05rem; }
.grid { display: grid; grid-template-columns: 1fr; gap: 0.95rem; }
.actions { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.35rem; }
.switch { margin-top: 1.6rem; text-align: center; color: var(--text); font-size: 1rem; }
.switch .link-btn { font-size: 1rem; padding: 0; min-height: 0; color: var(--accent); }

/* ยอมรับนโยบายความเป็นส่วนตัว (กล่องติ๊กแบบเดียวกับ "จดจำฉัน" ในหน้าเข้าสู่ระบบ) */
.agree { display: flex; align-items: center; flex-wrap: wrap; gap: 0.1rem 0.35rem; font-size: 0.95rem; color: var(--text); }
.agree .policy { font-size: inherit; padding: 0; min-height: 0; color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.check { position: relative; display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; }
.check-input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.box {
  display: grid; place-items: center; flex: none;
  width: 1.15rem; height: 1.15rem; border-radius: 0.35rem;
  border: 1.5px solid var(--leaf-soft); background: #ffffff;
  transition: background 0.15s, border-color 0.15s;
}
.box svg {
  width: 80%; height: 80%; fill: none; stroke: #ffffff; stroke-width: 3.2;
  stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 22; stroke-dashoffset: 22; transition: stroke-dashoffset 0.2s var(--ease-out);
}
.check-input:checked + .box { background: var(--leaf); border-color: var(--leaf); }
.check-input:checked + .box svg { stroke-dashoffset: 0; }
.check-input:focus-visible + .box { outline: 2px solid var(--sky-dark); outline-offset: 2px; }
.agree.bad .box { border-color: #d9534f; box-shadow: 0 0 0 3px rgba(217, 83, 79, 0.15); animation: nudge 0.35s; }
.agree-err { margin: -0.35rem 0 0; font-size: 0.82rem; color: #c0392b; }
.agree.bad .check { color: #c0392b; }
@keyframes nudge { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }

/* ---------- โทรศัพท์แนวนอน: พาเนลเดียวกลางจอ (ค่าเดียวกันทั้งหน้า Login/Register) ---------- */
@media (max-height: 500px) {
  .head { margin-bottom: 1.15rem; }
  .title { font-size: 1.3rem; }
  .sub { font-size: 0.75rem; margin-top: 0.2rem; }
  .form { gap: 0.75rem; }
  .grid { gap: 0.6rem; }
  .row { margin: 0 0.1rem; }
  .agree { font-size: 0.72rem; }
  .box { width: 0.95rem; height: 0.95rem; border-radius: 0.28rem; }
  .agree-err { display: none; } /* จอเตี้ย: ใช้กล่องสีแดง + ข้อความสีแดงแทน ไม่เพิ่มบรรทัด */
  /* ปุ่มบน-ล่าง กว้างเท่าช่องกรอก */
  .actions { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-top: 0.45rem; }
  .actions > * { width: 100%; min-height: var(--control-h); font-size: 0.8rem; }
  .switch { margin-top: 1.1rem; font-size: 0.75rem; }
  .switch .link-btn { font-size: 0.75rem; }
}
/* จอเตี้ย (Android ทั่วไป 360px) */
@media (max-height: 380px) {
  .sub { display: none; }
  .head { margin-bottom: 0.75rem; }
  .title { font-size: 1.2rem; }
  .form { gap: 0.55rem; }
  .grid { gap: 0.45rem; }
  .actions { gap: 0.4rem; margin-top: 0.25rem; }
  .switch { margin-top: 0.7rem; }
}
/* จอเตี้ยมาก (iPhone SE) */
@media (max-height: 340px) {
  .head { margin-bottom: 0.55rem; }
  .form { gap: 0.45rem; }
  .grid { gap: 0.38rem; }
  .actions { gap: 0.35rem; margin-top: 0.1rem; }
  .switch { margin-top: 0.5rem; }
}

</style>
