<script setup>
// ============================================================
// แอนิเมชัน "สิ่งแวดล้อมแย่ลง" ตอนเปลี่ยนช่วงเกม (ช่วงที่ 2 / 3)
// ============================================================
// ลำดับ (ประมาณ 12.5 วินาที — GameView คุมจังหวะ):
//   stage 'shift'  : เอฟเฟกต์ทั้งหมด + คำบรรยาย
//   stage 'splash' : ภาพประกาศช่วงขึ้นทับ → คำบรรยาย/หลอดหายไป (ไม่ทับข้อความของภาพประกาศ) เอฟเฟกต์จางลง
// ตอนนี้ UI ทั้งหมดหายไป (GameView ซ่อนให้) เหลือแค่ฉากพื้นหลัง แล้วเล่นเอฟเฟกต์ทับฉาก:
//   - หมอกควันสีหม่นไหลลงมาจากท้องฟ้า · ดวงอาทิตย์ถูกควันกลืนจนหม่น
//   - กลุ่มควันพวยพุ่งขึ้นจากพื้นดิน ขยายตัวใหญ่ขึ้นเรื่อย ๆ
//   - ช่วง 2: ฝุ่นละอองและใบไม้แห้งร่วงหล่น · โทนส้มร้อนระอุ
//   - ช่วง 3: เถ้าถ่าน + ลูกไฟลอยขึ้น · โทนแดง · จอสั่นแรง
//   - ฉากพื้นหลังทั้งฉากค่อย ๆ ซีด/มืดลง และสั่น (ผ่านคลาส body.env-shift — ดูสไตล์ท้ายไฟล์)
// ใช้ CSS ล้วน ไม่มีไลบรารีเพิ่ม · ค่าสุ่มคำนวณครั้งเดียว (ตำแหน่งคงที่ ไม่กระตุก)
import { computed, watch, onBeforeUnmount } from 'vue';

const props = defineProps({
  // { phase: 2 | 3, id }
  shift: { type: Object, default: null },
});

const CAPTION = {
  2: 'มลพิษเริ่มคืบคลาน... สิ่งแวดล้อมกำลังเสื่อมโทรม',
  3: 'วิกฤต! โลกใกล้ถึงจุดพลิกผัน',
};
const caption = computed(() => (props.shift ? CAPTION[props.shift.phase] : ''));

const rnd = (i, m) => ((i * 9301 + 49297) % 233280) / 233280 * m;
const plumes = Array.from({ length: 9 }, (_, i) => ({
  x: 4 + i * 11.5 + rnd(i, 5),
  s: 18 + rnd(i + 3, 16),
  d: (i % 3) * 0.35 + rnd(i + 7, 0.3),
  t: 2.6 + rnd(i + 11, 1.2),
}));
const specks = Array.from({ length: 46 }, (_, i) => ({
  x: rnd(i + 1, 100),
  d: rnd(i + 21, 2.2),
  t: 2.2 + rnd(i + 31, 1.8),
  s: 3 + rnd(i + 41, 5),
  w: rnd(i + 51, 40) - 20,
}));
const leaves = Array.from({ length: 14 }, (_, i) => ({
  x: rnd(i + 61, 100),
  d: 0.3 + rnd(i + 71, 1.8),
  t: 2.6 + rnd(i + 81, 1.4),
  s: 12 + rnd(i + 91, 10),
  r: rnd(i + 101, 720) - 360,
  c: ['#b07a2a', '#8a5a1e', '#c9973e', '#7a4f1a'][i % 4],
}));
const embers = Array.from({ length: 30 }, (_, i) => ({
  x: rnd(i + 111, 100),
  d: rnd(i + 121, 2.4),
  t: 1.8 + rnd(i + 131, 1.6),
  s: 3 + rnd(i + 141, 4),
}));

// คลาสบน <body>: ให้ฉากพื้นหลัง (คอมโพเนนต์อื่น) ซีด/มืด/สั่นตาม
function setBody(v) {
  const b = document.body.classList;
  b.toggle('env-shift', Boolean(v));
  b.toggle('env-p3', Boolean(v && v.phase >= 3));
}
watch(() => props.shift, setBody, { immediate: true });
onBeforeUnmount(() => setBody(null));
</script>

