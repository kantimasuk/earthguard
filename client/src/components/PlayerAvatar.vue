<script setup>
// รูปประจำตัวผู้เล่น: AI = รูปของทีม (assets/ui/ai-*.png) หรือไอคอนธรรมชาติในวงกลมสี
//                  ผู้เล่นจริง = รูปโปรไฟล์ (หรือตัวอักษรแรกของชื่อ)
import { computed, ref } from 'vue';
import { AVATARS, HUMAN_COLOR, aiImage } from '@/game/avatars';

const props = defineProps({
  isAi: { type: Boolean, default: false },
  avatar: { type: String, default: null }, // AI: leaf|water|mountain|wind, คน: URL รูป
  name: { type: String, default: '' },
  size: { type: String, default: '2.4rem' },
  active: { type: Boolean, default: false },
});
const broken = ref(false);
const look = computed(() => (props.isAi ? AVATARS[props.avatar] || AVATARS.leaf : HUMAN_COLOR));
const aiPic = computed(() => (props.isAi ? aiImage(props.avatar) : null));
const initial = computed(() => (props.name || '?').trim().charAt(0));
</script>

<template>
  <span class="av" :class="{ active }" :style="{ '--s': size, '--bg': look.bg, '--ring': look.ring, '--ink': look.ink }">
    <img v-if="aiPic" :src="aiPic" alt="" class="ai" />
    <svg v-else-if="isAi" viewBox="0 0 24 24" aria-hidden="true"><path :d="look.path" /></svg>
    <img v-else-if="avatar && !broken" :src="avatar" alt="" referrerpolicy="no-referrer" @error="broken = true" />
    <b v-else>{{ initial }}</b>
  </span>
</template>

<style scoped>
.av {
  width: var(--s); height: var(--s); flex: none; border-radius: 50%;
  display: inline-grid; place-items: center; overflow: hidden;
  background: var(--bg); border: 2px solid var(--ring);
  box-shadow: 0 2px 6px rgba(20, 50, 20, 0.15);
}
.av svg { width: 62%; height: 62%; fill: none; stroke: var(--ink); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.av img { width: 100%; height: 100%; object-fit: cover; }
.av b { font-family: var(--font-head); font-weight: 700; color: var(--ink); font-size: calc(var(--s) * 0.45); }
.av.active { box-shadow: 0 0 0 3px #ffffff, 0 0 0 5px #ffd24d, 0 0 16px 4px rgba(255, 210, 77, 0.8); }
</style>
