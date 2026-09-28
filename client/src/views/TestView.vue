<script setup>
// แบบทดสอบก่อนเล่น (pre) / หลังเล่น (post) — ข้อสอบถูก/ผิด 5 ข้อ ชุดเดียวกัน เวลารวม 120 วินาที
// pre : แสดงทีละข้อ ไม่เฉลย → หมดเวลา = ข้อที่ยังไม่ตอบนับผิด แล้วเข้าเกมทันที
// post: ตอบแล้วเฉลยทันที (เขียว/แดง + คำอธิบาย) → หน้าสรุปผล
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import GameSettings from '@/components/GameSettings.vue';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import { sessionApi, sessionErrorMessage } from '@/services/sessionApi';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { useLeaveGame } from '@/composables/useLeaveGame';
import { play } from '@/services/sound';

const props = defineProps({ phase: { type: String, required: true } }); // 'pre' | 'post'
const isPost = computed(() => props.phase === 'post');

const router = useRouter();
const session = useSessionStore();
const toast = useToastStore();
const { leave, exiting } = useLeaveGame();

const state = ref('loading'); // loading | intro | question | submitting | error
const showLoader = ref(true);  // หน้าโหลดเต็มจอ (ปิดเองหลังแถบวิ่งถึง 100%)
const questions = ref([]);
const limit = ref(120);
const index = ref(0);
const answers = ref([]);           // true | false | null
const feedback = ref(null);        // post: { correct, answer, explanation }
const picked = ref(null);          // pre: ปุ่มที่เพิ่งกด (เล่นแอนิเมชันสั้น ๆ ก่อนไปข้อถัดไป)
const results = ref([]);           // post: ถูก/ผิดของแต่ละข้อ (ระบายสีจุดความคืบหน้า)
const remaining = ref(120);
let startedAt = 0;
let tick = null;

const q = computed(() => questions.value[index.value]);
const total = computed(() => questions.value.length || 5);
const timeText = computed(() => {
  const s = Math.max(0, Math.ceil(remaining.value));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});
const urgent = computed(() => remaining.value <= 20);
const ringPct = computed(() => Math.max(0, Math.min(1, remaining.value / limit.value)));
const RING_LEN = 2 * Math.PI * 19; // เส้นรอบวงของวงเวลา (r = 19)

// สถานะของจุดความคืบหน้าแต่ละข้อ
function nodeClass(i) {
  if (isPost.value && results.value[i] !== undefined) return results.value[i] ? 'ok' : 'bad';
  if (i < index.value) return 'done';
  if (i === index.value) return 'now';
  return '';
}
const title = computed(() => (isPost.value ? 'แบบทดสอบหลังเล่น' : 'แบบทดสอบก่อนเล่น'));

onMounted(load);
onBeforeUnmount(() => clearInterval(tick));

async function load() {
  if (!session.id) return router.replace('/menu');
  try {
    const res = await sessionApi.getTest(session.id, props.phase);
    questions.value = res.questions;
    limit.value = res.timeLimitSec || 120;
    remaining.value = limit.value;
    answers.value = res.questions.map(() => null);
    state.value = 'intro';
  } catch (e) {
    if (e?.code === 'ALREADY_SUBMITTED') return goNext();
    if (e?.code === 'SESSION_NOT_FOUND') { session.clear(); return router.replace('/menu'); }
    state.value = 'error';
    toast.show(sessionErrorMessage(e), { type: 'error', duration: 3500 });
  }
}

function begin() {
  play('start');
  state.value = 'question';
  startedAt = performance.now();
  tick = setInterval(() => {
    remaining.value = limit.value - (performance.now() - startedAt) / 1000;
    if (remaining.value <= 0) finish(true);
  }, 200);
}

