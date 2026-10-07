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
const sentTo = ref('');

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
    await auth.requestPasswordReset(email.value);
    sentTo.value = email.value.trim();
    sent.value = true;
    play('success');
  } catch (e) {
    play('error');
    if (e.code === 'auth/invalid-email') error.value = 'รูปแบบอีเมลไม่ถูกต้อง';
    else if (e.code === 'auth/too-many-requests') formError.value = 'ขอลิงก์หลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
    else if (e.code === 'auth/network-request-failed') formError.value = 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่อีกครั้ง';
    else if (e.code === 'app/not-configured') formError.value = 'ยังไม่ได้ตั้งค่า Firebase';
    else formError.value = 'ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseModal :open="open" title="ลืมรหัสผ่าน" width="23rem" @close="emit('close')">
    <Transition name="swap" mode="out-in">
      <!-- กรอกอีเมล -->
      <form v-if="!sent" key="form" class="fp" novalidate @submit.prevent="submit">
        <span class="badge" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z M12 15v2.5" /></svg>
        </span>
        <p class="lead">กรอกอีเมลที่ใช้สมัคร<br />เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้</p>
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
          <span>{{ loading ? 'กำลังส่ง...' : 'ส่งลิงก์' }}</span>
        </button>
      </form>

      <!-- ส่งแล้ว -->
      <div v-else key="sent" class="fp sent">
        <span class="badge ok" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3.5 6.5h17v11h-17z M4 7l8 6 8-6" /></svg>
          <i><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg></i>
        </span>
        <h4>เช็กอีเมลของคุณ</h4>
        <p class="lead">ถ้ามีบัญชีนี้ เราส่งลิงก์ไปที่</p>
        <span class="to">{{ sentTo }}</span>
        <ul class="tips">
          <li>
            <svg viewBox="0 0 24 24"><path d="M3 7h18l-2 13H5z M8 7V4h8v3" /></svg>
            ไม่เจอ? ดูในโฟลเดอร์สแปม
          </li>
          <li>
            <svg viewBox="0 0 24 24"><path d="M12 7v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /></svg>
            ลิงก์ใช้ได้ 1 ชั่วโมง
          </li>
        </ul>
        <button class="btn btn--block" type="button" @click="emit('close')">กลับไปเข้าสู่ระบบ</button>
        <button class="again" type="button" :disabled="loading" @click="submit">ส่งลิงก์อีกครั้ง</button>
      </div>
    </Transition>
  </BaseModal>
</template>

<style scoped>
.fp { display: flex; flex-direction: column; align-items: stretch; gap: 1rem; padding: 0.4rem 0.2rem 0.2rem; }
svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* ไอคอนวงกลมด้านบน */
.badge {
  position: relative; align-self: center; width: 3.6rem; height: 3.6rem; border-radius: 50%;
  display: grid; place-items: center; color: var(--leaf, #3a7d2c);
  background: radial-gradient(circle at 35% 30%, #ffffff, #e6f4df 70%);
  border: 2px solid #cfe8c6; box-shadow: 0 6px 16px rgba(58, 125, 44, 0.16);
  animation: pop 0.5s var(--ease-back);
}
.badge > svg { width: 1.7rem; height: 1.7rem; }
.badge i {
  position: absolute; right: -0.2rem; bottom: -0.15rem; width: 1.5rem; height: 1.5rem; border-radius: 50%;
  display: grid; place-items: center; background: var(--leaf, #3a7d2c); color: #fff; border: 2px solid #fff;
}
.badge i svg { width: 0.85rem; height: 0.85rem; stroke-width: 3; }

.lead { margin: 0; text-align: center; color: var(--text-muted); font-size: 0.95rem; line-height: 1.55; }
.sent { align-items: center; text-align: center; gap: 0.7rem; }
.sent h4 { margin: 0.3rem 0 0; font-family: var(--font-head); font-size: 1.3rem; font-weight: 700; color: #2f5a3a; }
.sent .lead { margin-top: -0.2rem; }
.to {
  max-width: 100%; padding: 0.35rem 0.95rem; border-radius: 999px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 700; color: #2f5a3a; background: #f1f8ed; border: 1.5px solid #d5ebcb;
}
.tips { list-style: none; margin: 0.4rem 0 0.5rem; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
.tips li {
  display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.7rem; border-radius: 999px;
  font-size: 0.8rem; color: var(--text-muted); background: #f6f7f4;
}
.tips svg { width: 0.95rem; height: 0.95rem; color: var(--leaf, #3a7d2c); }
.sent .btn { width: 100%; }
.again {
  margin-top: -0.1rem; padding: 0.3rem 0.6rem; background: none; border: 0; cursor: pointer;
  font-family: var(--font-head); font-size: 0.88rem; color: var(--accent); text-decoration: underline; text-underline-offset: 3px;
}
.again:disabled { opacity: 0.5; cursor: wait; }

.swap-enter-active, .swap-leave-active { transition: opacity 0.2s, transform 0.2s; }
.swap-enter-from { opacity: 0; transform: translateX(10px); }
.swap-leave-to { opacity: 0; transform: translateX(-10px); }
@keyframes pop { from { transform: scale(0.4); opacity: 0; } }

/* โทรศัพท์แนวนอน */
@media (max-height: 500px) {
  .fp { gap: 0.75rem; padding-top: 0.2rem; }
  .sent { gap: 0.5rem; }
  .badge { width: 2.8rem; height: 2.8rem; }
  .badge > svg { width: 1.35rem; height: 1.35rem; }
  .badge i { width: 1.2rem; height: 1.2rem; }
  .lead { font-size: 0.84rem; }
  .sent h4 { font-size: 1.05rem; margin-top: 0.1rem; }
  .to { font-size: 0.84rem; padding: 0.25rem 0.8rem; }
  .tips { margin: 0.2rem 0 0.3rem; }
  .tips li { font-size: 0.72rem; padding: 0.22rem 0.6rem; }
  .again { font-size: 0.78rem; padding: 0.15rem 0.5rem; }
}
</style>