<template>
  <Transition name="env">
    <div v-if="shift" :key="shift.id" class="env" :class="[`p${shift.phase}`, shift.stage]" aria-live="assertive">
      <div class="heat" />
      <div class="smog" />
      <div class="sun"><i /></div>

      <div class="plumes">
        <i v-for="(p, i) in plumes" :key="i" :style="{ left: p.x + '%', '--s': p.s + 'vmin', animationDelay: p.d + 's', animationDuration: p.t + 's' }" />
      </div>

      <!-- ช่วง 2: ฝุ่น + ใบไม้แห้ง · ช่วง 3: เถ้าถ่าน + ลูกไฟ -->
      <div class="specks">
        <i v-for="(p, i) in specks" :key="i" :style="{ left: p.x + '%', width: p.s + 'px', height: p.s + 'px', '--w': p.w + 'px', animationDelay: p.d + 's', animationDuration: p.t + 's' }" />
      </div>
      <div v-if="shift.phase === 2" class="leaves">
        <i v-for="(p, i) in leaves" :key="i" :style="{ left: p.x + '%', width: p.s + 'px', height: p.s * 0.6 + 'px', background: p.c, '--r': p.r + 'deg', animationDelay: p.d + 's', animationDuration: p.t + 's' }" />
      </div>
      <div v-else class="embers">
        <i v-for="(p, i) in embers" :key="i" :style="{ left: p.x + '%', width: p.s + 'px', height: p.s + 'px', animationDelay: p.d + 's', animationDuration: p.t + 's' }" />
      </div>


      <!-- ข้อมูล (หายไปตอนภาพประกาศช่วงขึ้น ไม่ให้ข้อความทับกัน) -->
      <Transition name="info">
        <div v-if="shift.stage !== 'splash'" class="info">
          <p class="cap"><span>{{ caption }}</span></p>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.env {
  --tone: 190, 110, 40;
  position: fixed; inset: 0; z-index: 44; pointer-events: none; overflow: hidden;
  animation: rumble 0.5s linear infinite;
}
.env.p3 { --tone: 170, 30, 20; animation-duration: 0.22s; }
/* ตอนภาพประกาศช่วงขึ้น: เอฟเฟกต์จางลง ให้ภาพประกาศเด่น */
.env.splash .plumes, .env.splash .specks, .env.splash .leaves, .env.splash .embers { opacity: 0.35; transition: opacity 0.6s; }
.env.splash { animation: none; }


.info { position: absolute; inset: 0; pointer-events: none; }
.info-leave-active { transition: opacity 0.45s ease, transform 0.45s ease; }
.info-leave-to { opacity: 0; transform: translateY(-12px); }

/* ไอร้อน/โทนสีของช่วง ค่อย ๆ เข้มขึ้น */
.heat {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 110%, rgba(var(--tone), 0.55) 0%, rgba(var(--tone), 0.25) 45%, rgba(var(--tone), 0.08) 100%);
  opacity: 0; animation: heat-in 8s ease-out forwards;
}
.p3 .heat { animation: heat-in 8s ease-out forwards, heat-pulse 0.9s ease-in-out 0.8s infinite; }

/* หมอกควันไหลลงจากท้องฟ้า */
.smog {
  position: absolute; left: -5%; right: -5%; top: -10%; height: 0;
  background: linear-gradient(180deg, rgba(60, 50, 45, 0.85) 0%, rgba(90, 75, 60, 0.6) 45%, rgba(120, 100, 80, 0) 100%);
  filter: blur(6px);
  animation: smog-down 7.5s cubic-bezier(0.3, 0, 0.3, 1) 0.3s forwards;
}
.p3 .smog { background: linear-gradient(180deg, rgba(40, 20, 18, 0.92) 0%, rgba(90, 35, 25, 0.65) 45%, rgba(120, 40, 30, 0) 100%); }

/* ดวงอาทิตย์ที่ค่อย ๆ หม่นและจมหายในควัน */
.sun { position: absolute; right: 12%; top: 9%; width: 16vmin; height: 16vmin; }
.sun i {
  position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(circle, #fff6c4 0%, #ffd34d 55%, rgba(255, 190, 60, 0) 72%);
  animation: sun-die 7.5s ease-in forwards;
}
.p3 .sun i { animation-name: sun-blood; }

/* กลุ่มควันพวยพุ่งขึ้นจากพื้น */
.plumes i {
  position: absolute; bottom: -12vmin; width: var(--s); height: var(--s); margin-left: calc(var(--s) / -2);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(70, 62, 58, 0.75) 0%, rgba(90, 80, 72, 0.45) 45%, rgba(100, 90, 80, 0) 70%);
  filter: blur(4px);
  opacity: 0;
  animation: plume ease-out infinite;
}
.p3 .plumes i { background: radial-gradient(circle, rgba(45, 30, 28, 0.85) 0%, rgba(80, 40, 30, 0.5) 45%, rgba(90, 40, 30, 0) 70%); }

/* ฝุ่น/เถ้า ร่วงพร้อมส่ายไปมา */
.specks i {
  position: absolute; top: -4vh; border-radius: 50%;
  background: rgba(95, 80, 65, 0.8);
  opacity: 0; animation: fall linear infinite;
}
.p3 .specks i { background: rgba(50, 40, 38, 0.9); }

/* ใบไม้แห้งหมุนคว้างร่วงลงมา (ช่วง 2) */
.leaves i {
  position: absolute; top: -6vh; border-radius: 0 100% 0 100%;
  opacity: 0; animation: leaf ease-in infinite;
}

