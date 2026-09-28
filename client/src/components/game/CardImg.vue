<script setup>
// รูปการ์ด (ใช้ภาพเดียวกับที่ Phaser วาด) — art มาจาก provide('cardArt') ใน GameView
import { inject } from 'vue';

defineProps({
  id: { type: String, default: null }, // null = หลังการ์ด
  width: { type: String, default: '4.2rem' },
  dim: { type: Boolean, default: false },
});
const art = inject('cardArt');
</script>

<template>
  <img class="card-img" :class="{ dim }" :src="art.url(id)" :style="{ width }" alt="" draggable="false" />
</template>

<style scoped>
.card-img { display: block; height: auto; aspect-ratio: 200 / 280; border-radius: 7%; box-shadow: 0 3px 10px rgba(20, 40, 20, 0.22); flex: none; }
.dim { filter: grayscale(0.7) opacity(0.55); }
</style>
