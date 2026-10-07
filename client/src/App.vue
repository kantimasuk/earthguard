<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SceneBackground from '@/components/SceneBackground.vue';
import RotateOverlay from '@/components/RotateOverlay.vue';
import ToastHost from '@/components/ToastHost.vue';
import PrivacyModal from '@/components/PrivacyModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useToastStore } from '@/stores/toast';
import { play } from '@/services/sound';
import { setMusic } from '@/services/music';

const auth = useAuthStore();
const app = useAppStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();

// ถ้าหลุดจากระบบ (เช่น รีเซ็ตรหัสผ่านจากอีกเครื่อง) ขณะอยู่หน้าที่ต้อง login → กลับหน้า Login
// เพลงประกอบ: ทุกหน้า (ยกเว้นหน้าเล่นเกม ซึ่งเลือกเพลงตามช่วงเอง) = เพลงผ่อนคลาย
watch(() => route.name, (n) => { if (n && n !== 'game') setMusic('menu'); }, { immediate: true });

watch(() => auth.user, (u) => {
  if (!u && route.meta.requiresAuth) router.replace({ name: 'login' });
});

// ---------- นโยบายความเป็นส่วนตัว ----------
// ขอความยินยอม: แสดงครั้งเดียวต่อบัญชี (และอีกครั้งเมื่อเปลี่ยนเวอร์ชันนโยบาย)
// ขึ้นเมื่อเข้าหน้าที่ต้อง login ครั้งแรก (ปกติคือหน้าเลือกโหมด) ไม่ขึ้นกลางเกม
// ผู้ที่สมัครด้วยอีเมลยอมรับไปแล้วในหน้าสมัคร จึงไม่เห็นซ้ำ
const consentOpen = computed(() => auth.needsPrivacy && route.meta.requiresAuth === true && route.name !== 'game');
const consentBusy = ref(false);
const consentError = ref('');
async function acceptPrivacy() {
  consentBusy.value = true;
  consentError.value = '';
  try {
    await auth.acceptPrivacy();
    play('success');
  } catch {
    consentError.value = 'บันทึกไม่สำเร็จ กรุณาลองใหม่';
  } finally {
    consentBusy.value = false;
  }
}
async function declinePrivacy() {
  consentBusy.value = true;
  try {
    await auth.logout();
    toast.show('ต้องยอมรับนโยบายความเป็นส่วนตัวก่อนจึงจะใช้งานได้', { type: 'error' });
  } finally {
    consentBusy.value = false;
  }
}
</script>

<template>
  <SceneBackground :calm="route.meta.requiresAuth === true" />
  <router-view v-slot="{ Component, route: r }">
    <Transition name="page" mode="out-in">
      <component :is="Component" :key="r.name" />
    </Transition>
  </router-view>
  <ToastHost />
  <PrivacyModal :open="app.privacyOpen && !consentOpen" @close="app.privacyOpen = false" />
  <PrivacyModal :open="consentOpen" mode="consent" :busy="consentBusy" :error="consentError" @accept="acceptPrivacy" @decline="declinePrivacy" />
  <RotateOverlay />
</template>
