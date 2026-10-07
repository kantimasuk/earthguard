<script setup>
import { useRouter } from 'vue-router';
import AppNavbar from '@/components/AppNavbar.vue';
import ModeArt from '@/components/ModeArt.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { play } from '@/services/sound';

const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();

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

// ความก้าวหน้าการเรียนรู้ (%) — ตอนนี้ยังไม่มีระบบคลังความรู้ จึงเป็น 0
// TODO: คำนวณจากการ์ดความรู้ที่ผู้เล่นปลดล็อกแล้ว เมื่อทำระบบคลังความรู้
const learningProgress = 0;

function openKnowledge() {
  play('click');
  toast.show('คลังความรู้ยังไม่เปิดให้ใช้งาน');
}

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
    <AppNavbar />

    <section class="content">
      <header class="heading">
        <p class="hello">สวัสดี {{ auth.displayName }}</p>
        <h1>เลือกโหมดการเล่น</h1>
      </header>

      <div class="modes">
        <article
          v-for="(m, i) in modes"
          :key="m.key"
          class="mode"
          :class="[`tone-${m.tone}`, { disabled: !m.enabled }]"
          :style="{ animationDelay: 0.08 * i + 's' }"
        >
          <h2 class="title">{{ m.title }}</h2>
          <div class="art">
            <ModeArt :name="m.art" :label="m.title" />
          </div>
          <p class="desc">{{ m.desc[0] }}<br />{{ m.desc[1] }}</p>
          <button type="button" class="cta" :aria-disabled="!m.enabled" @click="choose(m)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" /></svg>
            {{ m.cta }}
          </button>
        </article>
      </div>

      <!-- แถบความก้าวหน้าการเรียนรู้ (เฉพาะจอคอม/แท็บเล็ต) -->
      <div class="learning">
        <div class="learning-info">
          <h3>ความก้าวหน้าการเรียนรู้</h3>
          <div class="lbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="learningProgress">
            <div class="lfill" :style="{ width: learningProgress + '%' }"></div>
            <span>{{ learningProgress }}%</span>
          </div>
        </div>
        <button type="button" class="kbtn" @click="openKnowledge">
          ดูคลังความรู้
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.content {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(14px, 4.5vh, 40px);   /* ระยะห่างระหว่างหัวข้อกับการ์ด */
  padding: clamp(6px, 2vh, 20px) 0;
}
.heading { display: flex; flex-direction: column; align-items: center; text-align: center; line-height: 1.25; }
/* มินิมอลแบบนุ่ม ๆ: 2 บรรทัดสไตล์เดียวกัน สีเขียวเข้มนุ่ม มีแสงขาวฟุ้งจาง ๆ ให้อ่านง่ายบนท้องฟ้า */
.hello, .heading h1 {
  font-family: var(--font-head); font-size: 2.35rem; font-weight: 600; letter-spacing: 0.01em;
  color: #24452b;
  text-shadow: 0 0 18px rgba(255, 255, 255, 0.95), 0 0 4px rgba(255, 255, 255, 0.9), 0 2px 0 rgba(255, 255, 255, 0.6);
}

.modes {
  display: grid; grid-template-columns: repeat(3, minmax(0, 17.5rem));
  justify-content: center;
  gap: clamp(12px, 2.5vw, 32px);
  width: 100%; min-height: 0;
}

