<script setup>
// แผงจัดการภัยคุกคาม: ใครปลอดภัย → เลือกใช้เหรียญแบบลับ → เปิดเหรียญพร้อมกัน → ใครเสียการ์ดอะไร
import { computed, inject } from 'vue';
import PlayerAvatar from '@/components/PlayerAvatar.vue';
import TimerRing from './TimerRing.vue';
import CardImg from './CardImg.vue';
import { COIN_ICON } from '@/game/icons';
import { play } from '@/services/sound';

const props = defineProps({
  ui: { type: Object, required: true },
  players: { type: Array, required: true },
  me: { type: String, required: true },
  myCoins: { type: Number, default: 0 },
  myAvatar: { type: String, default: null },
  timer: { type: Object, default: null },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['choose']);
const cards = inject('cards');
const threat = computed(() => cards[props.ui.card]);

const rows = computed(() => props.players.map((p) => {
  const safe = props.ui.safe[p.id];
  const unsafe = props.ui.unsafe.includes(p.id);
  const lost = props.ui.losses[p.id];
  const chosen = props.ui.chosen.includes(p.id);
  const revealed = props.ui.stage === 'reveal' || props.ui.stage === 'done';
  const used = props.ui.choices?.[p.id];
  const groupSafe = revealed && props.ui.success && used;
  return { p, safe, unsafe, lost, chosen, revealed, used, groupSafe };
}));

const iAmAtRisk = computed(() => props.ui.unsafe.includes(props.me));
const choosing = computed(() => props.ui.stage === 'choose' && iAmAtRisk.value && !props.ui.chosen.includes(props.me));
const message = computed(() => {
  const s = props.ui.stage;
  if (s === 'check') return 'ตรวจการป้องกันด้วยการ์ดสิทธิ...';
  if (choosing.value) return 'คุณยังไม่ปลอดภัย! จะใช้เหรียญรวมกลุ่มไหม?';
  if (s === 'choose' || s === 'waiting') return 'ผู้เล่นที่ยังไม่ปลอดภัยกำลังเลือกแบบลับ...';
  if (!props.ui.unsafe.length) return s === 'check' ? 'ตรวจการป้องกันด้วยการ์ดสิทธิ...' : 'ทุกคนปลอดภัย!';
  if (s === 'reveal' || s === 'done') {
    const users = Object.values(props.ui.choices || {}).filter(Boolean).length;
    return props.ui.success ? `รวมกลุ่มสำเร็จ! ใช้เหรียญ ${users} คน ทุกคนที่ใช้ปลอดภัย` : users ? 'รวมกลุ่มไม่สำเร็จ (ใช้เหรียญคนเดียว) · คืนเหรียญ' : 'ไม่มีใครใช้เหรียญ';
  }
  return '';
});

function choose(use) {
  if (props.busy) return;
  play(use ? 'coin' : 'click');
  emit('choose', use);
}
</script>

<template>
  <div class="threat-wrap">
    <section class="panel tp" role="dialog" aria-label="ภัยคุกคาม">
      <!-- การ์ดภัยคุกคามใบใหญ่ (ซ้าย) -->
      <div class="big">
        <CardImg :id="ui.card" class="bigimg" width="100%" />
      </div>
      <div class="side">
      <header class="th">
        <small>ภัยคุกคาม · ผู้ที่ไม่ปลอดภัยถูกสุ่มทิ้งการ์ด {{ threat.discardCount }} ใบ</small>
        <h3>{{ threat.name }}</h3>
      </header>

      <ul class="list">
        <li v-for="r in rows" :key="r.p.id" :class="{ me: r.p.id === me }">
          <PlayerAvatar :is-ai="r.p.isAI" :avatar="r.p.isAI ? r.p.avatar : myAvatar" :name="r.p.name" size="1.6rem" />
          <span class="nm">{{ r.p.id === me ? 'คุณ' : r.p.name }}</span>
          <span v-if="r.safe === 'right'" class="st ok">ปลอดภัย · มีสิทธิป้องกัน</span>
          <span v-else-if="r.safe === 'justice'" class="st ok">ปลอดภัย · มือ ≤ 2 ใบ</span>
          <template v-else-if="r.unsafe">
            <span v-if="r.lost" class="st bad">เสียการ์ด {{ r.lost.length }} ใบ</span>
            <span v-else-if="r.groupSafe" class="st ok">ปลอดภัย · รวมกลุ่ม</span>
            <span class="coin" :class="{ flip: r.revealed, used: r.used, hidden: !r.chosen && !r.revealed }" :aria-label="r.revealed ? (r.used ? 'ใช้เหรียญ' : 'ไม่ใช้') : 'เลือกแล้ว'">
              <span class="face back">?</span>
              <span class="face front">
                <svg viewBox="0 0 24 24"><path :d="COIN_ICON" /></svg>
                {{ r.used ? 'ใช้' : 'ไม่ใช้' }}
              </span>
            </span>
            <span v-if="!r.chosen && !r.revealed" class="st wait">กำลังคิด...</span>
          </template>
        </li>
      </ul>

      <p class="msg" :class="{ good: ui.success && (ui.stage === 'reveal' || ui.stage === 'done'), alert: choosing }">{{ message }}</p>

      <div v-if="choosing" class="choose">
        <p class="rule">ถ้ามีคนใช้เหรียญ<b>มากกว่า 1 คน</b> ทุกคนที่ใช้จะปลอดภัย (เหรียญที่ใช้หายไป) · ถ้าไม่สำเร็จจะได้เหรียญคืน</p>
        <div class="btns">
          <button type="button" class="btn use" :disabled="busy || myCoins <= 0" @click="choose(true)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="COIN_ICON" /></svg>
            ใช้เหรียญ ({{ myCoins }})
          </button>
          <button type="button" class="btn btn--light" :disabled="busy" @click="choose(false)">ไม่ใช้</button>
          <TimerRing v-if="timer" :deadline="timer.deadline" :duration="timer.duration" :size="40" />
        </div>
      </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.threat-wrap {
  position: fixed; inset: 0; z-index: 40; display: grid; place-items: center;
  grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, 1fr);
  padding: calc(var(--safe-t) + 12px) calc(var(--safe-r) + 12px) calc(var(--safe-b) + 12px) calc(var(--safe-l) + 12px);
  background: radial-gradient(circle at 50% 50%, rgba(60, 20, 20, 0.25), rgba(30, 10, 10, 0.55));
  pointer-events: auto;
}
/* การ์ดใหญ่ซ้าย + รายละเอียดขวา อยู่กลางจอ */
.tp {
  width: min(56rem, 100%); max-height: 100%; min-height: 0;
  display: flex; gap: 1.1rem; padding: 1rem 1.2rem; animation: up 0.4s var(--ease-back);
  background: rgba(255, 255, 255, 0.95); border: 2px solid #ffc9c1; border-radius: 1.4rem;
  box-shadow: 0 16px 40px rgba(60, 30, 30, 0.3);
  backdrop-filter: none;
}
.big { flex: none; height: min(64vh, 26rem); aspect-ratio: 5 / 7; align-self: center; animation: card-in 0.5s var(--ease-back); }
.big :deep(.bigimg) { width: 100%; height: 100%; border-radius: 6%/4%; box-shadow: 0 10px 26px rgba(80, 20, 20, 0.35); }
.side { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 1rem; overflow-y: auto; padding: 0.3rem 0.2rem; }
@keyframes card-in { from { transform: scale(0.6) rotate(-6deg); opacity: 0; } }
.th { display: flex; flex-direction: column; gap: 0.35rem; padding-bottom: 0.7rem; border-bottom: 1.5px dashed #f3d3cd; }
.th small { align-self: flex-start; font-size: 0.78rem; font-weight: 700; color: #b8433a; background: #ffece8; padding: 0.15rem 0.7rem; border-radius: 999px; line-height: 1.4; }
.th h3 { font-size: 1.4rem; color: #3a1f1f; line-height: 1.35; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.45rem 0.7rem; border-radius: 0.8rem; background: #f7f8f6; }
.list li.me { background: #fff6d8; }
.nm { font-weight: 700; min-width: 4.2rem; }
.st { font-size: 0.8rem; font-weight: 600; padding: 0.2rem 0.7rem; border-radius: 999px; line-height: 1.4; }
.st.ok { background: #e2f3de; color: #2f7a2e; }
.st.bad { background: #fde3df; color: #b8433a; }
.st.wait { color: var(--text-faint); font-weight: 500; }
.coin { position: relative; width: 3.4rem; height: 1.6rem; perspective: 300px; margin-left: auto; }
.coin.hidden { visibility: hidden; }
.face {
  position: absolute; inset: 0; border-radius: 999px; display: flex; align-items: center; justify-content: center; gap: 0.2rem;
  font-size: 0.75rem; font-weight: 700; backface-visibility: hidden; transition: transform 0.6s var(--ease-back);
}
.back { background: #8d7a52; color: #fff4d6; border: 2px solid #6b5a38; }
.front { background: #e8ebe5; color: #56655a; border: 2px solid #c8cec4; transform: rotateY(180deg); }
.coin.used .front { background: #f2c14e; color: #6b4500; border-color: #b37d0c; }
.front svg { width: 0.9rem; height: 0.9rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
.coin.flip .back { transform: rotateY(180deg); }
.coin.flip .front { transform: rotateY(360deg); }
.msg { margin: 0.2rem 0 0; padding: 0.55rem 0.8rem; border-radius: 0.8rem; background: #fdf9f0; text-align: center; font-weight: 700; color: var(--text); line-height: 1.45; }
.msg.good { color: #2f7a2e; }
.msg.alert { color: #c0392b; }
.choose { display: flex; flex-direction: column; gap: 0.45rem; }
.rule { font-size: 0.78rem; color: var(--text-muted); text-align: center; line-height: 1.45; }
.btns { display: flex; align-items: center; justify-content: center; gap: 0.6rem; }
.use { --btn-bg: #f2c14e; --btn-edge: #b37d0c; --btn-ink: #5c3d00; }
.use svg { width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
@keyframes up { from { transform: translateY(30px); opacity: 0; } }
@media (max-height: 500px) {
  .side { gap: 0.55rem; }
  .th { padding-bottom: 0.4rem; gap: 0.2rem; }
  .msg { padding: 0.3rem 0.6rem; font-size: 0.8rem; }
  .th h3 { font-size: 0.92rem; }
  .th small { font-size: 0.66rem; }
  .list { gap: 0.3rem; }
  .list li { padding: 0.25rem 0.5rem; gap: 0.5rem; font-size: 0.82rem; }
  .st { font-size: 0.68rem; }
  .coin { height: 1.4rem; width: 3rem; }
  .msg { font-size: 0.82rem; }
  .rule { font-size: 0.68rem; }
  .btns .btn { min-height: 34px; font-size: 0.85rem; }
}
@media (max-height: 500px) {
  .tp { gap: 0.7rem; padding: 0.6rem 0.8rem; border-radius: 1.1rem; }
  .big { height: min(74vh, 16rem); }
  .th h3 { font-size: 1.05rem; }
  .th small { font-size: 0.66rem; }
}
</style>
