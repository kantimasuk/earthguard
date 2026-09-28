<script setup>
// หน้าสรุปผล: อันดับ + ตารางคะแนนแยกรายการ (รวม AI) และผล Pre-test เทียบ Post-test
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import AppNavbar from '@/components/AppNavbar.vue';
import BaseModal from '@/components/BaseModal.vue';
import PlayerAvatar from '@/components/PlayerAvatar.vue';
import { sessionApi, sessionErrorMessage } from '@/services/sessionApi';
import { AI_LIST } from '@/game/avatars';
import { useSessionStore } from '@/stores/session';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { play } from '@/services/sound';

const router = useRouter();
const session = useSessionStore();
const auth = useAuthStore();
const toast = useToastStore();

const data = ref(null);
const loading = ref(true);
const showLoader = ref(true); // หน้าโหลดเต็มจอ
const again = ref(false);
const logOpen = ref(false);

const players = computed(() => data.value?.players || []);
const winners = computed(() => players.value.filter((p) => p.rank === 1));
const iWon = computed(() => winners.value.some((p) => p.isMe));
const headline = computed(() => {
  if (!winners.value.length) return '';
  if (iWon.value) return winners.value.length > 1 ? 'คุณชนะร่วม!' : 'คุณชนะ!';
  return winners.value.length > 1 ? 'ชนะร่วมกัน' : `${winners.value[0].name} ชนะ`;
});
const pre = computed(() => data.value?.pre);
const post = computed(() => data.value?.post);
const delta = computed(() => (pre.value && post.value ? post.value.score - pre.value.score : null));
const deltaText = computed(() => {
  if (delta.value === null) return '';
  if (delta.value > 0) return `ตอบถูกเพิ่มขึ้น ${delta.value} ข้อ`;
  if (delta.value < 0) return `ตอบถูกลดลง ${-delta.value} ข้อ`;
  return 'ตอบถูกเท่าเดิม';
});
const logByTurn = computed(() => {
  const groups = [];
  for (const l of data.value?.log || []) {
    let g = groups[groups.length - 1];
    if (!g || g.turn !== l.turn) groups.push((g = { turn: l.turn, phase: l.phase, items: [] }));
    g.items.push(l);
  }
  return groups;
});

function avatarFor(p) {
  if (p.isMe) return { isAi: false, avatar: auth.avatar };
  const ai = AI_LIST.find((a) => a.name === p.name);
  return { isAi: true, avatar: ai?.avatar || 'leaf' };
}

