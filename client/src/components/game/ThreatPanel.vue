<script setup>
// แผงจัดการภัยคุกคาม: ใครปลอดภัย → เลือกใช้เหรียญแบบลับ → เปิดเหรียญพร้อมกัน → ใครเสียการ์ดอะไร
import { computed, inject, onMounted, onBeforeUnmount } from 'vue';
import { openModals } from '@/components/modalState';
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
// นับเป็นป๊อปอัปที่เปิดอยู่ → ปุ่มฟันเฟืองซ่อนตัว ไม่ทับมุมขวาบนของแผง
onMounted(() => { openModals.value++; });
onBeforeUnmount(() => { openModals.value--; });
const many = computed(() => props.players.length >= 4);

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
    <section class="panel tp" :class="{ many }" role="dialog" aria-label="ภัยคุกคาม">
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
          <span v-if="r.safe === 'right'" class="st ok">ปลอดภัย<span class="why"> · มีสิทธิป้องกัน</span></span>
          <span v-else-if="r.safe === 'justice'" class="st ok">ปลอดภัย<span class="why"> · มือ ≤ 2 ใบ</span></span>
          <template v-else-if="r.unsafe">
            <span v-if="r.lost" class="st bad">เสียการ์ด {{ r.lost.length }} ใบ</span>
            <span v-else-if="r.groupSafe" class="st ok">ปลอดภัย<span class="why"> · รวมกลุ่ม</span></span>
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

      <footer class="foot">
      <p class="msg" :class="{ good: ui.success && (ui.stage === 'reveal' || ui.stage === 'done'), alert: choosing }">{{ message }}</p>

      <div v-if="choosing" class="choose">
        <p class="rule">ใช้เหรียญพร้อมกัน<b>มากกว่า 1 คน</b> = ทุกคนที่ใช้ปลอดภัย (เหรียญที่ใช้หายไป) · ถ้าไม่สำเร็จได้เหรียญคืน</p>
        <div class="btns">
          <button type="button" class="btn use" :disabled="busy || myCoins <= 0" @click="choose(true)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="COIN_ICON" /></svg>
            ใช้เหรียญ ({{ myCoins }})
          </button>
          <button type="button" class="btn btn--light" :disabled="busy" @click="choose(false)">ไม่ใช้</button>
          <TimerRing v-if="timer" :deadline="timer.deadline" :duration="timer.duration" :size="40" />
        </div>
      </div>
      </footer>
      </div>
    </section>
  </div>
</template>

