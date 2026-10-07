<script setup>
// ดีไซน์แบบเกม เข้าชุดกับหน้าเลือกโหมด (แบบเดิมเก็บไว้ที่ GameSetupView.classic.vue)
// หน้าตั้งค่าเกม: เลือกระดับความยาก (ง่าย 2 AI / ปานกลาง 3 AI / ยาก 4 AI) → สร้างรอบการเล่น → Pre-test
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppNavbar from '@/components/AppNavbar.vue';
import PlayerAvatar from '@/components/PlayerAvatar.vue';
import RulesModal from '@/components/RulesModal.vue';
import LivelyScene from '@/components/LivelyScene.vue';
import { DIFFICULTIES, sessionApi, sessionErrorMessage } from '@/services/sessionApi';
import { AI_LIST } from '@/game/avatars';
import { uiImg } from '@/services/uiArt';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { play } from '@/services/sound';

const router = useRouter();
const session = useSessionStore();
const toast = useToastStore();

// รูปประจำระดับของทีม (assets/ui/level-easy.png ฯลฯ) — ไม่มีรูป → แสดงรูป AI เรียงกันแทน
const levelArt = Object.fromEntries(DIFFICULTIES.map((d) => [d.key, uiImg(`level-${d.key}`)]));

const picked = ref(session.current?.difficulty || 'easy');
const loading = ref(false);
const rulesOpen = ref(false);

function pick(d) {
  if (picked.value === d.key) return;
  play('tap');
  picked.value = d.key;
}