/* ---------- การ์ดโหมด ---------- */
.mode {
  --c: #3a7d2c;      /* สีหัวข้อ/เส้นขอบ */
  --btn: #2f6b2c;    /* สีปุ่ม */
  --btn-edge: #214f1f;
  position: relative; min-width: 0;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 1rem 1rem 1.1rem;
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.96);
  border: 2px solid var(--c);
  box-shadow: 0 0.7rem 1.6rem rgba(20, 50, 20, 0.2);
  animation: card-in 0.6s var(--ease-back) both;
}
.tone-blue { --c: #2b76ad; --btn: #1f6d9e; --btn-edge: #154e73; }
.tone-purple { --c: #7a5aa8; --btn: #7a5aa8; --btn-edge: #57407a; }

.title { font-size: 1.15rem; font-weight: 600; letter-spacing: 0.04em; color: var(--c); }
.art { width: 92%; height: clamp(5.5rem, 24vh, 12rem); flex: none; margin: 0.5rem 0 0.4rem; }
.desc { font-size: 0.92rem; line-height: 1.35; color: var(--text); min-height: 2.7em; }

.cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%; min-height: 2.8rem; margin-top: 0.7rem;
  border: 0; border-radius: 0.8rem; cursor: pointer;
  background: var(--btn); color: #ffffff;
  font-family: var(--font-head); font-size: 1.05rem; font-weight: 500;
  box-shadow: 0 0.2rem 0 var(--btn-edge), 0 0.4rem 0.8rem rgba(20, 50, 20, 0.2);
  transition: transform 0.12s var(--ease-out), filter 0.15s;
}
.cta svg { width: 1.1rem; height: 1.1rem; fill: currentColor; }
.mode:not(.disabled) .cta:hover { filter: brightness(1.08); }
.mode:not(.disabled) .cta:active { transform: translateY(2px); box-shadow: 0 0.05rem 0 var(--btn-edge); }
/* โหมดที่ยังไม่เปิด: หน้าตาเหมือนเดิม แต่กดไม่ได้ (กดแล้วมีแจ้งเตือน) */
.mode.disabled .cta { cursor: not-allowed; }

/* ---------- แถบความก้าวหน้าการเรียนรู้ ---------- */
.learning {
  width: min(100%, calc(3 * 17.5rem + 2 * clamp(12px, 2.5vw, 32px)));
  display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
  padding: 1rem 1.6rem; border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.96); border: 2px solid var(--accent);
  box-shadow: 0 0.7rem 1.6rem rgba(20, 50, 20, 0.2);
  animation: card-in 0.6s 0.25s var(--ease-back) both;
}
.learning-info { flex: 1; min-width: 0; max-width: 26rem; display: flex; flex-direction: column; gap: 0.45rem; }
.learning h3 { font-size: 1.15rem; font-weight: 600; color: var(--text); }
.lbar {
  position: relative; height: 1.4rem; border-radius: 999px; overflow: hidden;
  background: #e4ded4; border: 1.5px solid var(--leaf-soft);
}
.lfill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--leaf); transition: width 0.6s var(--ease-out); }
.lbar span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 0.85rem; font-weight: 600; color: var(--text); }
.kbtn {
  display: inline-flex; align-items: center; gap: 0.5rem; flex: none;
  min-height: 2.8rem; padding: 0 1.1rem 0 1.3rem; border: 0; border-radius: 0.8rem; cursor: pointer;
  background: var(--leaf); color: #ffffff;
  font-family: var(--font-head); font-size: 1.05rem; font-weight: 500;
  box-shadow: 0 0.2rem 0 var(--leaf-dark), 0 0.4rem 0.8rem rgba(20, 50, 20, 0.2);
}
.kbtn svg { width: 1.2rem; height: 1.2rem; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.kbtn:active { transform: translateY(2px); box-shadow: 0 0.05rem 0 var(--leaf-dark); }

@keyframes card-in { from { opacity: 0; transform: translateY(20px) scale(0.95); } }

/* ---------- โทรศัพท์แนวนอน ---------- */
/* โทรศัพท์: ไม่แสดงแถบความก้าวหน้า (พื้นที่ไม่พอ) */
@media (max-height: 560px) {
  .learning { display: none; }
}
@media (max-height: 500px) {
  .content { justify-content: center; gap: clamp(10px, 4vh, 22px); padding: 2px 0 6px; }
  .hello, .heading h1 { font-size: 1.55rem; }
  .modes { grid-template-columns: repeat(3, minmax(0, 15rem)); gap: clamp(10px, 2.5vw, 24px); }
  .mode { padding: 0.55rem 0.7rem 0.7rem; border-radius: 0.9rem; border-width: 1.5px; }
  .title { font-size: 0.9rem; }
  .art { height: min(33vh, 9.5rem); margin: 0.3rem 0 0.25rem; }
  .desc { font-size: 0.72rem; }
  .cta { min-height: 2.2rem; margin-top: 0.45rem; font-size: 0.85rem; border-radius: 0.65rem; }
  .cta svg { width: 0.9rem; height: 0.9rem; }
}
@media (max-height: 360px) {
  .hello, .heading h1 { font-size: 1.3rem; }
  .art { height: 30vh; }
}
</style>