<style scoped>
.threat-wrap {
  position: fixed; inset: 0; z-index: 40; display: grid; place-items: center;
  grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, 1fr);
  padding: calc(var(--safe-t) + 14px) calc(var(--safe-r) + 14px) calc(var(--safe-b) + 14px) calc(var(--safe-l) + 14px);
  background: radial-gradient(circle at 50% 50%, rgba(60, 20, 20, 0.25), rgba(30, 10, 10, 0.55));
  pointer-events: auto;
}
/* การ์ดใหญ่ซ้าย + รายละเอียดขวา อยู่กลางจอ (กว้างขึ้น ให้ข้อความไม่อัดแน่น) */
.tp {
  width: min(54rem, 100%); max-height: 100%; min-height: 0;
  display: flex; gap: 1.6rem; padding: 1.3rem 1.6rem; animation: up 0.4s var(--ease-back);
  background: rgba(255, 255, 255, 0.96); border: 2px solid #ffc9c1; border-radius: 1.4rem;
  box-shadow: 0 16px 40px rgba(60, 30, 30, 0.3);
  backdrop-filter: none;
}
.big { flex: none; height: min(62vh, 25rem); aspect-ratio: 5 / 7; align-self: center; animation: card-in 0.5s var(--ease-back); }
.big :deep(.bigimg) { width: 100%; height: 100%; border-radius: 6%/4%; box-shadow: 0 10px 26px rgba(80, 20, 20, 0.35); }
/* ฝั่งขวา: หัวข้อ (คงที่) · รายชื่อ (เลื่อนได้ถ้าจอเตี้ย) · ข้อความ + ปุ่ม (คงที่ ไม่ถูกตัด) */
.side { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 1.05rem; }
@keyframes card-in { from { transform: scale(0.6) rotate(-6deg); opacity: 0; } }
.th { flex: none; display: flex; flex-direction: column; gap: 0.45rem; padding-bottom: 0.85rem; border-bottom: 1.5px dashed #f3d3cd; }
.th small { align-self: flex-start; font-size: 0.8rem; font-weight: 700; color: #b8433a; background: #ffece8; padding: 0.2rem 0.75rem; border-radius: 999px; line-height: 1.4; }
.th h3 { font-size: 1.45rem; color: #3a1f1f; line-height: 1.35; }
.list {
  flex: 0 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  list-style: none; margin: 0; padding: 0.1rem; display: flex; flex-direction: column; gap: 0.5rem;
}
.list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.8rem; border-radius: 0.85rem; background: #f7f8f6; min-height: 2.6rem; }
.list li.me { background: #fff6d8; }
.nm { font-weight: 700; min-width: 4.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st { font-size: 0.8rem; font-weight: 600; padding: 0.2rem 0.75rem; border-radius: 999px; line-height: 1.4; white-space: nowrap; }
.st.ok { background: #e2f3de; color: #2f7a2e; }
.st.bad { background: #fde3df; color: #b8433a; }
.st.wait { margin-left: auto; color: var(--text-faint); font-weight: 500; padding-right: 0; }
.coin {
  /* สองหน้าซ้อนกันด้วย grid → ความกว้างพอดีข้อความเสมอ ("ไม่ใช้" ไม่ล้นกรอบแม้ฟอนต์เครื่องใหญ่) */
  position: relative; flex: none; display: inline-grid; margin-left: auto; perspective: 300px;
  min-width: 3.4rem; height: 1.6rem;
}
.coin.hidden { display: none; }
.face {
  grid-area: 1 / 1; display: flex; align-items: center; justify-content: center; gap: 0.2rem;
  padding: 0 0.5rem; border-radius: 999px; white-space: nowrap;
  font-size: 0.75rem; font-weight: 700; line-height: 1; backface-visibility: hidden; -webkit-backface-visibility: hidden;
  transition: transform 0.6s var(--ease-back);
}
.back { background: #8d7a52; color: #fff4d6; border: 2px solid #6b5a38; }
.front { background: #e8ebe5; color: #56655a; border: 2px solid #c8cec4; transform: rotateY(180deg); }
.coin.used .front { background: #f2c14e; color: #6b4500; border-color: #b37d0c; }
.front svg { flex: none; width: 0.9rem; height: 0.9rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
.coin.flip .back { transform: rotateY(180deg); }
.coin.flip .front { transform: rotateY(360deg); }
.foot { flex: none; display: flex; flex-direction: column; gap: 0.75rem; }
.msg { margin: 0; padding: 0.6rem 0.9rem; border-radius: 0.85rem; background: #fdf9f0; text-align: center; font-weight: 700; color: var(--text); line-height: 1.45; }
.msg.good { color: #2f7a2e; }
.msg.alert { color: #c0392b; }
.choose { display: flex; flex-direction: column; gap: 0.7rem; }
.rule { margin: 0; font-size: 0.8rem; color: var(--text-muted); text-align: center; line-height: 1.5; }
.btns { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
.btns .btn { min-width: 7.5rem; }
.use { --btn-bg: #f2c14e; --btn-edge: #b37d0c; --btn-ink: #5c3d00; }
.use svg { width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
@keyframes up { from { transform: translateY(30px); opacity: 0; } }

/* โทรศัพท์แนวนอน: ลดขนาดตัวอักษรเล็กน้อย แต่ยังเว้นช่องไฟให้อ่านสบาย */
@media (max-height: 500px) {
  .tp { width: min(50rem, 100%); gap: 1rem; padding: 0.75rem 1rem; border-radius: 1.1rem; }
  .big { height: min(76vh, 17rem); }
  .side { gap: 0.6rem; }
  .th { gap: 0.25rem; padding-bottom: 0.5rem; }
  .th h3 { font-size: 1.05rem; }
  .th small { font-size: 0.68rem; padding: 0.1rem 0.6rem; }
  .list { gap: 0.32rem; }
  .list li { min-height: 0; padding: 0.28rem 0.6rem; gap: 0.55rem; font-size: 0.84rem; }
  .st { font-size: 0.68rem; padding: 0.12rem 0.55rem; }
  .coin { height: 1.4rem; min-width: 3rem; }
  .face { font-size: 0.68rem; padding: 0 0.4rem; }
  .foot { gap: 0.45rem; }
  .msg { padding: 0.32rem 0.7rem; font-size: 0.82rem; }
  .choose { gap: 0.4rem; }
  .rule { font-size: 0.68rem; line-height: 1.4; }
  .btns .btn { min-height: 34px; min-width: 6.5rem; font-size: 0.85rem; }
}
/* จอเตี้ยมาก (iPhone SE / Android เล็ก ≤ 380px) + ผู้เล่น 4–5 คน: รายชื่อ 2 คอลัมน์ ตัดคำอธิบายย่อย ให้ปุ่มไม่หลุดจอ */
@media (max-height: 380px) {
  .big { height: min(80vh, 14rem); }
  .tp.many .list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tp.many .why { display: none; }
  .tp.many .nm { min-width: 2.8rem; flex: 1; }
  .tp.many .coin { min-width: 2.7rem; }
  .tp.many .face { padding: 0 0.3rem; }
  .tp.many .list li { gap: 0.4rem; padding: 0.28rem 0.45rem; }
  .rule { display: none; }
}
</style>
