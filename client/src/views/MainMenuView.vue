<script setup>
import { useRouter } from 'vue-router';
import AppNavbar from '@/components/AppNavbar.vue';
import ModeArt from '@/components/ModeArt.vue';
import LivelyScene from '@/components/LivelyScene.vue';
import { useToastStore } from '@/stores/toast';
import { play } from '@/services/sound';

const router = useRouter();
const toast = useToastStore();

// ดีไซน์แบบเกม (แบบเดิมเก็บไว้ที่ MainMenuView.classic.vue — อยากกลับไปใช้: คัดลอกไฟล์นั้นมาทับไฟล์นี้)
// โหมดการเล่น — Demo เปิดเฉพาะ Single Player (อีก 2 โหมดแสดงไว้ กดแล้วขึ้นแจ้งเตือน)
const modes = [
  {
    key: 'tutorial',
    title: 'TUTORIAL',
    art: 'tutorial',
    desc: ['เรียนรู้กติกาเกม', 'ผ่านการเล่นจริงแบบทีละขั้นตอน'],
    cta: 'เริ่มเรียนรู้',
    tone: 'green',
    enabled: false,
  },
  {
    key: 'single',
    title: 'SINGLE PLAYER',
    art: 'single',
    desc: ['เล่นคนเดียว', 'ร่วมกับผู้เล่น AI 2–4 คน'],
    cta: 'เริ่มเกม',
    tone: 'blue',
    enabled: true,
  },
  {
    key: 'multi',
    title: 'MULTIPLAYER',
    art: 'multi',
    desc: ['เล่นออนไลน์แบบเรียลไทม์', 'กับผู้เล่นคนอื่น 3–5 คน'],
    cta: 'เข้าห้องเกม',
    tone: 'purple',
    enabled: false,
  },
];

function choose(m) {
  if (!m.enabled) {
    play('click');
    toast.show(`โหมด ${m.title} ยังไม่เปิดให้เล่น`);
    return;
  }
  play('tap');
  router.push('/setup');
}
</script>

<template>
  <main class="page menu">
    <LivelyScene />
    <AppNavbar />

    <section class="content">
      <header class="heading">
        <h1><span>เลือกโหมดการเล่น</span></h1>
      </header>

      <div class="modes">
        <article
          v-for="(m, i) in modes"
          :key="m.key"
          class="mode"
          :class="[`tone-${m.tone}`, { disabled: !m.enabled }]"
          :style="{ animationDelay: 0.08 * i + 's' }"
        >
          <!-- ริบบิ้นชื่อโหมด -->
          <h2 class="title"><span>{{ m.title }}</span></h2>
          <div class="art">
            <i class="spark s1" /><i class="spark s2" /><i class="spark s3" />
            <ModeArt :name="m.art" :label="m.title" />
          </div>
          <p class="desc">{{ m.desc[0] }}<br />{{ m.desc[1] }}</p>
          <button type="button" class="cta" :aria-disabled="!m.enabled" @click="choose(m)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" /></svg>
            {{ m.cta }}
          </button>
        </article>
      </div>

    </section>
  </main>
</template>

<style scoped>
/* =========================================================
   หน้าเลือกโหมด — ดีไซน์แบบเกม (โทนพาสเทล ขอบขาวหนา ปุ่มนูน ริบบิ้น)
   ========================================================= */
.content {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(14px, 4vh, 36px);
  padding: clamp(6px, 2vh, 20px) 0;
}

/* ---------- หัวข้อ ---------- */
.heading { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.5rem; }
/* ชื่อหน้าแบบโลโก้เกม: ตัวหนา ขอบขาวหนา + เงาเขียวเป็นชั้น */
.heading h1 {
  font-family: var(--font-head); font-size: clamp(2.6rem, 5.2vh, 3.4rem); font-weight: 700; line-height: 1.2; letter-spacing: 0.01em;
  color: #2f7a3a;
  text-shadow:
    -3px -3px 0 #fff, 3px -3px 0 #fff, -3px 3px 0 #fff, 3px 3px 0 #fff,
    0 -3px 0 #fff, 0 3px 0 #fff, -3px 0 0 #fff, 3px 0 0 #fff,
    0 7px 0 #9fd18a, 0 10px 18px rgba(30, 80, 40, 0.3);
  animation: pop-in 0.55s 0.05s var(--ease-back) both;
}

.modes {
  display: grid; grid-template-columns: repeat(3, minmax(0, clamp(17.5rem, 25vw, 23rem)));
  justify-content: center;
  gap: clamp(14px, 2.6vw, 34px);
  width: 100%; min-height: 0;
  padding-top: 0.9rem; /* เผื่อริบบิ้นที่ยื่นขึ้นด้านบนการ์ด */
}