async function start() {
  if (loading.value) return;
  play('tap');
  loading.value = true;
  try {
    const res = await sessionApi.create(picked.value);
    session.start(res);
    router.push('/pretest');
  } catch (e) {
    play('error');
    toast.show(sessionErrorMessage(e), { type: 'error', duration: 3500 });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="page setup">
    <LivelyScene />
    <AppNavbar />

    <section class="content">
      <header class="heading">
        <h1>ตั้งค่าเกม<br>เลือกระดับความยาก</h1>
      </header>

      <div class="levels" role="radiogroup" aria-label="ระดับความยาก">
        <button
          v-for="(d, i) in DIFFICULTIES"
          :key="d.key"
          type="button"
          role="radio"
          class="level"
          :class="[`lv-${d.key}`, { on: picked === d.key }]"
          :aria-checked="picked === d.key"
          :style="{ animationDelay: 0.07 * i + 's' }"
          @click="pick(d)"
        >
          <span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
          <span class="art">
            <img v-if="levelArt[d.key]" :src="levelArt[d.key]" :alt="`ระดับ${d.label}`" />
            <span v-else class="bots">
              <PlayerAvatar v-for="a in AI_LIST.slice(0, d.ai)" :key="a.avatar" is-ai :avatar="a.avatar" :name="a.name" size="var(--av)" />
            </span>
          </span>
          <span class="name"><span>{{ d.label }}</span></span>
          <i class="spark s1" /><i class="spark s2" />
          <span class="count">AI {{ d.ai }} ตัว</span>
          <span class="desc">{{ d.desc.split(' · ')[1] }}</span>
        </button>
      </div>

      <div class="actions">
        <button type="button" class="gbtn rules" @click="play('click'); rulesOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v.01M12 13.5c0-2 2.5-2 2.5-4a2.5 2.5 0 0 0-5 0 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /></svg>
          กติกาย่อ
        </button>
        <button type="button" class="gbtn start" :disabled="loading" @click="start">
          <span v-if="loading" class="spinner" />
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" /></svg>
          เริ่มเกม
        </button>
      </div>
    </section>

    <p class="note">
      <span class="i" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 10.5v6.5" /><circle cx="12" cy="7" r="0.6" /></svg>
      </span>
      ก่อนเริ่มเกมจะมีแบบทดสอบสั้น ๆ 5 ข้อ (2 นาที)
    </p>

    <RulesModal :open="rulesOpen" @close="rulesOpen = false" />
  </main>
</template>

<style scoped>
.content {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(12px, 3.4vh, 30px);
  padding: 8px 0 2.6rem;
}
/* หัวข้อแบบชื่อเกม (เหมือนหน้าเลือกโหมด): ตัวหนา ขอบขาวหนา + เงาเขียวเป็นชั้น */
.heading { text-align: center; }
.heading h1 {
  font-family: var(--font-head); font-size: clamp(2.2rem, 4.6vh, 3rem); font-weight: 700; line-height: 1.25; letter-spacing: 0.01em;
  color: #2f7a3a;
  text-shadow:
    -3px -3px 0 #fff, 3px -3px 0 #fff, -3px 3px 0 #fff, 3px 3px 0 #fff,
    0 -3px 0 #fff, 0 3px 0 #fff, -3px 0 0 #fff, 3px 0 0 #fff,
    0 7px 0 #9fd18a, 0 10px 18px rgba(30, 80, 40, 0.3);
  animation: pop-in 0.55s var(--ease-back) both;
}

.levels {
  display: grid; grid-template-columns: repeat(3, minmax(0, clamp(18rem, 25vw, 23.5rem)));
  gap: clamp(14px, 2.6vw, 34px); width: 100%; justify-content: center;
  padding-top: 1rem; /* เผื่อริบบิ้นชื่อระดับที่ยื่นขึ้นด้านบน */
}
/* การ์ดระดับ: สไตล์เดียวกับการ์ดหน้าเลือกโหมดทุกอย่าง (สี · ริบบิ้น · ปุ่มในการ์ด)
   ง่าย = เขียว · ปานกลาง = ฟ้า · ยาก = ม่วง (ชุดสีเดียวกับ TUTORIAL / SINGLE / MULTI) */
.level {
  --c: #4caf5a; --c-light: #9be4a0; --c-deep: #2f7a3a; --c-soft: #e6f7e2;
  --av: 3rem;
  position: relative; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  padding: 1.9rem 1.2rem 1.3rem;
  border-radius: 1.6rem; cursor: pointer; text-align: center;
  background: linear-gradient(180deg, var(--c-soft) 0%, #ffffff 58%);
  border: 4px solid #ffffff;
  box-shadow: 0 0 0 3px var(--c), 0 7px 0 3px var(--c-deep), 0 16px 30px rgba(20, 50, 20, 0.22);
  transition: transform 0.25s var(--ease-back), box-shadow 0.25s, filter 0.25s;
  animation: pop-in 0.5s var(--ease-back) both;
  font-family: var(--font-body); color: var(--text);
}
.lv-medium { --c: #3d8fd1; --c-light: #9fd2ff; --c-deep: #22649a; --c-soft: #e3f1fd; }
.lv-hard { --c: #9170c4; --c-light: #cdb8f0; --c-deep: #634594; --c-soft: #f0e9fb; }
.level:hover { transform: translateY(-6px) rotate(-0.6deg); }
/* ระดับที่เลือก: ลอยขึ้น + วงเรืองแสงสีของระดับ */
.level.on {
  transform: translateY(-8px) scale(1.03);
  box-shadow: 0 0 0 3px var(--c), 0 7px 0 3px var(--c-deep), 0 0 0 9px color-mix(in srgb, var(--c-light) 60%, transparent), 0 20px 34px rgba(20, 50, 20, 0.28);
}
.check {
  position: absolute; top: -0.7rem; right: -0.7rem; z-index: 2; width: 2.2rem; height: 2.2rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, var(--c-light), var(--c)); border: 3px solid #fff; box-shadow: 0 3px 0 var(--c-deep);
  transform: scale(0); transition: transform 0.3s var(--ease-back);
}
.check svg { width: 70%; height: 70%; fill: none; stroke: #fff; filter: drop-shadow(0 1.5px 0 var(--c-deep)); stroke-width: 3.4; stroke-linecap: round; stroke-linejoin: round; }
.level.on .check { transform: scale(1); }
/* ริบบิ้นชื่อระดับ (ยื่นออกจากขอบบน) */
.name {
  position: absolute; top: -1.15rem; left: 50%; transform: translateX(-50%); z-index: 1;
  white-space: nowrap; font-family: var(--font-head); font-size: 1.1rem; font-weight: 700; line-height: 1.2; letter-spacing: 0.06em;
}
.name span {
  display: inline-block; padding: 0.35rem 1.6rem;
  border-radius: 999px; color: #ffffff;
  background: linear-gradient(180deg, var(--c-light) 0%, var(--c) 100%);
  border: 3px solid #ffffff;
  box-shadow: 0 3px 0 var(--c-deep), 0 6px 12px rgba(20, 50, 20, 0.2);
  text-shadow: 0 2px 0 var(--c-deep);
}
/* ประกายวิบวับหลังภาพ */
.spark { position: absolute; width: 10px; height: 10px; background: var(--c-light); clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); animation: twinkle 2.4s ease-in-out infinite; }
.s1 { left: 9%; top: 22%; }
.s2 { right: 9%; top: 14%; width: 14px; height: 14px; animation-delay: -1.1s; }
@keyframes twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.6) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
.art { width: 100%; height: 9.5rem; display: grid; place-items: center; }
.art { position: relative; }
.art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: center bottom; transform-origin: center bottom; transition: transform 0.3s var(--ease-back); }
.level.on .art img { transform: scale(1.06); }
/* แอนิเมชันรูประดับ: ปกติลอยขึ้นลงเบา ๆ (แต่ละระดับจังหวะไม่ตรงกัน) · ระดับที่เลือก = กระโดดดีใจ
   ใช้ translate / rotate แยกจาก transform (scale ตอนเลือก) → เล่นพร้อมกันได้ ไม่ทับกัน */
.art img { animation: lv-float 3s ease-in-out infinite; }
.lv-medium .art img { animation-delay: -1s; }
.lv-hard .art img { animation-delay: -2s; }
.level:hover .art img { animation: lv-wiggle 0.7s ease-in-out infinite; }
.level.on .art img { animation: lv-hop 1.6s var(--ease-out) infinite; }
@keyframes lv-float {
  0%, 100% { translate: 0 0; rotate: 0deg; }
  25% { rotate: -1.2deg; }
  50% { translate: 0 -4%; rotate: 0deg; }
  75% { rotate: 1.2deg; }
}
@keyframes lv-wiggle {
  0%, 100% { rotate: 0deg; }
  25% { rotate: -2.5deg; }
  75% { rotate: 2.5deg; }
}
@keyframes lv-hop {
  0%, 60%, 100% { translate: 0 0; }
  18% { translate: 0 -10%; }
  32% { translate: 0 0; }
  42% { translate: 0 -4%; }
}
@media (prefers-reduced-motion: reduce) {
  .art img, .level:hover .art img, .level.on .art img { animation: none; }
}
.bots { display: flex; justify-content: center; }
.bots > * + * { margin-left: -0.55rem; }
.count {
  margin-top: 0.2rem; padding: 0.1rem 0.8rem; border-radius: 999px;
  font-family: var(--font-head); font-weight: 700; font-size: 1.08rem; color: var(--c-deep);
  background: #ffffff; border: 2px solid var(--c-light);
}
.desc { font-size: 1rem; color: #4a5a4d; line-height: 1.4; }

.actions { display: flex; gap: 1rem; margin-top: 0.3rem; }
.actions svg { width: 1.15rem; height: 1.15rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
/* ปุ่มแบบเกม: ขอบขาวหนา + เงานูนด้านล่าง · กดแล้วยุบ */
.gbtn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  min-height: 3rem; padding: 0 1.5rem; border-radius: 999px; cursor: pointer;
  font-family: var(--font-head); font-size: 1.1rem; font-weight: 700;
  border: 3px solid #ffffff;
  transition: transform 0.12s var(--ease-out), box-shadow 0.12s, filter 0.15s;
}
.gbtn.rules { background: #ffffff; color: #3d5a45; box-shadow: 0 4px 0 #d3e5ca, 0 8px 14px rgba(20, 50, 20, 0.15); border-color: #e2eedc; }
.gbtn.rules:active { transform: translateY(3px); box-shadow: 0 1px 0 #d3e5ca; }
.gbtn.start {
  min-width: 12rem; color: #ffffff; text-shadow: 0 2px 0 #2f7446;
  background: linear-gradient(180deg, #8ce0a4 0%, #45a064 55%, #2f7a3a 100%);
  box-shadow: 0 5px 0 #2f7446, 0 9px 16px rgba(20, 50, 20, 0.25);
}
.gbtn.start svg { fill: currentColor; stroke: none; filter: drop-shadow(0 2px 0 #2f7446); }
.gbtn.start:hover { filter: brightness(1.06); }
.gbtn.start:active { transform: translateY(4px); box-shadow: 0 1px 0 #2f7446; animation: none; }
.gbtn:disabled { filter: grayscale(0.3); cursor: default; animation: none; }
@keyframes start-glow { 50% { box-shadow: 0 5px 0 #2f7446, 0 9px 16px rgba(20, 50, 20, 0.25), 0 0 0 6px rgba(140, 224, 164, 0.45); } }
/* ข้อความแจ้งแบบทดสอบ: ป้ายสีขาว + ไอคอน i ชิดขอบล่างของจอ */
.note {
  position: absolute; left: 50%; bottom: calc(var(--safe-b) + 10px); transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 0.5rem; white-space: nowrap;
  padding: 0.35rem 1.1rem 0.35rem 0.4rem; border-radius: 999px;
  background: #ffffff; color: #2f5a3a; font-family: var(--font-head); font-size: 0.95rem; font-weight: 600;
  border: 3px solid #ffffff; box-shadow: 0 0 0 2px #cfe3c6, 0 4px 0 2px #b9d6ad, 0 8px 16px rgba(20, 50, 20, 0.18);
  animation: note-in 0.5s var(--ease-back) 0.3s both;
}
.note b { color: var(--leaf-dark); font-weight: 700; }
.note .i {
  width: 1.5rem; height: 1.5rem; flex: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #7fb5e3, #4a8fc9);
}
.note .i svg { width: 1.05rem; height: 1.05rem; fill: #fff; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; }
@keyframes note-in { from { opacity: 0; transform: translate(-50%, 12px); } }

@keyframes pop-in { from { opacity: 0; transform: translateY(16px) scale(0.95); } }

@media (max-height: 500px) {
  .content { gap: clamp(8px, 3vh, 16px); padding-top: 4px; }
  .heading h1 {
    font-size: 1.45rem;
    text-shadow:
      -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff,
      0 -2px 0 #fff, 0 2px 0 #fff, -2px 0 0 #fff, 2px 0 0 #fff,
      0 4px 0 #9fd18a, 0 6px 10px rgba(30, 80, 40, 0.3);
  }
  .heading p { font-size: 0.78rem; }
  .content { padding-bottom: 2.1rem; } /* เว้นที่ให้ป้ายแจ้งด้านล่าง */
  .levels { grid-template-columns: repeat(3, minmax(0, 18.5rem)); padding-top: 0.7rem; gap: clamp(12px, 2.6vw, 26px); }
  .level {
    --av: clamp(1.9rem, 10vh, 2.6rem); padding: 1.05rem 0.7rem 0.7rem; gap: 0.12rem; border-radius: 1.1rem; border-width: 3px;
    box-shadow: 0 0 0 2px var(--c), 0 4px 0 2px var(--c-deep), 0 10px 18px rgba(20, 50, 20, 0.22);
  }
  .level.on { box-shadow: 0 0 0 2px var(--c), 0 4px 0 2px var(--c-deep), 0 0 0 6px color-mix(in srgb, var(--c-light) 60%, transparent), 0 12px 20px rgba(20, 50, 20, 0.25); }
  .name { top: -0.8rem; font-size: 0.8rem; }
  .name span { padding: 0.2rem 1rem; border-width: 2px; box-shadow: 0 2px 0 var(--c-deep); }
  .check { width: 1.6rem; height: 1.6rem; top: -0.5rem; right: -0.5rem; border-width: 2px; }
  .count { font-size: 0.72rem; padding: 0 0.6rem; border-width: 1.5px; }
  .gbtn { min-height: 2.3rem; font-size: 0.86rem; padding: 0 1rem; border-width: 2px; }
  .gbtn.start { min-width: 8.5rem; box-shadow: 0 3px 0 #2f7446; }
  .gbtn.rules { box-shadow: 0 3px 0 #d3e5ca; }
  .art { height: clamp(3.6rem, 25vh, 7.5rem); }

  .desc { font-size: 0.68rem; }
  .note { font-size: 0.72rem; bottom: calc(var(--safe-b) + 6px); padding: 0.25rem 0.8rem 0.25rem 0.3rem; gap: 0.4rem; }
  .note .i { width: 1.2rem; height: 1.2rem; }
  .note .i svg { width: 0.85rem; height: 0.85rem; }
}
@media (max-height: 360px) {
  .heading p, .desc { display: none; }
}
</style>
