<script setup>
import { ref, watch } from 'vue';
import BaseModal from './BaseModal.vue';
import FormField from './FormField.vue';
import { validateEmail } from '@/utils/validation';
import { useAuthStore } from '@/stores/auth';
import { play } from '@/services/sound';

const props = defineProps({ open: Boolean, initialEmail: { type: String, default: '' } });
const emit = defineEmits(['close']);
const auth = useAuthStore();

const email = ref('');
const error = ref('');
const formError = ref('');
const loading = ref(false);
const sent = ref(false);
const sentMessage = ref('');

watch(() => props.open, (v) => {
  if (v) {
    email.value = props.initialEmail;
    error.value = '';
    formError.value = '';
    sent.value = false;
  }
});

async function submit() {
  formError.value = '';
  error.value = validateEmail(email.value);
  if (error.value) { play('error'); return; }
  loading.value = true;
  try {
    const res = await auth.requestPasswordReset(email.value);
    sentMessage.value = res.message || 'ถ้ามีบัญชีนี้ ระบบได้ส่งลิงก์ไปแล้ว';
    sent.value = true;
    play('success');
  } catch (e) {
    play('error');
    formError.value = e.code === 'TOO_MANY_REQUESTS'
      ? 'ขอลิงก์หลายครั้งเกินไป กรุณารอประมาณ 15 นาทีแล้วลองใหม่'
      : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="ลืมรหัสผ่าน" width="25rem" @close="emit('close')">
    <Transition name="swap" mode="out-in">
      <form v-if="!sent" key="form" class="stack" novalidate @submit.prevent="submit">
        <p class="desc">กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้ทางอีเมล</p>
        <FormField
          v-model="email"
          label="อีเมล"
            type="email"
          icon="mail"
          inputmode="email"
          autocomplete="email"
          placeholder="อีเมลที่ใช้สมัคร"
          :error="error"
          @update:model-value="error = ''"
        />
        <p v-if="formError" class="alert alert--error" role="alert">{{ formError }}</p>
        <button class="btn btn--block" type="submit" :disabled="loading">
          <span v-if="loading" class="spinner" />
          <span>{{ loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่' }}</span>
        </button>
      </form>

      <div v-else key="sent" class="stack sent">
        <div class="mail-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round">
            <rect x="6" y="11" width="36" height="26" rx="4" /><path d="m7 13 17 13 17-13" />
          </svg>
        </div>
        <p class="big">{{ sentMessage }}</p>
        <p class="desc">ตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์สแปม) ลิงก์มีอายุ 30 นาที และใช้ได้ครั้งเดียว</p>
        <button class="btn btn--block" type="button" @click="emit('close')">กลับไปเข้าสู่ระบบ</button>
      </div>
    </Transition>
  </BaseModal>
</template>

<style scoped>
.stack { display: flex; flex-direction: column; gap: var(--gap); }
.desc { color: var(--text-muted); font-size: 0.92rem; line-height: 1.4; }
.sent { align-items: center; text-align: center; }
.mail-icon {
  width: 3.4rem; height: 3.4rem; border-radius: 50%; display: grid; place-items: center;
  background: var(--leaf-light); color: var(--accent);
  animation: pop 0.5s var(--ease-back);
}
.mail-icon svg { width: 60%; height: 60%; }
.big { font-family: var(--font-head); font-size: 1.1rem; font-weight: 500; }
.swap-enter-active, .swap-leave-active { transition: opacity 0.2s, transform 0.2s; }
.swap-enter-from { opacity: 0; transform: translateX(10px); }
.swap-leave-to { opacity: 0; transform: translateX(-10px); }
@keyframes pop { from { transform: scale(0.4); opacity: 0; } }
</style>