/* ลูกไฟลอยขึ้น (ช่วง 3) */
.embers i {
  position: absolute; bottom: -3vh; border-radius: 50%;
  background: #ffb347; box-shadow: 0 0 8px 3px rgba(255, 110, 30, 0.8);
  opacity: 0; animation: ember ease-out infinite;
}

/* ฟ้าแลบ (ช่วง 3) */

/* คำบรรยายด้านล่าง */
.cap {
  position: absolute; left: 0; right: 0; bottom: 20%; margin: 0; text-align: center;
  opacity: 0; animation: cap-in 0.7s var(--ease-back) 1.6s forwards;
}
.cap span {
  display: inline-block; padding: 0.55rem 1.4rem; border-radius: 999px;
  font-family: var(--font-head); font-weight: 700; font-size: clamp(1rem, 2.6vw, 1.6rem); color: #fff;
  background: rgba(40, 25, 20, 0.62); border: 2px solid rgba(255, 255, 255, 0.55);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.p3 .cap span { background: rgba(120, 20, 15, 0.72); animation: cap-shake 0.3s linear 1.4s infinite; }

.env-leave-active { transition: opacity 0.7s ease; }
.env-leave-to { opacity: 0; }

@keyframes rumble {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(1px, -1px); }
  50% { transform: translate(-1px, 1px); }
  75% { transform: translate(1px, 1px); }
}
@keyframes heat-in { to { opacity: 1; } }
@keyframes heat-pulse { 50% { filter: brightness(1.35); } }
@keyframes smog-down { to { height: 85%; } }
@keyframes sun-die {
  40% { transform: scale(1.05); filter: none; }
  100% { transform: scale(0.8) translateY(30%); filter: grayscale(0.7) brightness(0.55); opacity: 0.35; }
}
@keyframes sun-blood {
  40% { transform: scale(1.08); }
  100% { transform: scale(0.85) translateY(25%); filter: hue-rotate(-40deg) saturate(2) brightness(0.6); opacity: 0.6; }
}
@keyframes plume {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  15% { opacity: 0.85; }
  100% { transform: translateY(-75vh) scale(2.6); opacity: 0; }
}
@keyframes fall {
  0% { transform: translate(0, 0); opacity: 0; }
  10% { opacity: 0.9; }
  50% { transform: translate(var(--w), 55vh); }
  100% { transform: translate(calc(var(--w) * -1), 110vh); opacity: 0.4; }
}
@keyframes leaf {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  35% { transform: translate(40px, 35vh) rotate(calc(var(--r) * 0.4)); }
  70% { transform: translate(-30px, 75vh) rotate(calc(var(--r) * 0.8)); }
  100% { transform: translate(20px, 112vh) rotate(var(--r)); opacity: 0.8; }
}
@keyframes ember {
  0% { transform: translate(0, 0) scale(1); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(30px, -85vh) scale(0.3); opacity: 0; }
}
@keyframes cap-in { from { opacity: 0; transform: translateY(20px) scale(0.85); } to { opacity: 1; transform: none; } }
@keyframes cap-shake { 25% { transform: translate(-2px, 1px); } 75% { transform: translate(2px, -1px); } }

@media (prefers-reduced-motion: reduce) {
  .env, .plumes i, .specks i, .leaves i, .embers i, .p3 .cap span { animation: none; }
}
</style>

<style>
/* ฉากพื้นหลังทั้งฉาก (SceneBackground) ระหว่างสิ่งแวดล้อมแย่ลง: ซีด มืด และสั่น */
body.env-shift .scene { animation: env-scene 8s ease-in forwards, env-shake 0.45s linear infinite; }
body.env-shift.env-p3 .scene { animation: env-scene-p3 8s ease-in forwards, env-shake-hard 0.2s linear infinite; }
@keyframes env-scene { to { filter: saturate(0.55) brightness(0.8) sepia(0.25); } }
@keyframes env-scene-p3 { to { filter: saturate(0.6) brightness(0.7) sepia(0.35) hue-rotate(-12deg); } }
/* สั่นพร้อมขยายเล็กน้อย → ขอบจอไม่โผล่พื้นขาวด้านหลัง */
@keyframes env-shake {
  0%, 100% { transform: translate(0, 0) scale(1.04); }
  25% { transform: translate(2px, -1px) scale(1.04); }
  75% { transform: translate(-2px, 1px) scale(1.04); }
}
@keyframes env-shake-hard {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1.05); }
  20% { transform: translate(-5px, 3px) rotate(-0.3deg) scale(1.05); }
  40% { transform: translate(4px, -4px) rotate(0.3deg) scale(1.05); }
  60% { transform: translate(-3px, -2px) scale(1.05); }
  80% { transform: translate(5px, 2px) rotate(0.2deg) scale(1.05); }
}
@media (prefers-reduced-motion: reduce) {
  body.env-shift .scene, body.env-shift.env-p3 .scene { animation: none; }
}
</style>