onMounted(async () => {
  if (!session.id) return router.replace('/menu');
  // ผลเกมอาจบันทึกไม่ทันเสร็จ → ลองใหม่อีก 2 ครั้ง
  for (let i = 0; i < 3; i++) {
    try {
      data.value = await sessionApi.summary(session.id);
      if (data.value.players.length) break;
    } catch (e) {
      toast.show(sessionErrorMessage(e), { type: 'error' });
      break;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  loading.value = false;
  if (iWon.value) setTimeout(() => play('win'), 300);
});

function home() {
  play('click');
  session.clear();
  router.replace('/menu');
}

async function playAgain() {
  if (again.value) return;
  play('tap');
  again.value = true;
  try {
    const res = await sessionApi.create(session.current?.difficulty || 'easy');
    session.start(res);
    router.replace('/pretest');
  } catch (e) {
    toast.show(sessionErrorMessage(e), { type: 'error' });
    again.value = false;
  }
}
</script>

<template>
  <main class="page summary">
    <AppNavbar />

    <section class="content">
      <template v-if="loading" />

      <template v-else-if="data">
        <!-- ผลเกม -->
        <article class="result panel">
          <header class="res-head" :class="{ win: iWon }">
            <svg class="trophy" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z M8 6H5a3 3 0 0 0 3 3.5 M16 6h3a3 3 0 0 1-3 3.5 M12 12v4 M8.5 20h7 M9.5 16h5v4h-5z" /></svg>
            <div>
              <h1>{{ headline }}</h1>
              <p>ผลการแข่งขัน · ระดับ{{ { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' }[data.session.difficulty] }}</p>
            </div>
          </header>

          <div class="table" role="table" aria-label="ตารางคะแนน">
            <div class="tr th" role="row">
              <span role="columnheader">อันดับ</span>
              <span role="columnheader" class="c-name">ผู้เล่น</span>
              <span role="columnheader" title="คะแนนจากการ์ดสิทธิ">สิทธิ</span>
              <span role="columnheader" title="โบนัสป้องกันภัยครบ 2 ครั้ง">โบนัส</span>
              <span role="columnheader" title="เหรียญที่เหลือ หักเหรียญละ 1">เหรียญ</span>
              <span role="columnheader" title="การ์ดที่เหลือในมือ">การ์ดเหลือ</span>
              <span role="columnheader" title="จำนวนครั้งที่การ์ดสิทธิเชิงเนื้อหาป้องกันภัยได้ (ใช้ตัดสินเมื่อคะแนนเท่ากัน)">ป้องกัน</span>
              <span role="columnheader">รวม</span>
            </div>
            <div
              v-for="(p, i) in players"
              :key="p.seat"
              class="tr"
              :class="{ me: p.isMe, first: p.rank === 1 }"
              role="row"
              :style="{ animationDelay: 0.08 * i + 's' }"
            >
              <span class="rank" :class="`r${p.rank}`">{{ p.rank }}</span>
              <span class="c-name">
                <PlayerAvatar class="pav" v-bind="avatarFor(p)" :name="p.name" size="1.9rem" />
                <b>{{ p.name }}</b>
                <em v-if="p.isMe">คุณ</em>
                <em v-else class="ai">AI</em>
              </span>
              <span>{{ p.rightsPoints }}</span>
              <span class="plus">{{ p.bonus ? '+' + p.bonus : '0' }}</span>
              <span class="minus">{{ p.coinPenalty ? '−' + p.coinPenalty : '0' }}</span>
              <span class="muted">{{ p.cardsLeft }}</span>
              <span class="muted">{{ p.protectCount }}</span>
              <span class="total">{{ p.total }}</span>
            </div>
          </div>
          <p class="tie">คะแนนเท่ากัน ตัดสินด้วยจำนวนครั้งที่ป้องกันภัยได้ · ถ้ายังเท่ากันถือว่าชนะร่วม</p>
          <button type="button" class="link-btn log-link" @click="play('click'); logOpen = true">ดูบันทึกเหตุการณ์ทั้งหมด (Game Log)</button>
        </article>

        <!-- ผลการเรียนรู้ -->
        <aside class="learn panel">
          <h2>ผลการเรียนรู้</h2>
          <div class="bars">
            <div class="bar">
              <span class="lbl">ก่อนเล่น</span>
              <div class="track"><div class="fill pre" :style="{ width: pre ? (pre.score / pre.total) * 100 + '%' : '0%' }" /></div>
              <b>{{ pre ? `${pre.score}/${pre.total}` : '-' }}</b>
            </div>
            <div class="bar">
              <span class="lbl">หลังเล่น</span>
              <div class="track"><div class="fill post" :style="{ width: post ? (post.score / post.total) * 100 + '%' : '0%' }" /></div>
              <b>{{ post ? `${post.score}/${post.total}` : '-' }}</b>
            </div>
          </div>
          <p v-if="deltaText" class="delta" :class="{ up: delta > 0, down: delta < 0 }">
            <svg v-if="delta > 0" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5 M6 11l6-6 6 6" /></svg>
            <svg v-else-if="delta < 0" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14 M6 13l6 6 6-6" /></svg>
            {{ deltaText }}
          </p>
          <div class="actions">
            <button type="button" class="btn btn--block" :disabled="again" @click="playAgain">
              <span v-if="again" class="spinner" />
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7 M20 4v4h-4" /></svg>
              เล่นอีกครั้ง
            </button>
            <button type="button" class="btn btn--light btn--block" @click="home">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5 M5.5 10v10h13V10 M10 20v-5h4v5" /></svg>
              กลับหน้าหลัก
            </button>
          </div>
        </aside>
      </template>

      <div v-else class="loading">
        โหลดผลไม่สำเร็จ
        <button type="button" class="btn" @click="home">กลับหน้าหลัก</button>
      </div>
    </section>

    <BaseModal :open="logOpen" title="บันทึกเหตุการณ์ (Game Log)" width="36rem" @close="logOpen = false">
      <div class="log">
        <section v-for="g in logByTurn" :key="g.turn + '-' + g.items[0].seq">
          <h5>ตาที่ {{ g.turn }} · ช่วงที่ {{ g.phase }}</h5>
          <p v-for="l in g.items" :key="l.seq" :class="{ auto: l.auto, threat: l.action === 'threat' || l.action === 'lose' }">{{ l.text }}</p>
        </section>
      </div>
    </BaseModal>
    <LoadingScreen v-if="showLoader" :done="!loading" label="กำลังสรุปผล" @finished="showLoader = false" />
  </main>
</template>

<style scoped>
.content {
  flex: 1; min-height: 0;
  display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr);
  gap: clamp(10px, 2vw, 24px); align-items: center;
  width: min(66rem, 100%); margin: 0 auto; padding: 10px 0;
}
.loading { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 0.8rem; font-weight: 600; color: #24452b; }
.spin { width: 1.6rem; height: 1.6rem; border: 3px solid var(--leaf); border-right-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; }

.result { padding: 1rem 1.2rem 0.7rem; display: flex; flex-direction: column; gap: 0.7rem; min-height: 0; max-height: 100%; overflow: hidden; animation: rise 0.5s var(--ease-back); }
.res-head { display: flex; align-items: center; gap: 0.8rem; }
.trophy { width: 2.8rem; height: 2.8rem; padding: 0.45rem; border-radius: 0.9rem; background: #eef2ea; fill: none; stroke: #7d8b7f; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.win .trophy { background: #fff1c7; stroke: #c9912a; animation: bounce 1.4s var(--ease-back) infinite; }
.res-head h1 { font-size: 1.6rem; color: #24452b; }
.win h1 { color: #b07a12; }
.res-head p { font-size: 0.85rem; color: var(--text-muted); }

.table { display: flex; flex-direction: column; gap: 0.3rem; overflow-y: auto; min-height: 0; }
.tr {
  display: grid; grid-template-columns: 2.6rem minmax(0, 1fr) repeat(5, 3.4rem) 3.2rem;
  align-items: center; gap: 0.3rem; padding: 0.35rem 0.5rem; border-radius: 0.8rem;
  background: #f6f8f3; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums;
  animation: rise 0.45s var(--ease-back) both;
}
.th { background: none; font-size: 0.78rem; color: var(--text-muted); font-weight: 600; padding-top: 0; padding-bottom: 0; animation: none; }
.tr.me { background: #fff6d8; box-shadow: inset 0 0 0 1.5px #f0cf7a; }
.c-name { display: flex; align-items: center; gap: 0.45rem; text-align: left; min-width: 0; }
.c-name b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-name em { font-style: normal; font-size: 0.7rem; padding: 0.05rem 0.45rem; border-radius: 999px; background: #f2c14e; color: #5c3d00; flex: none; }
.c-name em.ai { background: #e3ebe0; color: #56655a; }
.rank { width: 2rem; height: 2rem; margin: 0 auto; border-radius: 50%; display: grid; place-items: center; background: #e7ece4; color: #56655a; font-family: var(--font-head); }
.rank.r1 { background: linear-gradient(135deg, #ffe07a, #f0b429); color: #6b4500; box-shadow: 0 2px 6px rgba(200, 140, 20, 0.4); }
.rank.r2 { background: linear-gradient(135deg, #eef1f4, #c3ccd4); color: #45525c; }
.rank.r3 { background: linear-gradient(135deg, #f5d9bf, #d69a64); color: #5b3514; }
.plus { color: #2f7a2e; }
.minus { color: #b8433a; }
.muted { color: var(--text-muted); font-weight: 500; }
.total { font-family: var(--font-head); font-size: 1.15rem; color: var(--leaf-dark); }
.log-link { align-self: center; font-size: 0.85rem; }
.tie { font-size: 0.75rem; color: var(--text-faint); text-align: center; }

.learn { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; animation: rise 0.5s 0.15s var(--ease-back) both; }
.learn h2 { font-size: 1.2rem; color: var(--accent); }
.bars { display: flex; flex-direction: column; gap: 0.55rem; }
.bar { display: grid; grid-template-columns: 4.2rem 1fr 2.4rem; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
.bar b { text-align: right; font-family: var(--font-head); }
.track { height: 0.9rem; border-radius: 999px; background: #e9ede5; overflow: hidden; }
.fill { height: 100%; border-radius: inherit; transition: width 1s var(--ease-out); animation: grow 1.1s var(--ease-out) both; transform-origin: left; }
.fill.pre { background: #9fb7a2; }
.fill.post { background: var(--leaf); animation-delay: 0.3s; }
.delta { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; color: var(--text-muted); font-size: 0.95rem; }
.delta svg { width: 1.2rem; height: 1.2rem; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.delta.up { color: #2f7a2e; }
.delta.down { color: #b8433a; }
.actions { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.2rem; }
.actions svg { width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

.log { display: flex; flex-direction: column; gap: 0.7rem; font-size: 0.88rem; }
.log h5 { margin: 0 0 0.2rem; font-size: 0.82rem; color: var(--accent); }
.log p { padding: 0.15rem 0 0.15rem 0.6rem; border-left: 2px solid #e3eadf; color: var(--text); line-height: 1.45; }
.log p.auto { color: var(--text-muted); font-style: italic; }
.log p.threat { border-left-color: #e8958c; }

@keyframes rise { from { opacity: 0; transform: translateY(14px); } }
@keyframes grow { from { transform: scaleX(0); } }
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

@media (max-height: 500px) {
  .content { padding: 50px 0 4px; gap: 10px; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr); }
  .tie { font-size: 0.62rem; }
  .result { padding: 0.6rem 0.8rem 0.4rem; gap: 0.45rem; border-radius: 1.1rem; }
  .trophy { width: 2.1rem; height: 2.1rem; padding: 0.35rem; border-radius: 0.7rem; }
  .res-head h1 { font-size: 1.15rem; }
  .trophy { display: none; }
  .res-head p { font-size: 0.7rem; }
  .tr { grid-template-columns: 1.7rem minmax(0, 1fr) repeat(5, 2.2rem) 2.2rem; gap: 0.15rem; padding: 0.22rem 0.35rem; font-size: 0.78rem; border-radius: 0.6rem; }
  .th { font-size: 0.62rem; }
  .rank { width: 1.4rem; height: 1.4rem; font-size: 0.75rem; }
  .pav { display: none; }
  .c-name { gap: 0.3rem; }
  .c-name em { font-size: 0.58rem; }
  .total { font-size: 0.95rem; }
  .log-link { font-size: 0.72rem; min-height: 26px; padding: 0.1rem; }
  .learn { padding: 0.7rem 0.85rem; gap: 0.5rem; border-radius: 1.1rem; }
  .learn h2 { font-size: 1rem; }
  .bar { font-size: 0.75rem; grid-template-columns: 3.4rem 1fr 2rem; }
  .track { height: 0.7rem; }
  .delta { font-size: 0.78rem; }
  .actions .btn { min-height: 34px; font-size: 0.85rem; }
}
</style>