function answer(value) {
  if (state.value !== 'question' || feedback.value || picked.value !== null) return;
  answers.value[index.value] = value;
  if (isPost.value) {
    const correct = value === q.value.answer;
    results.value[index.value] = correct;
    feedback.value = { correct, answer: q.value.answer, explanation: q.value.explanation, picked: value };
    play(correct ? 'success' : 'error');
    return;
  }
  play('tap');
  picked.value = value; // ปุ่มเด้ง 0.4 วิ ให้รู้สึกว่ากดโดน แล้วค่อยไปข้อถัดไป
  setTimeout(() => {
    picked.value = null;
    if (state.value === 'question') next();
  }, 420);
}

function next() {
  feedback.value = null;
  if (index.value < questions.value.length - 1) {
    index.value++;
  } else {
    finish(false);
  }
}

async function finish(timedOut) {
  if (state.value === 'submitting') return;
  clearInterval(tick);
  state.value = 'submitting';
  if (timedOut) {
    play('error');
    toast.show(isPost.value ? 'หมดเวลา! ข้อที่ยังไม่ตอบนับเป็นผิด' : 'หมดเวลา! ข้อที่ยังไม่ตอบนับเป็นผิด · เข้าสู่เกม', { duration: 2600 });
  }
  const used = Math.min(limit.value, (performance.now() - startedAt) / 1000);
  try {
    const res = await sessionApi.submitTest(session.id, props.phase, {
      answers: answers.value,
      timeUsedSec: Math.round(used),
      timedOut,
    });
    session.setStep(isPost.value ? 'summary' : 'game', { [props.phase]: res });
    goNext();
  } catch (e) {
    if (e?.code === 'ALREADY_SUBMITTED') return goNext();
    state.value = 'question';
    toast.show(sessionErrorMessage(e), { type: 'error', duration: 3500 });
  }
}

function goNext() {
  session.setStep(isPost.value ? 'summary' : 'game');
  router.replace(isPost.value ? '/summary' : '/game');
}
</script>

