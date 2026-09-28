<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import AuthLayout from '@/components/AuthLayout.vue';
import FormField from '@/components/FormField.vue';
import PasswordRules from '@/components/PasswordRules.vue';
import GoogleButton from '@/components/GoogleButton.vue';
import { validateEmail, validatePassword, validateConfirm, validateDisplayName } from '@/utils/validation';
import { registerError, googleErrorMessage } from '@/utils/authErrors';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { play } from '@/services/sound';

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();

const form = reactive({ displayName: '', email: '', password: '', confirm: '' });
const errors = reactive({ displayName: '', email: '', password: '', confirm: '' });
const formError = ref('');
const loading = ref(''); // '' | 'email' | 'google'

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

  loading.value = 'email';
  try {
    await auth.register({ ...form });
    play('success');
    toast.show(`ยินดีต้อนรับ ${auth.displayName}!`, { type: 'ok' });
    router.replace('/menu'); // สมัครสำเร็จ → เข้าสู่ระบบให้ทันที
  } catch (e) {
    play('error');
    const { field, message } = registerError(e);
    if (field) errors[field] = message;
    else formError.value = message;
  } finally {
    loading.value = '';
  }
}

// สมัครด้วย Google = เข้าสู่ระบบด้วย Google (ถ้ายังไม่มีบัญชี ระบบสร้างให้อัตโนมัติ)
async function google() {
  formError.value = '';
  loading.value = 'google';
  try {
    await auth.loginWithGoogle();
    if (auth.isLoggedIn) {
      play('success');
      toast.show(`ยินดีต้อนรับ ${auth.displayName}!`, { type: 'ok' });
      router.replace('/menu');
    }
  } catch (e) {
    const msg = googleErrorMessage(e);
    if (msg) { play('error'); formError.value = msg; }
  } finally {
    loading.value = '';
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

      <p v-if="formError" class="alert alert--error" role="alert">{{ formError }}</p>

      <div class="actions">
        <button class="btn btn--block" type="submit" :disabled="Boolean(loading)">
          <span v-if="loading === 'email'" class="spinner" />
          <span>{{ loading === 'email' ? 'กำลังสมัคร...' : 'สมัครสมาชิก' }}</span>
        </button>
        <div class="or"><span>หรือ</span></div>
        <GoogleButton label="สมัครด้วย Google" :loading="loading === 'google'" :disabled="Boolean(loading)" @click="google" />
      </div>
    </form>

    <p class="switch">
      มีบัญชีอยู่แล้ว?
      <router-link class="link-btn" to="/login" @click="play('click')">เข้าสู่ระบบ</router-link>
    </p>
  </AuthLayout>
</template>

<style scoped>
.head { text-align: center; margin-bottom: 1rem; }
.title { font-size: 2rem; font-weight: 700; color: var(--accent); }
.sub { margin-top: 0.5rem; font-size: 1.1rem; color: var(--text); }
.form { display: flex; flex-direction: column; gap: var(--gap); }
.grid { display: grid; grid-template-columns: 1fr; gap: var(--gap); }
.actions { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.2rem; }
.or { display: flex; align-items: center; gap: 1.2rem; margin: 0.3rem 0; color: var(--text-muted); font-size: 0.85rem; }
.or::before, .or::after { content: ''; flex: 1; height: 1px; background: #d9ded6; }
.switch { margin-top: 0.9rem; text-align: center; color: var(--text); font-size: 1rem; }
.switch .link-btn { font-size: 1rem; padding: 0; min-height: 0; color: var(--accent); }

/* ---------- โทรศัพท์แนวนอน: พาเนลเดียวกลางจอ (ค่าเดียวกันทั้งหน้า Login/Register) ---------- */
@media (max-height: 500px) {
  .head { margin-bottom: 0.95rem; }
  .title { font-size: 1.3rem; }
  .sub { font-size: 0.75rem; margin-top: 0.2rem; }
  .form { gap: 0.65rem; }
  .grid { gap: 0.55rem; }
  .row { margin: 0 0.1rem; }
  .row .link-btn, .check { font-size: 0.72rem; }
  .check input { width: 0.9rem; height: 0.9rem; }
  /* ปุ่มบน-ล่าง กว้างเท่าช่องกรอก */
  .actions { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-top: 0.4rem; }
  .actions > * { width: 100%; min-height: var(--control-h); font-size: 0.8rem; }
  .or { display: none; }
  .switch { margin-top: 0.9rem; font-size: 0.75rem; }
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
