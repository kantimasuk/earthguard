<script setup>
// ============================================================
// ฉากจบเกม "โลกถึงจุดพลิกผัน" — ภาพ 3 ฉากต่อกันแบบภาพยนตร์ (ยิ่งใหญ่ ดราม่า)
// ============================================================
// รูปของทีม: src/assets/ui/end-1 · end-2 · end-3  (เรียงตามลำดับที่แสดง — อยากสลับลำดับ แก้ชื่อไฟล์ได้เลย)
// แต่ละฉาก (~3.7 วินาที): ภาพค่อย ๆ ซูมเข้าช้า ๆ (Ken Burns) · เปลี่ยนฉากด้วยแรงกระแทก (จอสั่น + มืดวูบ) · คำบรรยายของฉาก
// เอฟเฟกต์ซ้อน: ฉาก 1 ฝนตกหนัก · ฉาก 2 เศษหินลอยขึ้น · ฉาก 3 ลูกไฟ/เถ้าถ่าน + ขอบจอแดงเต้นเป็นจังหวะ
// stage 'show' = เล่นฉาก · 'splash' = ภาพประกาศจบเกมขึ้นทับ (คำบรรยายหายไป ไม่ทับข้อความ)
import { computed } from 'vue';
import { uiImg } from '@/services/uiArt';

const props = defineProps({
  // { id, scene: 0 | 1 | 2, stage: 'show' | 'splash' }
  show: { type: Object, default: null },
});

const SCENES = [
  { img: uiImg('end-1'), cap: 'ภัยพิบัติถาโถม... น้ำท่วมกลืนเมือง', fx: 'rain' },
  { img: uiImg('end-2'), cap: 'โลกเริ่มแตกร้าว ทุกสิ่งพังทลาย', fx: 'rocks' },
  { img: uiImg('end-3'), cap: 'จุดพลิกผัน! โลกไม่อาจย้อนกลับได้อีกแล้ว', fx: 'fire' },
];
const cur = computed(() => (props.show ? SCENES[props.show.scene] : null));

const rnd = (i, m) => (((i * 9301 + 49297) % 233280) / 233280) * m;
const rain = Array.from({ length: 70 }, (_, i) => ({ x: rnd(i, 110) - 5, d: rnd(i + 7, 1), t: 0.45 + rnd(i + 13, 0.35), h: 40 + rnd(i + 17, 50) }));
const rocks = Array.from({ length: 16 }, (_, i) => ({ x: rnd(i + 3, 100), d: rnd(i + 11, 3), t: 3 + rnd(i + 19, 3), s: 6 + rnd(i + 23, 18), r: rnd(i + 29, 360) }));
const embers = Array.from({ length: 40 }, (_, i) => ({ x: rnd(i + 5, 100), d: rnd(i + 31, 3), t: 2 + rnd(i + 37, 2.5), s: 3 + rnd(i + 41, 5) }));
</script>

<template>
  <Transition name="end-fade">
    <div v-if="show" class="endshift" :class="[`s${show.scene}`, show.stage]" aria-live="assertive">
      <!-- ภาพทั้ง 3 ฉาก ซ้อนกัน → ฉากปัจจุบันเฟดเข้า + ซูมช้า ๆ -->
      <div
        v-for="(s, i) in SCENES"
        :key="i"
        class="pic"
        :class="{ on: i === show.scene, past: i < show.scene }"
        :style="s.img ? { backgroundImage: `url(${s.img})` } : null"
      />
      <div class="vig" />

      <div v-if="cur?.fx === 'rain'" :key="'r' + show.id" class="rain">
        <i v-for="(p, i) in rain" :key="i" :style="{ left: p.x + '%', height: p.h + 'px', animationDelay: -p.d + 's', animationDuration: p.t + 's' }" />
      </div>
      <div v-if="cur?.fx === 'rocks'" class="rocks">
        <i v-for="(p, i) in rocks" :key="i" :style="{ left: p.x + '%', width: p.s + 'px', height: p.s * 0.8 + 'px', '--r': p.r + 'deg', animationDelay: -p.d + 's', animationDuration: p.t + 's' }" />
      </div>
      <div v-if="cur?.fx === 'fire'" class="embers">
        <i v-for="(p, i) in embers" :key="i" :style="{ left: p.x + '%', width: p.s + 'px', height: p.s + 'px', animationDelay: -p.d + 's', animationDuration: p.t + 's' }" />
      </div>
      <div v-if="cur?.fx === 'fire'" class="redpulse" />

      <!-- แรงกระแทกตอนเปลี่ยนฉาก: มืดวูบ (ไม่ใช่แสงแฟลชขาว) -->
      <div :key="'hit' + show.scene" class="hit" />

      <Transition name="cap" mode="out-in">
        <p v-if="show.stage !== 'splash' && cur" :key="show.scene" class="cap"><span>{{ cur.cap }}</span></p>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.endshift { position: fixed; inset: 0; z-index: 44; overflow: hidden; pointer-events: none; background: #120a08; }
.pic {
  position: absolute; inset: -4%;
  background-size: cover; background-position: center;
  opacity: 0; transform: scale(1.0);
  transition: opacity 1.1s ease;
}
.pic.on { opacity: 1; animation: kenburns 5.5s ease-out forwards, quake 0.5s linear 0s 1; }
.pic.past { opacity: 0; }
.s0 .pic.on { transform-origin: 40% 60%; }
.s1 .pic.on { transform-origin: 50% 40%; }
.s2 .pic.on { transform-origin: 50% 45%; animation: kenburns 6s ease-out forwards, quake-hard 0.28s linear infinite; }
@keyframes kenburns { from { transform: scale(1.0); } to { transform: scale(1.12); } }
@keyframes quake {
  0%, 100% { translate: 0 0; }
  20% { translate: -10px 6px; }
  40% { translate: 9px -7px; }
  60% { translate: -6px -4px; }
  80% { translate: 5px 5px; }
}
@keyframes quake-hard {
  0%, 100% { translate: 0 0; }
  25% { translate: -4px 3px; }
  50% { translate: 3px -3px; }
  75% { translate: -2px -2px; }
}
.vig { position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.55) 100%); }

