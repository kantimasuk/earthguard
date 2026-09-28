<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '@/components/AuthLayout.vue';
import FormField from '@/components/FormField.vue';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import PasswordRules from '@/components/PasswordRules.vue';
import { validatePassword, validateConfirm } from '@/utils/validation';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { play } from '@/services/sound';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const token = typeof route.query.token === 'string' ? route.query.token : '';

const state = ref('checking'); // checking | form | invalid | done | offline
const form = reactive({ password: '', confirm: '' });
const errors = reactive({ password: '', confirm: '' });
const formError = ref('');
const loading = ref(false);
const showLoader = ref(true); // หน้าโหลดเต็มจอระหว่างตรวจสอบลิงก์

onMounted(async () => {
  if (!token) { state.value = 'invalid'; return; }
  try {
    const { valid } = await api(`/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`, { auth: false });
    state.value = valid ? 'form' : 'invalid';
  } catch {
    state.value = 'offline';
  }
});

async function submit() {
  formError.value = '';
  errors.password = validatePassword(form.password);
  errors.confirm = validateConfirm(form.password, form.confirm);
  if (errors.password || errors.confirm) { play('error'); return; }
  loading.value = true;
  try {
    await api('/api/auth/reset-password', { method: 'POST', body: { token, password: form.password }, auth: false });
    play('success');
    if (auth.isLoggedIn) await auth.logout(); // รหัสเปลี่ยนแล้ว ให้เข้าใหม่
    state.value = 'done';
  } catch (e) {
    play('error');
    if (e.code === 'INVALID_OR_EXPIRED') state.value = 'invalid';
    else if (e.code === 'WEAK_PASSWORD') errors.password = 'รหัสผ่านไม่ตรงตามเงื่อนไข';
    else formError.value = 'ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่';
  } finally {
    loading.value = false;
  }
}

const toLogin = () => { play('click'); router.replace('/login'); };
</script>

<template>
  <AuthLayout>
    <h1 class="title">ตั้งรหัสผ่านใหม่</h1>

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
      <template v-else-if="state === 'invalid'">
        <p class="alert alert--error">ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว (ลิงก์มีอายุ 30 นาที และใช้ได้ครั้งเดียว) กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ</p>
      </template>
      <template v-else>
        <p class="alert alert--error">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง</p>
      </template>
      <button class="btn btn--block" type="button" @click="toLogin">ไปหน้าเข้าสู่ระบบ</button>
    </div>
  </AuthLayout>
</template>

<style scoped>
.title { font-size: 1.8rem; font-weight: 700; color: var(--accent); text-align: center; margin-bottom: 0.8rem; }
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