/* ---------- การ์ดโหมด ---------- */
.mode {
  --c: #4caf5a; --c-light: #9be4a0; --c-deep: #2f7a3a; --c-soft: #e6f7e2;
  position: relative; min-width: 0;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 1.9rem 1.2rem 1.3rem;
  border-radius: 1.6rem;
  background: linear-gradient(180deg, var(--c-soft) 0%, #ffffff 58%);
  border: 4px solid #ffffff;
  box-shadow: 0 0 0 3px var(--c), 0 7px 0 3px var(--c-deep), 0 16px 30px rgba(20, 50, 20, 0.25);
  animation: card-in 0.6s var(--ease-back) both;
  transition: transform 0.25s var(--ease-back);
}
.tone-blue { --c: #3d8fd1; --c-light: #9fd2ff; --c-deep: #22649a; --c-soft: #e3f1fd; }
.tone-purple { --c: #9170c4; --c-light: #cdb8f0; --c-deep: #634594; --c-soft: #f0e9fb; }
.mode:not(.disabled):hover { transform: translateY(-6px) rotate(-0.6deg); }
.mode.disabled:hover { transform: translateY(-3px); }

/* ริบบิ้นชื่อโหมด (ยื่นออกจากขอบบน) */
.title {
  position: absolute; top: -1.15rem; left: 50%; transform: translateX(-50%);
  white-space: nowrap; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.06em;
}
.title span {
  display: inline-block; padding: 0.35rem 1.3rem;
  border-radius: 999px; color: #ffffff;
  background: linear-gradient(180deg, var(--c-light) 0%, var(--c) 100%);
  border: 3px solid #ffffff;
  box-shadow: 0 3px 0 var(--c-deep), 0 6px 12px rgba(20, 50, 20, 0.2);
  text-shadow: 0 2px 0 var(--c-deep);
}
.art { position: relative; width: 94%; height: clamp(7rem, 33vh, 16rem); flex: none; margin: 0.4rem 0 0.4rem; transition: transform 0.3s var(--ease-back); }
.mode:not(.disabled):hover .art { transform: scale(1.05); }
/* ประกายระยิบระยับหลังภาพ */
.spark { position: absolute; width: 10px; height: 10px; background: var(--c-light); clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); animation: twinkle 2.4s ease-in-out infinite; }
.s1 { left: 4%; top: 12%; }
.s2 { right: 6%; top: 4%; width: 14px; height: 14px; animation-delay: -0.8s; }
.s3 { right: 12%; bottom: 10%; width: 8px; height: 8px; animation-delay: -1.6s; }
.desc { font-size: 1rem; line-height: 1.4; color: #4a5a4d; min-height: 2.8em; }

/* ปุ่มหลักแบบเกม: ไล่สี + ขอบขาว + เงานูนด้านล่าง */
.cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%; min-height: 3.3rem; margin-top: 0.85rem;
  border: 3px solid #ffffff; border-radius: 999px; cursor: pointer;
  background: linear-gradient(180deg, var(--c-light) 0%, var(--c) 55%, var(--c-deep) 100%);
  color: #ffffff; text-shadow: 0 2px 0 var(--c-deep);
  font-family: var(--font-head); font-size: 1.2rem; font-weight: 700;
  box-shadow: 0 5px 0 var(--c-deep), 0 9px 16px rgba(20, 50, 20, 0.25);
  transition: transform 0.12s var(--ease-out), box-shadow 0.12s, filter 0.15s;
}
.cta svg { width: 1.1rem; height: 1.1rem; fill: currentColor; filter: drop-shadow(0 2px 0 var(--c-deep)); }

.mode:not(.disabled) .cta:hover { filter: brightness(1.07); }
.mode:not(.disabled) .cta:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--c-deep), 0 3px 8px rgba(20, 50, 20, 0.2); animation: none; }
/* โหมดที่ยังไม่เปิด: ปุ่มจางลงนิด กดได้แต่ขึ้นแจ้งเตือน */
.mode.disabled .cta { cursor: not-allowed; filter: saturate(0.55) brightness(1.05); }
.mode.disabled .art { filter: saturate(0.85); }

@keyframes card-in { from { opacity: 0; transform: translateY(24px) scale(0.92); } }
@keyframes pop-in { from { opacity: 0; transform: scale(0.7); } }
@keyframes twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.6) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
@keyframes cta-glow { 50% { box-shadow: 0 5px 0 var(--c-deep), 0 9px 16px rgba(20, 50, 20, 0.25), 0 0 0 5px color-mix(in srgb, var(--c-light) 55%, transparent); } }
@media (prefers-reduced-motion: reduce) {
  .spark, .mode:not(.disabled) .cta { animation: none; }
}

/* ---------- โทรศัพท์แนวนอน ---------- */
@media (max-height: 500px) {
  .content { justify-content: center; gap: clamp(8px, 3vh, 18px); padding: 2px 0 8px; }
  .heading { gap: 0.25rem; }
  .heading h1 {
    font-size: 1.9rem;
    text-shadow:
      -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff,
      0 -2px 0 #fff, 0 2px 0 #fff, -2px 0 0 #fff, 2px 0 0 #fff,
      0 4px 0 #9fd18a, 0 6px 10px rgba(30, 80, 40, 0.3);
  }
  .modes { grid-template-columns: repeat(3, minmax(0, 17rem)); gap: clamp(12px, 2.6vw, 26px); padding-top: 0.7rem; }
  .mode { padding: 1.05rem 0.7rem 0.7rem; border-radius: 1.1rem; border-width: 3px; box-shadow: 0 0 0 2px var(--c), 0 4px 0 2px var(--c-deep), 0 10px 18px rgba(20, 50, 20, 0.22); }
  .title { top: -0.8rem; font-size: 0.72rem; }
  .title span { padding: 0.2rem 0.85rem; border-width: 2px; box-shadow: 0 2px 0 var(--c-deep); }
  .art { height: min(40vh, 11rem); margin: 0.25rem 0 0.2rem; }
  .desc { font-size: 0.74rem; min-height: 2.6em; }
  .cta { min-height: 2.2rem; margin-top: 0.4rem; font-size: 0.86rem; border-width: 2px; box-shadow: 0 3px 0 var(--c-deep), 0 5px 10px rgba(20, 50, 20, 0.2); }
  .cta svg { width: 0.85rem; height: 0.85rem; }
}
@media (max-height: 360px) {
  .heading h1 { font-size: 1.6rem; }
  .art { height: 36vh; }
}
</style>