<template>
  <main class="page test" :class="isPost ? 'post' : 'pre'">
    <GameSettings :exiting="exiting" @exit="leave" />

    <Transition name="swap" mode="out-in">
      <!-- ================= หน้าเริ่ม (ภารกิจ) ================= -->
      <section v-if="state === 'intro' || state === 'loading'" key="intro" class="intro-wrap">
        <div class="burst" aria-hidden="true" />
        <div class="board intro">
          <div class="ribbon"><span>{{ title }}</span></div>
          <p class="tagline">{{ isPost ? 'มาดูกันว่าหลังเล่นเกม รู้มากขึ้นแค่ไหน!' : 'อุ่นเครื่องก่อนออกไปปกป้องโลกกัน!' }}</p>

          <div class="stats">
            <div class="stat">
              <span class="ic"><svg viewBox="0 0 24 24"><path d="M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.2-1.5 2.1v.4 M12 17.6v.01" /></svg></span>
              <b>5</b><small>คำถาม</small>
            </div>
            <div class="stat">
              <span class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2 M9.5 2.5h5" /></svg></span>
              <b>2:00</b><small>นาที</small>
            </div>
            <div class="stat">
              <span class="ic duo">
                <i class="y"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></i>
                <i class="n"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></i>
              </span>
              <b>ถูก / ผิด</b><small>เลือกตอบ</small>
            </div>
          </div>

          <p class="rule">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5 M12 7.6v.01" /></svg>
            {{ isPost ? 'ตอบแล้วเฉลยทันที พร้อมคำอธิบาย' : 'ยังไม่เฉลยระหว่างทำ ตอบตามที่เข้าใจได้เลย' }}
          </p>

          <button type="button" class="play-btn" :disabled="state !== 'intro'" @click="begin">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" /></svg>
            เริ่มเลย!
          </button>
        </div>
      </section>

      <!-- ================= โหลดไม่สำเร็จ ================= -->
      <section v-else-if="state === 'error'" key="error" class="intro-wrap">
        <div class="board intro">
          <div class="ribbon"><span>อุ๊ย!</span></div>
          <p class="tagline">โหลดข้อสอบไม่สำเร็จ</p>
          <button type="button" class="play-btn" @click="state = 'loading'; showLoader = true; load()">ลองใหม่</button>
        </div>
      </section>

      <!-- ================= ทำข้อสอบ ================= -->
      <section v-else key="play" class="play">
        <header class="hud">
          <span class="tag">{{ isPost ? 'หลังเล่น' : 'ก่อนเล่น' }}</span>

          <!-- เส้นทางความคืบหน้า 5 ข้อ -->
          <div class="path" aria-label="ความคืบหน้า">
            <template v-for="(a, i) in answers" :key="i">
              <i v-if="i" class="link" :class="{ on: i <= index }" />
              <span class="node" :class="nodeClass(i)">
                <svg v-if="nodeClass(i) === 'ok' || nodeClass(i) === 'done'" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                <svg v-else-if="nodeClass(i) === 'bad'" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
                <template v-else>{{ i + 1 }}</template>
              </span>
            </template>
          </div>

          <!-- วงเวลา -->
          <div class="ring" :class="{ urgent }" role="timer" :aria-label="`เหลือเวลา ${timeText}`">
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <circle class="bg" cx="22" cy="22" r="19" />
              <circle class="fg" cx="22" cy="22" r="19" :stroke-dasharray="RING_LEN" :stroke-dashoffset="RING_LEN * (1 - ringPct)" />
            </svg>
            <b>{{ timeText }}</b>
          </div>
        </header>

        <Transition name="q" mode="out-in">
          <div :key="index" class="qarea">
            <article class="board qcard">
              <div class="ribbon small"><span>คำถามที่ {{ index + 1 }}</span></div>
              <span v-if="q?.category" class="cat">{{ q.category }}</span>
              <div class="qbody"><p class="qtext">{{ q?.question }}</p></div>
            </article>

            <div class="choices">
              <button
                type="button" class="choice yes"
                :class="{ picked: picked === true, dim: picked === false }"
                :disabled="state !== 'question' || Boolean(feedback)"
                @click="answer(true)"
              >
                <span class="bub"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                ถูก
              </button>
              <button
                type="button" class="choice no"
                :class="{ picked: picked === false, dim: picked === true }"
                :disabled="state !== 'question' || Boolean(feedback)"
                @click="answer(false)"
              >
                <span class="bub"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></span>
                ผิด
              </button>
            </div>
          </div>
        </Transition>
      </section>
    </Transition>

    <!-- ================= Post-test: ป๊อปอัปเฉลย ================= -->
    <Transition name="fb">
      <div v-if="feedback" class="fb-back">
        <div class="board fb" :class="feedback.correct ? 'ok' : 'bad'">
          <div v-if="feedback.correct" class="confetti" aria-hidden="true">
            <i v-for="n in 16" :key="n" :style="{ '--a': (n * 22.5) + 'deg', '--d': (70 + (n % 4) * 18) + 'px', '--h': (n * 47) % 360 }" />
          </div>
          <div class="stamp">
            <svg v-if="feedback.correct" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
            {{ feedback.correct ? 'ถูกต้อง!' : 'ยังไม่ถูก' }}
          </div>
          <p class="ans">คำตอบที่ถูก: <b :class="feedback.answer ? 'y' : 'n'">{{ feedback.answer ? 'ถูก' : 'ผิด' }}</b></p>
          <p class="exp">{{ feedback.explanation }}</p>
          <button type="button" class="play-btn small" :disabled="state !== 'question'" @click="play('click'); next()">
            {{ index < total - 1 ? 'ข้อต่อไป' : 'ดูผลสรุป' }}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </Transition>

    <LoadingScreen v-if="showLoader" :done="state !== 'loading'" label="กำลังโหลดข้อสอบ" @finished="showLoader = false" />
  </main>
</template>

