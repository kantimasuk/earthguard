<script setup>
import { watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SceneBackground from '@/components/SceneBackground.vue';
import RotateOverlay from '@/components/RotateOverlay.vue';
import ToastHost from '@/components/ToastHost.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

// ถ้าหลุดจากระบบ (เช่น รีเซ็ตรหัสผ่านจากอีกเครื่อง) ขณะอยู่หน้าที่ต้อง login → กลับหน้า Login
watch(() => auth.user, (u) => {
  if (!u && route.meta.requiresAuth) router.replace({ name: 'login' });
});
</script>

<template>
  <SceneBackground :calm="route.meta.requiresAuth === true" />
  <router-view v-slot="{ Component, route: r }">
    <Transition name="page" mode="out-in">
      <component :is="Component" :key="r.name" />
    </Transition>
  </router-view>
  <ToastHost />
  <RotateOverlay />
</template>
