<script setup>
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AuthLayout from '@/components/AuthLayout.vue';
import FormField from '@/components/FormField.vue';
import GoogleButton from '@/components/GoogleButton.vue';
import ForgotPasswordModal from '@/components/ForgotPasswordModal.vue';
import { validateEmail } from '@/utils/validation';
import { loginErrorMessage, googleErrorMessage } from '@/utils/authErrors';
import { useAuthStore } from '@/stores/auth';
import { play } from '@/services/sound';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const form = reactive({ email: '', password: '' });
const errors = reactive({ email: '', password: '' });
const remember = ref(true);         // จดจำฉัน: ปิดเบราว์เซอร์แล้วยังอยู่ในระบบ
const formError = ref('');
const loading = ref('');            // '' | 'email' | 'google'
const forgotOpen = ref(false);

function goNext() {
  const r = route.query.redirect;
  router.replace(typeof r === 'string' && r.startsWith('/') ? r : '/menu');
}

async function submit() {
  formError.value = '';
  errors.email = validateEmail(form.email);
  errors.password = form.password ? '' : 'กรุณากรอกรหัสผ่าน';
  if (errors.email || errors.password) { play('error'); return; }
  loading.value = 'email';
  try {
    await auth.loginWithEmail(form.email, form.password, remember.value);
    play('success');
    goNext();
  } catch (e) {
    play('error');
    // แสดงรหัส error จริงใน Console (ช่วยหาสาเหตุ) — ผู้ใช้ยังเห็นแค่ข้อความรวมตามสเปก
    console.warn('[login] failed:', e?.code, e?.message);
    formError.value = loginErrorMessage(e); // ข้อความรวม ไม่บอกว่าช่องไหนผิด
  } finally {
    loading.value = '';
  }
}

async function google() {
  formError.value = '';
  loading.value = 'google';
  try {
    await auth.loginWithGoogle(remember.value);
    if (auth.isLoggedIn) { play('success'); goNext(); }
  } catch (e) {
    const msg = googleErrorMessage(e);
    if (msg) { play('error'); formError.value = msg; }
  } finally {
    loading.value = '';
  }
}

function openForgot() {
  play('click');
  forgotOpen.value = true;
}
</script>

<template>
  <AuthLayout>
    <header class="head">
      <h1 class="title">เข้าสู่ระบบ</h1>
      <p class="sub">เข้าสู่โลกของ EarthGuard</p>
    </header>

    <form class="form" novalidate @submit.prevent="submit">
      <FormField
        v-model="form.email"
        label="อีเมล"
        type="email"
        icon="mail"
        inputmode="email"
        autocomplete="email"
        :error="errors.email"
        @update:model-value="errors.email = ''; formError = ''"
      />
      <FormField
        v-model="form.password"
        label="รหัสผ่าน"
        type="password"
        icon="lock"
        autocomplete="current-password"
        :error="errors.password"
        @update:model-value="errors.password = ''; formError = ''"
      />

      <div class="row">
        <label class="check">
          <input v-model="remember" class="check-input" type="checkbox" />
          <span class="box" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <span>จดจำฉัน</span>
        </label>
        <button type="button" class="link-btn" @click="openForgot">ลืมรหัสผ่าน?</button>
      </div>

      <Transition name="shake">
        <p v-if="formError" class="alert alert--error" role="alert">{{ formError }}</p>
      </Transition>

      <div class="actions">
        <button class="btn btn--block" type="submit" :disabled="Boolean(loading)">
          <span v-if="loading === 'email'" class="spinner" />
          <span>เข้าสู่ระบบ</span>
        </button>
        <div class="or"><span>หรือ</span></div>
        <GoogleButton :loading="loading === 'google'" :disabled="Boolean(loading)" @click="google" />
      </div>
    </form>

    <p class="switch">
      ยังไม่มีบัญชี?
      <router-link class="link-btn" to="/register" @click="play('click')">สร้างบัญชีผู้เล่นใหม่</router-link>
    </p>

    <ForgotPasswordModal :open="forgotOpen" :initial-email="form.email" @close="forgotOpen = false" />
  </AuthLayout>
</template>

<style scoped>
.head { text-align: center; margin-bottom: 1.1rem; }
.title { font-size: 2rem; font-weight: 700; color: var(--accent); }
.sub { margin-top: 0.5rem; font-size: 1.1rem; color: var(--text); }
.form { display: flex; flex-direction: column; gap: var(--gap); }

.row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.row .link-btn { font-size: 0.98rem; padding: 0.2rem 0; min-height: 0; color: var(--accent); }
.check { position: relative; display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; font-size: 0.98rem; color: var(--text); }
/* ช่องติ๊กแบบกำหนดเอง: ซ่อน checkbox เดิม แล้ววาดกล่อง + ไอคอนเครื่องหมายถูก (SVG) แทน */
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
  .box { width: 0.95rem; height: 0.95rem; border-radius: 0.28rem; }
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

.shake-enter-active { animation: shake 0.4s; }
.shake-leave-active { transition: opacity 0.2s; }
.shake-leave-to { opacity: 0; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
</style>