<style scoped>
/* ธีมสี: ก่อนเล่น = เขียว · หลังเล่น = ฟ้า */
.test {
  --c: #4caf3f; --c-light: #9be46f; --c-deep: #2c6e28; --c-soft: #cfeabf; --c-bg: #f2faea;
  gap: 0.4rem;
}
.test.post { --c: #2b86c5; --c-light: #8fd0ff; --c-deep: #1b5a8a; --c-soft: #c4e2f5; --c-bg: #eef7fd; }
svg { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; }

/* ---------- แผ่นป้ายแบบเกม (ขอบขาวหนา + ขอบสี + เงาเป็นชั้น) ---------- */
.board {
  position: relative;
  background: linear-gradient(180deg, #fffefa 0%, #fff8e8 100%);
  border: 4px solid #ffffff;
  border-radius: 1.6rem;
  box-shadow:
    0 0 0 3px var(--c),
    0 0.45rem 0 3px var(--c-deep),
    0 1.2rem 2.2rem rgba(20, 50, 20, 0.35);
}

/* ---------- ริบบิ้นหัวป้าย ---------- */
.ribbon {
  position: absolute; left: 50%; top: 0; transform: translate(-50%, -58%);
  font-size: 1.55rem; z-index: 2; white-space: nowrap;
}
.ribbon span {
  position: relative; z-index: 1; display: block;
  padding: 0.3em 1.6em 0.35em;
  font-family: var(--font-head); font-weight: 700; color: #fff; letter-spacing: 0.01em;
  background: linear-gradient(180deg, var(--c-light) 0%, var(--c) 60%);
  border: 3px solid #fff; border-radius: 0.55em;
  text-shadow: 0 2px 0 var(--c-deep), 0 0 8px rgba(0, 0, 0, 0.15);
  box-shadow: 0 0.2em 0 var(--c-deep), 0 0.4em 0.8em rgba(0, 0, 0, 0.2);
}
.ribbon::before, .ribbon::after {
  content: ''; position: absolute; top: 0.45em; width: 1.4em; height: 100%;
  background: var(--c-deep); z-index: 0;
}
.ribbon::before { left: -0.95em; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 38% 50%); }
.ribbon::after { right: -0.95em; clip-path: polygon(0 0, 100% 0, 62% 50%, 100% 100%, 0 100%); }
.ribbon.small { font-size: 1.05rem; }

/* ---------- ปุ่มหลักแบบเกม (เหลืองส้ม นูน มีแสงวิ่ง) ---------- */
.play-btn {
  position: relative; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.45em;
  padding: 0.45em 2.1em 0.5em; border-radius: 999px; cursor: pointer;
  font-family: var(--font-head); font-weight: 700; font-size: 1.55rem; color: #fff;
  background: linear-gradient(180deg, #ffd760 0%, #f7a824 100%);
  border: 3px solid #fff;
  text-shadow: 0 2px 0 #b8640f;
  box-shadow: 0 0.32rem 0 #c2700f, 0 0.8rem 1.4rem rgba(0, 0, 0, 0.25);
  transition: transform 0.12s, box-shadow 0.12s;
  animation: breathe 1.8s ease-in-out infinite;
}
.play-btn svg { width: 1em; height: 1em; fill: #fff; stroke: #fff; stroke-width: 1.5; filter: drop-shadow(0 2px 0 #b8640f); }
.play-btn.small svg { fill: none; stroke-width: 3.2; }
.play-btn::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: -60%; width: 40%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.65), transparent);
  transform: skewX(-20deg); animation: shine 2.6s ease-in-out infinite;
}
.play-btn:hover:not(:disabled) { filter: brightness(1.05); }
.play-btn:active:not(:disabled) { transform: translateY(0.28rem); box-shadow: 0 0.05rem 0 #c2700f, 0 0.3rem 0.6rem rgba(0, 0, 0, 0.2); animation: none; }
.play-btn:disabled { filter: grayscale(0.4); opacity: 0.8; animation: none; cursor: default; }
.play-btn.small { font-size: 1.2rem; padding: 0.4em 1.6em 0.45em; }

/* ================= หน้าเริ่ม ================= */
.intro-wrap { flex: 1; min-height: 0; position: relative; display: grid; place-items: center; padding-top: 1.2rem; }
.burst {
  position: absolute; left: 50%; top: 50%; width: 150vmax; height: 150vmax; margin: -75vmax 0 0 -75vmax;
  background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, 0.28) 0deg 8deg, transparent 8deg 22deg);
  mask-image: radial-gradient(circle, #000 0%, transparent 42%);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 42%);
  animation: spin 40s linear infinite; pointer-events: none;
}
.intro {
  width: min(33rem, 94vw);
  padding: 2.3rem 1.8rem 1.6rem;
  display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center;
  animation: board-in 0.6s var(--ease-back) both;
}
.tagline { margin: 0; font-family: var(--font-head); font-weight: 600; font-size: 1.1rem; color: #5b4a22; }

.stats { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
.stat {
  display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
  padding: 0.7rem 0.4rem 0.6rem; border-radius: 1.1rem;
  background: var(--c-bg); border: 2px solid var(--c-soft);
  box-shadow: 0 0.22rem 0 var(--c-soft);
  animation: tile-in 0.5s var(--ease-back) both;
}
.stat:nth-child(2) { animation-delay: 0.08s; }
.stat:nth-child(3) { animation-delay: 0.16s; }
.stat b { font-family: var(--font-head); font-size: 1.45rem; font-weight: 700; color: var(--c-deep); line-height: 1.25; }
.stat small { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; }
.ic {
  width: 2.5rem; height: 2.5rem; margin-bottom: 0.2rem; border-radius: 50%;
  display: grid; place-items: center; color: #fff;
  background: linear-gradient(180deg, var(--c-light), var(--c));
  border: 2px solid #fff; box-shadow: 0 0.15rem 0 var(--c-deep);
}
.ic svg { width: 62%; height: 62%; stroke-width: 2.6; }
.ic.duo { background: none; border: 0; box-shadow: none; display: flex; gap: 0.2rem; width: auto; }
.ic.duo i { flex: none; width: 2.1rem; height: 2.1rem; border-radius: 50%; display: grid; place-items: center; border: 2px solid #fff; }
.ic.duo i svg { width: 60%; height: 60%; stroke: #fff; stroke-width: 3.2; }
.ic.duo .y { background: #3f9a3a; box-shadow: 0 0.15rem 0 #2c6e28; }
.ic.duo .n { background: #d9443a; box-shadow: 0 0.15rem 0 #9e2c24; }

.rule {
  margin: 0; display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.35rem 0.9rem; border-radius: 999px;
  background: #fff3cf; color: #7a5310; font-size: 0.9rem; font-weight: 600;
}
.rule svg { width: 1.15rem; height: 1.15rem; stroke-width: 2.4; flex: none; }

/* ================= ทำข้อสอบ ================= */
.play { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.hud { display: flex; align-items: center; gap: 0.8rem; min-height: 3.4rem; padding-right: 54px; /* เว้นที่ให้ฟันเฟือง */ }
.tag {
  flex: none; padding: 0.3rem 0.95rem; border-radius: 999px;
  font-family: var(--font-head); font-weight: 700; font-size: 0.95rem; color: #fff;
  background: linear-gradient(180deg, var(--c-light), var(--c));
  border: 2.5px solid #fff; box-shadow: 0 0.2rem 0 var(--c-deep);
  text-shadow: 0 1px 0 var(--c-deep);
}
.path { flex: 1; display: flex; align-items: center; justify-content: center; min-width: 0; }
.link { flex: 0 1 2.4rem; height: 0.45rem; margin: 0 -2px; background: rgba(255, 255, 255, 0.75); border-radius: 999px; transition: background 0.4s; }
.link.on { background: var(--c); }
.node {
  position: relative; z-index: 1; flex: none;
  width: 2.1rem; height: 2.1rem; border-radius: 50%;
  display: grid; place-items: center;
  font-family: var(--font-head); font-weight: 700; font-size: 0.95rem; color: #8a8f86;
  background: #fff; border: 3px solid #e2e6dc;
  box-shadow: 0 0.18rem 0 rgba(0, 0, 0, 0.12);
  transition: transform 0.3s var(--ease-back), background 0.3s, border-color 0.3s;
}
.node svg { width: 62%; height: 62%; stroke: #fff; stroke-width: 3.4; }
.node.now { color: var(--c-deep); border-color: var(--c); transform: scale(1.22); animation: glow 1.4s ease-in-out infinite; }
.node.done { background: var(--c); border-color: #fff; }
.node.ok { background: #3f9a3a; border-color: #fff; }
.node.bad { background: #d9443a; border-color: #fff; }

.ring { position: relative; flex: none; width: 3.4rem; height: 3.4rem; display: grid; place-items: center; }
.ring svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.ring .bg { fill: #fff; stroke: rgba(0, 0, 0, 0.08); stroke-width: 5; }
.ring .fg { fill: none; stroke: var(--c); stroke-width: 5; transition: stroke-dashoffset 0.25s linear, stroke 0.3s; }
.ring b { position: relative; font-family: var(--font-head); font-weight: 700; font-size: 0.85rem; color: var(--c-deep); font-variant-numeric: tabular-nums; }
.ring { filter: drop-shadow(0 0.2rem 0.3rem rgba(20, 50, 20, 0.25)); }
.ring.urgent .fg { stroke: #d9443a; }
.ring.urgent b { color: #c0392b; }
.ring.urgent { animation: tick-shake 1s ease-in-out infinite; }

.qarea {
  flex: 1; min-height: 0; width: min(48rem, 100%); margin: 0 auto;
  display: flex; flex-direction: column; justify-content: center; gap: clamp(0.9rem, 4vh, 1.8rem);
  padding-top: 0.9rem;
}
.qcard {
  padding: 2.1rem 2rem 1.6rem;
  min-height: 7rem; max-height: 100%;
  display: flex; flex-direction: column; align-items: stretch; justify-content: center;
}
/* เลื่อนเฉพาะตัวคำถาม (ถ้ายาวมาก) — ริบบิ้นด้านบนจะไม่ถูกตัด */
.qbody { min-height: 0; overflow-y: auto; }
.cat {
  position: absolute; top: 0.6rem; right: 1rem;
  font-size: 0.75rem; font-weight: 600; color: var(--c-deep); background: var(--c-bg);
  padding: 0.1rem 0.55rem; border-radius: 999px;
}
.qtext { margin: 0; text-align: center; font-size: 1.5rem; font-weight: 600; line-height: 1.6; color: #2e2a1f; }

.choices { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(0.8rem, 3vw, 1.6rem); padding: 0 0.4rem 0.5rem; }
.choice {
  position: relative; display: flex; align-items: center; justify-content: center; gap: 0.55em;
  min-height: 4.6rem; border-radius: 1.4rem; cursor: pointer;
  font-family: var(--font-head); font-weight: 700; font-size: 1.9rem; color: #fff;
  border: 4px solid #fff;
  transition: transform 0.14s var(--ease-out), box-shadow 0.14s, opacity 0.25s, filter 0.2s;
}
.choice.yes {
  background: linear-gradient(180deg, #8ce066 0%, #3f9a3a 100%);
  text-shadow: 0 2px 0 #2c6e28;
  box-shadow: 0 0.42rem 0 #2c6e28, 0 0.9rem 1.5rem rgba(20, 60, 20, 0.3);
}
.choice.no {
  background: linear-gradient(180deg, #ff8f80 0%, #d9443a 100%);
  text-shadow: 0 2px 0 #9e2c24;
  box-shadow: 0 0.42rem 0 #9e2c24, 0 0.9rem 1.5rem rgba(100, 20, 20, 0.3);
}
/* ไฮไลต์แก้วด้านบนปุ่ม */
.choice::before {
  content: ''; position: absolute; left: 0.9rem; right: 0.9rem; top: 0.3rem; height: 32%;
  border-radius: 999px; background: rgba(255, 255, 255, 0.35); pointer-events: none;
}
.bub {
  width: 1.55em; height: 1.55em; border-radius: 50%; background: #fff;
  display: grid; place-items: center; box-shadow: 0 0.12em 0 rgba(0, 0, 0, 0.15);
}
.bub svg { width: 62%; height: 62%; stroke-width: 3.6; }
.yes .bub svg { stroke: #3f9a3a; }
.no .bub svg { stroke: #d9443a; }
.choice:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.05); }
.choice.yes:active:not(:disabled) { transform: translateY(0.38rem); box-shadow: 0 0.05rem 0 #2c6e28, 0 0.3rem 0.6rem rgba(20, 60, 20, 0.25); }
.choice.no:active:not(:disabled) { transform: translateY(0.38rem); box-shadow: 0 0.05rem 0 #9e2c24, 0 0.3rem 0.6rem rgba(100, 20, 20, 0.25); }
.choice:disabled { cursor: default; }
.choice.picked { animation: chosen 0.42s var(--ease-back); z-index: 1; }
.choice.dim { opacity: 0.55; transform: scale(0.94); filter: grayscale(0.5); }

/* ================= ป๊อปอัปเฉลย (post) ================= */
.fb-back { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 1rem; background: rgba(15, 30, 20, 0.5); }
.fb {
  width: min(30rem, 94vw); max-height: 100%; overflow-y: auto;
  padding: 1.4rem 1.5rem 1.3rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.6rem; text-align: center;
}
.fb.ok { --c: #3f9a3a; --c-deep: #2c6e28; }
.fb.bad { --c: #d9443a; --c-deep: #9e2c24; animation: wrong 0.5s ease-in-out 0.35s; }
.stamp {
  display: inline-flex; align-items: center; gap: 0.35em;
  padding: 0.15em 0.8em; border-radius: 0.5em;
  font-family: var(--font-head); font-weight: 700; font-size: 2rem; color: var(--c);
  border: 4px solid var(--c); transform: rotate(-4deg);
  background: #fff;
  animation: stamp 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.stamp svg { width: 1em; height: 1em; stroke-width: 3.6; }
.ans { margin: 0; font-weight: 600; color: var(--text-muted); }
.ans b { font-family: var(--font-head); padding: 0 0.5em; border-radius: 999px; color: #fff; }
.ans b.y { background: #3f9a3a; }
.ans b.n { background: #d9443a; }
.exp {
  margin: 0; padding: 0.7rem 0.9rem; border-radius: 1rem; width: 100%;
  background: #fff; border: 2px dashed #eadfb8; text-align: left;
  font-size: 0.95rem; line-height: 1.6; color: var(--text);
}
.confetti { position: absolute; left: 50%; top: 2.2rem; width: 0; height: 0; pointer-events: none; }
.confetti i {
  position: absolute; width: 8px; height: 12px; border-radius: 2px;
  background: hsl(var(--h), 85%, 58%);
  animation: confetti 1s cubic-bezier(0.15, 0.8, 0.3, 1) both;
}

/* ---------- ทรานสิชัน ---------- */
.swap-enter-active, .swap-leave-active { transition: opacity 0.3s, transform 0.3s var(--ease-out); }
.swap-enter-from { opacity: 0; transform: scale(0.96); }
.swap-leave-to { opacity: 0; transform: scale(1.03); }
.q-enter-active { transition: transform 0.45s var(--ease-back), opacity 0.3s; }
.q-leave-active { transition: transform 0.25s ease-in, opacity 0.25s; }
.q-enter-from { transform: translateX(60px) rotate(2deg); opacity: 0; }
.q-leave-to { transform: translateX(-60px) rotate(-2deg); opacity: 0; }
.fb-enter-active { transition: opacity 0.25s; }
.fb-enter-active .fb { animation: board-in 0.45s var(--ease-back) both; }
.fb-leave-active { transition: opacity 0.2s; }
.fb-enter-from, .fb-leave-to { opacity: 0; }

@keyframes board-in { 0% { opacity: 0; transform: scale(0.7) translateY(20px); } 100% { opacity: 1; transform: none; } }
@keyframes tile-in { from { opacity: 0; transform: translateY(12px) scale(0.9); } }
@keyframes breathe { 50% { transform: scale(1.05); } }
@keyframes shine { 0%, 55% { left: -60%; } 100% { left: 130%; } }
@keyframes spin { to { rotate: 360deg; } }
@keyframes glow { 50% { box-shadow: 0 0.18rem 0 rgba(0, 0, 0, 0.12), 0 0 0 5px color-mix(in srgb, var(--c) 30%, transparent); } }
@keyframes tick-shake { 0%, 100% { transform: rotate(0); } 10% { transform: rotate(-8deg) scale(1.06); } 20% { transform: rotate(8deg) scale(1.06); } 30% { transform: rotate(0); } }
@keyframes chosen { 0% { transform: scale(1); } 45% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.8), 0 0 24px 8px rgba(255, 230, 120, 0.8); } 100% { transform: scale(1); } }
@keyframes stamp { 0% { opacity: 0; transform: rotate(-4deg) scale(2.4); } 100% { opacity: 1; transform: rotate(-4deg) scale(1); } }
@keyframes wrong { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
@keyframes confetti {
  0% { opacity: 1; transform: rotate(var(--a)) translateY(0) scale(0.4); }
  100% { opacity: 0; transform: rotate(var(--a)) translateY(calc(var(--d) * -1)) rotate(200deg) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .burst, .play-btn, .play-btn::after, .node.now, .ring.urgent { animation: none; }
}

/* ================= มือถือแนวนอน ================= */
@media (max-height: 500px) {
  .board { border-width: 3px; border-radius: 1.2rem; box-shadow: 0 0 0 2.5px var(--c), 0 0.35rem 0 2.5px var(--c-deep), 0 0.8rem 1.5rem rgba(20, 50, 20, 0.3); }
  .ribbon { font-size: 1.2rem; }
  .ribbon.small { font-size: 0.88rem; }
  .intro-wrap { padding-top: 1rem; }
  .intro { width: min(30rem, 88vw); padding: 2.2rem 1.2rem 1rem; gap: 0.6rem; }
  .tagline { font-size: 0.92rem; }
  .stats { gap: 0.5rem; }
  .stat { padding: 0.45rem 0.3rem 0.4rem; border-radius: 0.9rem; flex-direction: row; justify-content: center; gap: 0.4rem; flex-wrap: wrap; }
  .stat .ic { width: 1.9rem; height: 1.9rem; margin: 0; }
  .stat .ic.duo { width: auto; }
  .ic.duo i { width: 1.6rem; height: 1.6rem; }
  .stat b { font-size: 1.15rem; }
  .stat small { font-size: 0.7rem; width: 100%; }
  .rule { font-size: 0.78rem; padding: 0.25rem 0.75rem; }
  .play-btn { font-size: 1.25rem; }
  .play-btn.small { font-size: 1rem; }

  .hud { min-height: 2.9rem; gap: 0.5rem; padding-right: 48px; }
  .tag { font-size: 0.78rem; padding: 0.22rem 0.7rem; }
  .node { width: 1.7rem; height: 1.7rem; font-size: 0.8rem; border-width: 2.5px; }
  .link { height: 0.35rem; }
  .ring { width: 2.8rem; height: 2.8rem; }
  .ring b { font-size: 0.72rem; }
  .qarea { gap: 0.9rem; padding-top: 0.7rem; }
  .qcard { padding: 1.6rem 1.3rem 1rem; min-height: 5.5rem; }
  .qtext { font-size: 1.15rem; line-height: 1.55; }
  .cat { font-size: 0.65rem; top: 0.4rem; right: 0.7rem; }
  .choice { min-height: 3.4rem; font-size: 1.4rem; border-width: 3px; border-radius: 1.1rem; }
  .fb { padding: 1rem 1.1rem 0.9rem; gap: 0.45rem; }
  .stamp { font-size: 1.5rem; border-width: 3px; }
  .exp { font-size: 0.8rem; line-height: 1.5; padding: 0.5rem 0.7rem; }
}
</style>