/* ฉาก 1: ฝนตกหนัก (เส้นเฉียง) */
.rain i {
  position: absolute; top: -12%; width: 2px; border-radius: 2px;
  background: linear-gradient(180deg, rgba(220, 235, 255, 0), rgba(220, 235, 255, 0.75));
  transform: rotate(12deg); animation: rain linear infinite;
}
@keyframes rain { to { translate: -14vh 125vh; } }

/* ฉาก 2: เศษหินลอยขึ้นหมุนคว้าง */
.rocks i {
  position: absolute; bottom: -6%; border-radius: 30% 45% 35% 50%;
  background: linear-gradient(140deg, #8a6a52, #4a3426);
  box-shadow: 0 0 6px rgba(255, 190, 90, 0.5);
  animation: rock-up ease-in infinite;
}
@keyframes rock-up {
  from { transform: translateY(0) rotate(0deg); opacity: 0; }
  12% { opacity: 1; }
  to { transform: translateY(-115vh) rotate(var(--r)); opacity: 0.8; }
}

/* ฉาก 3: ลูกไฟลอยขึ้น + ขอบจอแดงเต้นเหมือนหัวใจ */
.embers i {
  position: absolute; bottom: -3%; border-radius: 50%;
  background: #ffbe5c; box-shadow: 0 0 10px 4px rgba(255, 90, 30, 0.85);
  animation: ember ease-out infinite;
}
@keyframes ember {
  from { transform: translate(0, 0) scale(1); opacity: 0; }
  15% { opacity: 1; }
  to { transform: translate(40px, -95vh) scale(0.3); opacity: 0; }
}
.redpulse { position: absolute; inset: 0; box-shadow: inset 0 0 18vmin rgba(200, 20, 10, 0.75); animation: beat 1.1s ease-in-out infinite; }
@keyframes beat { 0%, 100% { opacity: 0.45; } 15% { opacity: 1; } 30% { opacity: 0.6; } 45% { opacity: 0.95; } }

/* แรงกระแทกเปลี่ยนฉาก: มืดวูบแล้วจาง */
.hit { position: absolute; inset: 0; background: #000; animation: hit 0.9s ease-out forwards; }
@keyframes hit { 0% { opacity: 0.85; } 100% { opacity: 0; } }

/* คำบรรยาย */
.cap { position: absolute; left: 0; right: 0; bottom: 14%; margin: 0; text-align: center; padding: 0 1rem; }
.cap span {
  display: inline-block; padding: 0.6rem 1.6rem; border-radius: 999px;
  font-family: var(--font-head); font-weight: 700; font-size: clamp(1.05rem, 2.8vw, 1.8rem); color: #fff;
  background: rgba(30, 12, 8, 0.66); border: 2px solid rgba(255, 255, 255, 0.5);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.4); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
}
.s2 .cap span { background: rgba(130, 18, 12, 0.78); }
.cap-enter-active { transition: opacity 0.6s ease 0.5s, transform 0.6s var(--ease-back) 0.5s; }
.cap-leave-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.cap-enter-from { opacity: 0; transform: translateY(20px) scale(0.9); }
.cap-leave-to { opacity: 0; transform: translateY(-10px); }

/* ภาพประกาศจบเกมขึ้นทับ → เอฟเฟกต์จางลง */
.splash .rain, .splash .rocks, .splash .embers { opacity: 0.4; transition: opacity 0.6s; }

.end-fade-enter-active { transition: opacity 0.8s ease; }
.end-fade-leave-active { transition: opacity 1s ease; }
.end-fade-enter-from, .end-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .pic.on, .s2 .pic.on, .rain i, .rocks i, .embers i, .redpulse { animation: none; }
}
</style>
