<script setup>
// หน้าเปิดจากลิงก์ในอีเมลของ Firebase
// - mode=resetPassword → ตั้งรหัสผ่านใหม่ (ใช้เงื่อนไขรหัสผ่านเดียวกับหน้าสมัคร)
// - mode=verifyEmail   → ยืนยันอีเมล (กรณีตั้ง Custom action URL ใน Firebase ลิงก์ยืนยันอีเมลจะมาหน้านี้ด้วย)
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '@/components/AuthLayout.vue';
import FormField from '@/components/FormField.vue';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import PasswordRules from '@/components/PasswordRules.vue';
import { validatePassword, validateConfirm } from '@/utils/validation';
import { useAuthStore } from '@/stores/auth';
import { play } from '@/services/sound';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const q = (k) => (typeof route.query[k] === 'string' ? route.query[k] : '');
const mode = q('mode') || 'resetPassword';
const code = q('oobCode');

const state = ref('checking'); // checking | form | invalid | done | verified | offline
const email = ref('');
const form = reactive({ password: '', confirm: '' });
const errors = reactive({ password: '', confirm: '' });
const formError = ref('');
const loading = ref(false);
const showLoader = ref(true); // หน้าโหลดเต็มจอระหว่างตรวจสอบลิงก์
const title = computed(() => (mode === 'verifyEmail' ? 'ยืนยันอีเมล' : 'ตั้งรหัสผ่านใหม่'));

const BAD_LINK = ['auth/expired-action-code', 'auth/invalid-action-code', 'auth/user-disabled', 'auth/user-not-found'];
const failState = (e) => (BAD_LINK.includes(e?.code) ? 'invalid' : 'offline');

onMounted(async () => {
  if (!code) { state.value = 'invalid'; return; }
  try {
    if (mode === 'verifyEmail') {
      await auth.applyEmailAction(code);
      state.value = 'verified';
    } else if (mode === 'resetPassword') {
      email.value = await auth.checkResetCode(code);
      state.value = 'form';
    } else {
      state.value = 'invalid';
    }
  } catch (e) {
    state.value = failState(e);
  }
});

async function submit() {
  formError.value = '';
  errors.password = validatePassword(form.password);
  errors.confirm = validateConfirm(form.password, form.confirm);
  if (errors.password || errors.confirm) { play('error'); return; }
  loading.value = true;
  try {
    await auth.confirmReset(code, form.password);
    play('success');
    if (auth.isLoggedIn) await auth.logout(); // รหัสเปลี่ยนแล้ว ให้เข้าใหม่
    state.value = 'done';
  } catch (e) {
    play('error');
    if (e.code === 'auth/weak-password' || e.code === 'auth/password-does-not-meet-requirements') errors.password = 'รหัสผ่านไม่ตรงตามเงื่อนไข';
    else if (BAD_LINK.includes(e.code)) state.value = 'invalid';
    else if (e.code === 'auth/network-request-failed') formError.value = 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่';
    else formError.value = 'ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่';
  } finally {
    loading.value = false;
  }
}

const toLogin = () => { play('click'); router.replace(auth.isLoggedIn ? '/menu' : '/login'); };
</script>

<template>
  <AuthLayout>
    <h1 class="title">{{ title }}</h1>
    <p v-if="state === 'form' && email" class="for">สำหรับบัญชี <b>{{ email }}</b></p>

    <LoadingScreen v-if="showLoader" :done="state !== 'checking'" label="กำลังตรวจสอบลิงก์" @finished="showLoader = false" />

    <form v-if="state === 'form'" class="form" novalidate @submit.prevent="submit">
      <FormField
        v-model="form.password"
        label="รหัสผ่านใหม่"
        type="password"
        icon="lock"
        autocomplete="new-password"
        placeholder="รหัสผ่านใหม่ (8 ตัวขึ้นไป)"
        :error="errors.password"
        @update:model-value="errors.password = ''"
      >
        <template #trailing><PasswordRules :password="form.password" /></template>
      </FormField>
      <FormField
        v-model="form.confirm"
        label="ยืนยันรหัสผ่าน"
        type="password"
        icon="lock"
        autocomplete="new-password"
        placeholder="ยืนยันรหัสผ่านใหม่"
        :error="errors.confirm"
        @update:model-value="errors.confirm = ''"
      />
      <p v-if="formError" class="alert alert--error" role="alert">{{ formError }}</p>
      <button class="btn btn--block" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner" />
        <span>บันทึกรหัสผ่านใหม่</span>
      </button>
    </form>

    <div v-else-if="state !== 'checking'" class="status">
      <template v-if="state === 'done'">
        <p class="alert alert--ok">ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่</p>
      </template>
      <template v-else-if="state === 'verified'">
        <p class="alert alert--ok">ยืนยันอีเมลเรียบร้อยแล้ว</p>
      </template>
      <template v-else-if="state === 'invalid'">
        <p class="alert alert--error">ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว (ลิงก์มีอายุ 1 ชั่วโมง และใช้ได้ครั้งเดียว) กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ</p>
      </template>
      <template v-else>
        <p class="alert alert--error">เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วเปิดลิงก์ใหม่อีกครั้ง</p>
      </template>
      <button class="btn btn--block" type="button" @click="toLogin">{{ auth.isLoggedIn ? 'ไปหน้าหลัก' : 'ไปหน้าเข้าสู่ระบบ' }}</button>
    </div>
  </AuthLayout>
</template>

<style scoped>
.title { font-size: 1.8rem; font-weight: 700; color: var(--accent); text-align: center; margin-bottom: 0.8rem; }
.for { text-align: center; color: var(--text-muted); font-size: 0.92rem; margin: -0.4rem 0 0.6rem; word-break: break-all; }
.form, .status { display: flex; flex-direction: column; gap: var(--gap); }
.status { align-items: stretch; }
.status > .spinner.big { align-self: center; width: 2rem; height: 2rem; color: var(--leaf); }
.status p:not(.alert) { text-align: center; color: var(--text-muted); }
.spinner {
  display: inline-block; width: 1.1em; height: 1.1em;
  border: 2.5px solid currentColor; border-right-color: transparent; border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@media (max-height: 400px) { .title { font-size: 1.35rem; margin-bottom: 0.25rem; } }
</style>
