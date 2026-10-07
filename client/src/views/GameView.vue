<script setup>
// ============================================================
// หน้าเล่นเกม Single Player
// ============================================================
// ลำดับการทำงาน
//   1) ต่อ Socket.IO → sp:join (เซิร์ฟเวอร์สร้างห้อง + AI)
//   2) บูต Phaser (วาดโต๊ะ) → รับ sp:update ทีละก้อน (events + state สุดท้าย)
//   3) เล่นแอนิเมชันของ events ทีละตัว (ไล่ state บนจอไปพร้อมกัน) → แทนด้วย state จริง → ส่ง sp:ready
//   4) ถึงตาเรา → เปิดปุ่ม/ป๊อปอัปให้ตัดสินใจ → sp:action (เซิร์ฟเวอร์ตรวจกติกา)
// เซิร์ฟเวอร์รอ sp:ready ก่อนเริ่มนับเวลา/ให้ AI เล่นต่อ → เวลาไม่หายไปกับแอนิเมชัน
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import GameSettings from '@/components/GameSettings.vue';
import RulesModal from '@/components/RulesModal.vue';
import BaseModal from '@/components/BaseModal.vue';
import PlayerAvatar from '@/components/PlayerAvatar.vue';
import CardImg from '@/components/game/CardImg.vue';
import CardInfo from '@/components/game/CardInfo.vue';
import TimerRing from '@/components/game/TimerRing.vue';
import BuildSheet from '@/components/game/BuildSheet.vue';
import ThreatPanel from '@/components/game/ThreatPanel.vue';
import PhaseSplash from '@/components/game/PhaseSplash.vue';
import EnvShift from '@/components/game/EnvShift.vue';
import EndShift from '@/components/game/EndShift.vue';
import { setMusic, preloadMusic, duckMusic, unduckMusic } from '@/services/music';
import PlayersPanel from '@/components/game/PlayersPanel.vue';
import MyCards from '@/components/game/MyCards.vue';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import { sceneBg, preloadUi, uiImg } from '@/services/uiArt';
import { connectGameSocket, request } from '@/services/gameSocket';
import { bootGame } from '@/game/boot';
import { applyEvent, missingFor } from '@/game/reduce';
import { ABILITY_INFO, SYMBOL_ICON, SYMBOL_COLOR, SYMBOL_SHORT } from '@/game/icons';
import { useSessionStore } from '@/stores/session';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { useLeaveGame } from '@/composables/useLeaveGame';
import { play } from '@/services/sound';

const router = useRouter();
const session = useSessionStore();
const auth = useAuthStore();
const toast = useToastStore();

// ---------------- ข้อมูลที่แชร์ให้ component ลูก ----------------
const cards = reactive({});
let art = null;
provide('cards', cards);
provide('cardArt', { url: (id) => (art ? art.url(id) : '') });

// ---------------- state ----------------
const stageEl = ref(null);
const status = ref('connecting'); // connecting | playing | error
const errorText = ref('');
const view = ref(null);
const me = ref('me');
const timer = ref(null);          // { deadline (เวลาเครื่องนี้), duration, stage, key }
const busy = ref(true);           // กำลังเล่นแอนิเมชัน
const pending = ref(false);       // ส่งการกระทำแล้ว รอผล
const selection = ref([]);        // โหมดหยิบ 3 ใบตำแหน่งใดก็ได้
const threatUI = ref(null);
const banner = ref(null);
const splash = ref(null);          // ภาพประกาศช่วงเต็มจอ (PhaseSplash)
const flyTop = ref(false);         // ระหว่างการ์ดบินไป/มาจากแผงผู้เล่น: canvas อยู่ชั้นบนสุด
const endShow = ref(null);         // ฉากจบเกม 3 ภาพ (UI ทั้งหมดหายไประหว่างนี้)
const envShift = ref(null);        // แอนิเมชันสิ่งแวดล้อมแย่ลงตอนเข้าช่วง 2/3 (UI ทั้งหมดหายไประหว่างนี้)
// หน้าโหลดเต็มจอระหว่างเตรียมโต๊ะ: ความคืบหน้าจริงตามขั้น (ต่อเซิร์ฟเวอร์ → เข้าห้อง → วาดโต๊ะ)
const showLoader = ref(true);
const loadProgress = ref(5);
let loaderGone;
const loaderDone = new Promise((r) => { loaderGone = r; }); // รอหน้าโหลดหายก่อนเริ่มแจกการ์ด/ประกาศช่วงที่ 1
function onLoaderFinished() {
  showLoader.value = false;
  loaderGone();
}
const endUI = ref(null);
const saved = ref(null);          // ผลการบันทึกเกมลงฐานข้อมูล
const fast = ref(false);
// ---- เลย์เอาต์ (Vue จัดทั้งหน้า · Phaser วาดเฉพาะโต๊ะกลางในช่อง boardEl) ----
const boardEl = ref(null);
const layoutEl = ref(null);
const cols = ref(null);  // [กว้างโต๊ะ, กว้างคอลัมน์ขวา] (px) คำนวณให้โต๊ะพอดีการ์ด ไม่มีที่ว่างในกรอบ
function fitBoard() {
  const el = layoutEl.value;
  if (!el || !scene?.idealWidth) return;
  const cs = getComputedStyle(el);
  const num = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
  const lw = el.firstElementChild?.getBoundingClientRect().width || num('--lw');
  const gap = num('--gap');
  // หมายเหตุ: --rw เป็น clamp(...) → อ่านค่าจาก CSS เป็นตัวเลขตรง ๆ ไม่ได้ จึงคำนวณ clamp เดียวกันใน JS
  const vw = window.innerWidth;
  const clampPx = (lo, v, hi) => Math.max(lo, Math.min(v, hi));
  const rwMin = phoneUI.value ? clampPx(170, vw * 0.22, 196) : clampPx(250, vw * 0.22, 440);
  const rwMax = num('--rwmax') || rwMin;
  const W = el.clientWidth;
  // มือถือ: ช่องโต๊ะยืดเลยขอบบน/ล่างของเลย์เอาต์ (margin ติดลบ) → ใช้ความสูงจริงของช่องโต๊ะ
  const bh = boardEl.value?.getBoundingClientRect().height || el.clientHeight;
  const ideal = scene.idealWidth(bh);                                // โต๊ะกว้างเท่าไรถึงพอดีความสูง
  const board = Math.max(120, Math.min(ideal, W - lw - rwMin - 2 * gap)); // ไม่เบียดคอลัมน์ขวาจนต่ำกว่าขั้นต่ำ
  const right = Math.max(rwMin, Math.min(rwMax, W - lw - board - 2 * gap)); // ขวาได้ที่ที่เหลือ (ไม่เกินค่าสูงสุด)
  cols.value = [Math.floor(board), Math.floor(right)];
}
// ซ้าย = คงที่ · กลาง = พอดีการ์ด · ขวา = ได้ที่ที่เหลือ · ที่ว่างเกินจากนั้นกลายเป็นช่องไฟ (space-between)
const layoutStyle = computed(() => (cols.value
  ? { gridTemplateColumns: `var(--lw) ${cols.value[0]}px ${cols.value[1]}px` }
  : {}));
const phoneUI = ref(window.innerHeight <= 500);     // จอเตี้ย = โทรศัพท์แนวนอน
const tallUI = ref(window.innerHeight >= 820);       // จอสูง (คอมจอใหญ่) → นาฬิกาใหญ่ขึ้น
const panel = ref(null);                             // มือถือ: ลิ้นชักการ์ดเปิดอยู่ที่แท็บไหน acts | rights | built (null = ปิด)
const piles = ref(null);                             // ตำแหน่งกองจั่ว/สาธารณะ/กองทิ้ง (จาก Phaser) → วาดป้าย HTML
const pileStyle = (r) => (r ? { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' } : { display: 'none' });
let panelTimer = null;
// มือถือ: แตะที่อื่น (นอกป๊อปอัปการ์ด และนอกปุ่มเปิด) → ปิดป๊อปอัป
const popEl = ref(null);
function onOutside(e) {
  if (!panel.value || !popEl.value) return;
  if (popEl.value.contains(e.target) || e.target.closest?.('.pbtns, .prow, .modal, .backdrop')) return;
  closePanel();
}
onMounted(() => window.addEventListener('pointerdown', onOutside, true));
onBeforeUnmount(() => window.removeEventListener('pointerdown', onOutside, true));
function openPanel(k, ms = 0) {
  if (!phoneUI.value) return;
  clearTimeout(panelTimer);
  panel.value = k;
  if (ms) panelTimer = setTimeout(() => { if (panel.value === k) panel.value = null; }, ms);
}
// ปิดแล้วเว้น 450ms ก่อนเปิดใหม่ได้: บน iPhone การแตะปุ่ม X อาจมี "คลิกซ้ำ" ตกลงไปโดนกล่องการ์ดที่อยู่ข้างใต้
// → ป๊อปอัปการ์ดในมือเด้งขึ้นมาแทนทันที (ต้องกดปิดหลายรอบ)
let panelClosedAt = 0;
function closePanel() {
  clearTimeout(panelTimer);
  if (panel.value) panelClosedAt = performance.now();
  panel.value = null;
}
function togglePanel(k) {
  if (!panel.value && performance.now() - panelClosedAt < 450) return;
  play('click');
  clearTimeout(panelTimer);
  if (panel.value === k) return closePanel();
  panel.value = k;
}
/** ปุ่มเปิดลิ้นชักการ์ด: เปิดแท็บที่น่าดูที่สุด (มีการ์ดสิทธิที่สร้างได้ → แท็บสิทธิ, ไม่งั้นการ์ดในมือ) */
function toggleDrawer() {
  if (panel.value) return togglePanel(panel.value);
  togglePanel(myBuild.value && handRights.value.length ? 'rights' : 'acts');
}
// ---- แอนิเมชันการ์ดบินบนแผงของเรา (HTML + Web Animations API) ----
const flying = ref([]);          // id การ์ดที่กำลังบิน → ซ่อนใบจริงใน MyCards
const freshBuilt = ref(null);    // การ์ดที่เพิ่งสร้าง → เรืองแสง
// ตำแหน่งการ์ดใบนั้นบนจอ (คอม: แผงการ์ดของเรา · มือถือ: กล่องการ์ดในมือ / ป๊อปอัป) — เอาเฉพาะใบที่มองเห็นอยู่
const cardRect = (id) => {
  const el = [...document.querySelectorAll(`[data-card="${id}"]`)].find((x) => x.offsetParent);
  return el ? el.getBoundingClientRect() : null;
};
/** สร้างการ์ดลอย (position: fixed) แล้วเล่นคีย์เฟรมจากกรอบ from ไปกรอบ to */
async function flyCard(id, from, to, { lift = false, duration = 560 } = {}) {
  const img = document.createElement('img');
  img.src = art ? art.url(id) : '';
  Object.assign(img.style, {
    position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
    zIndex: 90, pointerEvents: 'none', // อยู่เหนือทุกแผง/ปุ่ม (การ์ดบินต้องเห็นชัดบนสุด) borderRadius: '7% / 5%', transformOrigin: '50% 50%',
    boxShadow: '0 10px 26px rgba(30, 60, 40, 0.35)',
  });
  document.body.appendChild(img);
  // เลื่อนจากจุดกลางต้นทาง → จุดกลางปลายทาง พร้อมย่อ/ขยายให้เท่าช่องปลายทาง
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const s = to.width / from.width;
  const frames = lift
    ? [
        { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
        { transform: 'translate(0, -34px) scale(1.18) rotate(-4deg)', offset: 0.32 },   // เด้งขึ้นจากมือ
        { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)` },
      ]
    : [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(8deg)`, opacity: 0.85 },
      ];
  const anim = img.animate(frames, { duration: duration * (fast.value ? 0.6 : 1), easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' });
  await anim.finished.catch(() => {});
  img.remove();
}
/** การ์ดกิจกรรมที่ทิ้ง: บินจากการ์ดในมือไปที่กองทิ้งบนโต๊ะ (ทยอยทีละใบ) */
async function flyDiscards(ids) {
  const d = piles.value?.disc;
  if (!d) return;
  const to = { left: d.x, top: d.y, width: d.w, height: d.h };
  flying.value = [...ids];
  await Promise.all(ids.map(async (id, k) => {
    const from = cardRect(id);
    if (!from) return;
    await new Promise((r) => setTimeout(r, k * 110));
    await flyCard(id, from, to, { duration: 480 });
  }));
}
/** มือถือ: การ์ดสิทธิเด้งขึ้นจากกล่อง "การ์ดสิทธิในมือ" แล้วลอย (บนสุด เหนือทุกอย่าง) ย่อลงไปที่ปุ่ม "สิทธิที่สร้างแล้ว" */
async function flyRightToBuiltBtn(id, src) {
  const btn = document.querySelector('.pbtn.built')?.getBoundingClientRect();
  if (!btn) return;
  const h = btn.height * 1.1;
  const to = { left: btn.left + btn.width / 2 - (h * 0.714) / 2, top: btn.top + btn.height / 2 - h / 2, width: h * 0.714, height: h };
  if (!src) src = { left: to.left - 40, top: to.top - 140, width: 70, height: 98 };
  flying.value = [...flying.value, id];
  await flyCard(id, src, to, { lift: true, duration: 820 });
  flying.value = [];
  bumpBuilt.value = true; // ปุ่มเด้งรับ
  setTimeout(() => { bumpBuilt.value = false; }, 700);
}
const bumpBuilt = ref(false);
/** การ์ดสิทธิ: เด้งขึ้นจาก "การ์ดสิทธิในมือ" (หรือโซนสาธารณะ) แล้วลอยไปวางต่อท้ายใน "สิทธิที่สร้างแล้ว" */
async function flyRightToBuilt(id, from) {
  let src = from === 'public' && piles.value?.pub
    ? { left: piles.value.pub.x, top: piles.value.pub.y, width: piles.value.pub.w, height: piles.value.pub.h }
    : cardRect(id);
  if (phoneUI.value) return flyRightToBuiltBtn(id, src);
  const row = document.querySelector('.mine-panel .sec.built .row')?.getBoundingClientRect();
  if (!row) return;
  const cards2 = [...document.querySelectorAll('.mine-panel .sec.built .card')];
  const last = cards2.at(-1)?.getBoundingClientRect();
  const w = row.height * 0.714;
  const left = last ? Math.min(last.right + 5, row.right - w) : row.left;
  const to = { left, top: row.top, width: w, height: row.height };
  if (!src) src = { left: to.left, top: to.top - 60, width: w, height: row.height };
  flying.value = [...flying.value, id];
  await flyCard(id, src, to, { lift: true, duration: 760 });
  // ใบจริงจะโผล่ในช่อง "สร้างแล้ว" หลัง state อัปเดต → ให้เรืองแสงต้อนรับ
  freshBuilt.value = id;
  setTimeout(() => { if (freshBuilt.value === id) freshBuilt.value = null; }, 1600);
  flying.value = [];
}

// ---- กล่องการแจ้งเตือน (แทนป้ายลอยด้านบน) ----
const notes = ref([]);
let noteSeq = 0;
function notify(text, type = 'info') {
  notes.value = [{ id: ++noteSeq, text, type }, ...notes.value].slice(0, 3);
}
// ---- AI กำลังทำอะไร (แสดงในแถบผู้เล่น) ----
const intentMsg = ref(null);
function intentText(i) {
  const a = i?.action || {};
  if (a.type === 'take') return a.line ? 'กำลังเลือกแถว...' : 'กำลังเลือกการ์ด...';
  if (a.type === 'build') return `กำลังสร้าง ${cards[a.right]?.shortName || 'สิทธิ'}`;
  if (a.type === 'peek' || a.type === 'peekDecide') return 'ดูการ์ดบนสุด...';
  if (a.type === 'endBuild') return 'จบตา';
  return 'กำลังคิด...';
}
function showIntent(i) {
  scene?.showIntent(i);
  intentMsg.value = i ? { player: i.player, text: intentText(i) } : null;
}

const modal = reactive({ card: null, hand: false, opp: null, pub: false, ability: false, log: false, rules: false, build: false });
// แตะการ์ดบนโต๊ะ → ป๊อปอัปรายละเอียดการ์ดใบนั้น
function openCard(id) {
  if (!id) return;
  play('click');
  modal.card = id;
}
// รูปการ์ด (ใช้ในตัวอย่างการ์ดในมือบนมือถือ)
const artUrl = (id) => (art ? art.url(id) : '');

let socket = null;
let scene = null;
let game = null;
const queue = [];
let running = false;
let pendingIntent = null;

const { leave, exiting } = useLeaveGame(async () => {
  socket?.disconnect();
});

// ---------------- computed ----------------
const players = computed(() => view.value?.players || []);
const nameOf = (id) => (id === me.value ? 'คุณ' : players.value.find((p) => p.id === id)?.name || '');
const isMyTurn = computed(() => view.value && view.value.current === me.value && view.value.stage !== 'ended');
const stage = computed(() => view.value?.stage);
const canAct = computed(() => isMyTurn.value && !busy.value && !pending.value && !threatUI.value);
const myTake = computed(() => canAct.value && stage.value === 'take');
const myBuild = computed(() => canAct.value && stage.value === 'build');
const myPeek = computed(() => canAct.value && stage.value === 'peek' && view.value?.peek?.card);
const freeMode = computed(() => view.value?.takeMode === 'free');
const turnPlayer = computed(() => players.value.find((p) => p.id === view.value?.current));
const turnText = computed(() => {
  const v = view.value;
  if (!v) return '';
  if (!v.current) return 'กำลังสับและแจกการ์ด...';
  if (v.stage === 'ended') return 'เกมจบแล้ว';
  if (v.stage === 'coins') return 'ภัยคุกคาม! กำลังตัดสินใจ';
  if (v.current !== me.value) return `ตาของ ${nameOf(v.current)}`;
  if (v.stage === 'take') return freeMode.value ? 'ตาของคุณ · เลือกการ์ด 3 ใบ' : 'ตาของคุณ · เลือกแถวที่จะหยิบ';
  if (v.stage === 'build') return 'ตาของคุณ · สร้างสิทธิ';
  if (v.stage === 'peek') return 'ตาของคุณ · ดูการ์ดบนสุด';
  return 'ตาของคุณ';
});
const myTimer = computed(() => (timer.value && timer.value.deadline > Date.now() - 500 ? timer.value : null));
const handRights = computed(() => (view.value?.hand || []).filter((id) => cards[id]?.type === 'right'));
const handActs = computed(() => (view.value?.hand || []).filter((id) => cards[id]?.type === 'activity'));
const myBuilt = computed(() => players.value.find((p) => p.id === me.value)?.built || []);
const oppModal = computed(() => players.value.find((p) => p.id === modal.opp));
const iWon = computed(() => endUI.value?.result?.winners?.includes(me.value));
const myRank = computed(() => endUI.value?.result?.rows?.find((r) => r.id === me.value)?.rank);

const PHASE_SUB = {
  1: 'สะสมการ์ดกิจกรรมและการ์ดสิทธิ',
  2: 'ภัยคุกคามอาจปรากฏได้ทุกเมื่อ! รีบสร้างสิทธิป้องกันตัว',
  3: 'โลกใกล้จุดพลิกผัน เกมอาจจบได้ทุกเมื่อ',
};
const ERR = {
  NOT_YOUR_TURN: 'ยังไม่ถึงตาของคุณ',
  WRONG_STAGE: 'ตอนนี้ทำแบบนั้นไม่ได้',
  BAD_DISCARDS: 'การ์ดที่เลือกทิ้งไม่ตรงเงื่อนไข',
  NEED_PARTICIPATION: 'ต้องปลดล็อกสิทธิในการมีส่วนร่วมก่อน',
  TIMEOUT: 'เซิร์ฟเวอร์ตอบช้า ลองอีกครั้ง',
};

const wait = (ms) => new Promise((r) => setTimeout(r, fast.value ? ms * 0.6 : ms));
const byId = (list) => Object.fromEntries(list.map((c) => [c.id, c]));

// ---------------- เริ่มต้น ----------------
onMounted(async () => {
  if (!session.id) return router.replace('/menu');
  sceneBg.key = 'game'; // จุดที่ 4: เข้าหน้าเกม → เปลี่ยนพื้นหลัง
  document.body.classList.add('in-game'); // ให้ป้ายแจ้งเตือนเลื่อนลงใต้แถบบน
  preloadUi(['phase-1', 'phase-2', 'phase-3', 'game-end']); // ให้ภาพประกาศขึ้นทันทีไม่กระตุก
  try {
    loadProgress.value = 15;
    socket = await connectGameSocket();
    loadProgress.value = 35;
  } catch {
    return fail('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  }
  socket.on('sp:update', (u) => { queue.push(u); run(); });
  socket.on('sp:intent', (i) => {
    if (running || !scene) pendingIntent = i;
    else showIntent(i);
  });
  socket.on('sp:timer', (t) => setTimer(t, t.serverNow));
  socket.on('sp:saved', (s) => { saved.value = s.ok; });
  socket.on('connect_error', (e) => {
    if (status.value === 'connecting') fail(e?.message === 'UNAUTHENTICATED' ? 'ยืนยันตัวตนไม่สำเร็จ ลองเข้าสู่ระบบใหม่' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  });
  socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect' && status.value === 'playing') notify('การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่...', 'error');
  });
  socket.io.on('reconnect', () => join(true));
  socket.on('connect', () => { if (status.value === 'connecting') join(false); });
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  sceneBg.key = null; // ออกจากหน้าเกม → กลับพื้นหลังปกติ
  document.body.classList.remove('in-game');
  window.removeEventListener('resize', onResize);
  socket?.disconnect();
  game?.destroy();
});

function fail(msg) {
  status.value = 'error';
  errorText.value = msg;
}

async function join(isReconnect) {
  const res = await request(socket, 'sp:join', { sessionId: session.id }, 15000);
  if (!res?.ok) {
    const code = res?.error;
    if (code === 'PRETEST_REQUIRED') { session.setStep('pre'); return router.replace('/pretest'); }
    if (code === 'GAME_FINISHED') { session.setStep('post'); return router.replace('/posttest'); }
    if (code === 'SESSION_CLOSED' || code === 'SESSION_NOT_FOUND') { session.clear(); return router.replace('/menu'); }
    return fail('เข้าห้องเกมไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
  me.value = res.me;
  loadProgress.value = 55;
  if (!Object.keys(cards).length) Object.assign(cards, byId(res.catalog));
  if (!scene) {
    const booted = await bootGame(stageEl.value, {
      cards,
      me: res.me,
      sfx: play,
      boardRect: () => rectOf(boardEl.value),
      onLayout: (r) => { piles.value = r; },
      anchor: (pid, kind) => anchorFor(pid, kind),
      flyTop: (v) => { flyTop.value = v; }, // การ์ดบินออกนอกโต๊ะ → ยก canvas ขึ้นเหนือแผง HTML ชั่วคราว
      on: {
        lineTap, slotTap,
        cardInfo: (id) => openCard(id),
        opponent: (id) => { play('click'); modal.opp = id; },
        myArea: () => { play('click'); modal.hand = true; },
        publicZone: () => { play('click'); modal.pub = true; },
        deck: () => {
          // ตาเรา + ปลดล็อก "ดูการ์ดบนสุด" แล้ว → แตะกองจั่ว = ดูการ์ดบนสุด
          if (myTake.value && view.value?.canPeek && !pending.value) return peek();
          notify(`ช่วงที่ ${view.value?.phase} · เหลือการ์ดในกองจั่ว ${view.value?.deckLeft} ใบ`);
        },
      },
    });
    loadProgress.value = 90;
    scene = booted.scene;
    game = booted.game;
    art = booted.art;
    scene.setTake(takeCfg.value);
    fitBoard();
    if (import.meta.env.DEV) window.__scene = scene; // ช่วยดีบัก/ทดสอบอัตโนมัติ
    onResize();
  }
  status.value = 'playing';
  if (res.snapshot) {
    // กลับเข้าห้องเดิม (รีเฟรช/เน็ตหลุด) → วาดสถานะล่าสุดทันที
    queue.length = 0;
    view.value = res.snapshot.view;
    scene.render(view.value);
    threatUI.value = null;
    if (res.snapshot.view.timer) setTimer(res.snapshot.view.timer, res.snapshot.serverNow);
    afterUpdate(view.value);
    busy.value = false;
    socket.emit('sp:ready', { seq: res.snapshot.seq });
    if (isReconnect) notify('เชื่อมต่อกลับมาแล้ว', 'ok');
  }
  run();
}

function onResize() {
  requestAnimationFrame(fitBoard);
  phoneUI.value = window.innerHeight <= 500;
  tallUI.value = window.innerHeight >= 820;
  if (!phoneUI.value) panel.value = null;
}

/** กรอบของ element บนจอ (หน่วย CSS px ตรงกับพิกัดของ Phaser เพราะ canvas เต็มจอ) */
function rectOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
/** จุดหมายของการ์ดที่บินเข้าหาผู้เล่น: แถวใน "ผู้เล่นในห้อง" หรือ "การ์ดของเรา" (มือถือ = ปุ่มลัด) */
function anchorFor(pid, kind) {
  const keys = pid === me.value
    ? (kind === 'built' ? ['me:built', 'btn:built', 'btn:cards'] : ['me:hand', 'btn:cards'])
    : [pid];
  for (const k of keys) {
    const el = [...document.querySelectorAll(`[data-anchor="${k}"]`)].find((x) => x.offsetParent);
    const r = rectOf(el);
    if (r) return { x: r.x + r.w / 2, y: r.y + Math.min(r.h / 2, 60) };
  }
  return null;
}
// ช่องโต๊ะเปลี่ยนขนาด → ให้ Phaser จัดโต๊ะใหม่
let boardObs = null;
watch(boardEl, (el) => {
  boardObs?.disconnect();
  if (!el) return;
  boardObs = new ResizeObserver(() => { fitBoard(); scene?.relayout(); });
  boardObs.observe(el);
  if (layoutEl.value) boardObs.observe(layoutEl.value);
});
onBeforeUnmount(() => { boardObs?.disconnect(); clearTimeout(panelTimer); });

function setTimer(t, serverNow) {
  if (!t) { timer.value = null; return; }
  timer.value = { deadline: Date.now() + (t.deadline - serverNow), duration: t.duration, stage: t.stage, key: t.key };
}

// ---------------- เล่นอัปเดตทีละก้อน ----------------
function baseForSetup(v) {
  // สถานะ "ก่อนแจกการ์ด" สำหรับอัปเดตแรกของเกม
  return {
    ...v,
    market: Array(9).fill(null),
    piles: { ...v.piles, 1: v.piles[1] + 9 },
    deckLeft: v.piles[1] + 9,
    hand: [],
    players: v.players.map((p) => ({ ...p, handCount: 0, built: [] })),
    current: null,
  };
}

async function run() {
  if (running || !scene) return;
  running = true;
  busy.value = true;
  await loaderDone; // ครั้งแรก: รอหน้าโหลดจางหายก่อน ไม่งั้นแอนิเมชันแจกการ์ดจะเล่นอยู่ใต้หน้าโหลด
  while (queue.length) {
    const u = queue.shift();
    scene.clearIntent();
    intentMsg.value = null;
    const evs = u.events;
    if (!view.value || evs.some((e) => e.type === 'setup')) {
      view.value = baseForSetup(u.view);
      scene.render(view.value);
    }
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.type === 'deal') {
        const group = [];
        while (i < evs.length && evs[i].type === 'deal') group.push(evs[i++]);
        i--;
        await Promise.all(group.map((d, k) => scene.dealToSlot(d.slot, d.card, k * 110)));
        for (const d of group) view.value = applyEvent(view.value, { ...d, type: 'draw' }, cards);
        scene.render(view.value);
        continue;
      }
      try {
        await handle(e);
      } catch (err) {
        console.warn('[game] animation', e.type, err);
      }
      view.value = applyEvent(view.value, e, cards);
      scene.render(view.value);
    }
    view.value = u.view;
    scene.render(u.view);
    if (!u.view.timer) timer.value = null;
    else if (!timer.value || timer.value.key !== u.view.timer.key) setTimer(u.view.timer, u.serverNow);
    afterUpdate(u.view);
    socket.emit('sp:ready', { seq: u.seq });
  }
  running = false;
  busy.value = false;
  if (pendingIntent) {
    showIntent(pendingIntent);
    pendingIntent = null;
  }
}

function afterUpdate(v) {
  pending.value = false;
  const mine = v.current === me.value;
  modal.build = mine && v.stage === 'build' && v.buildOptions.length > 0;
  if (!(mine && v.stage === 'take')) selection.value = [];
}

let bannerSeq = 0;
async function showBanner(b, ms) {
  const id = ++bannerSeq;
  banner.value = { ...b, id };
  await wait(ms);
  if (banner.value?.id === id) banner.value = null; // (ref ห่อ object เป็น proxy จึงเทียบด้วย id)
}

// ภาพประกาศช่วงเต็มจอ — เวลาไม่ย่อตามโหมดเร่งความเร็ว เพื่อให้ตรงกับแอนิเมชัน CSS
let splashSeq = 0;
async function showSplash(kind, title, sub, ms = 2600, onPeak) {
  const id = ++splashSeq;
  splash.value = { kind, title, sub, id, ms };
  await new Promise((r) => setTimeout(r, 650));
  onPeak?.();
  await new Promise((r) => setTimeout(r, ms - 650));
  if (splash.value?.id === id) splash.value = null;
  await new Promise((r) => setTimeout(r, 250));
}
const quake = computed(() => splash.value && (splash.value.kind === 'p3' || splash.value.kind === 'end'));

// พื้นหลังตามช่วง (ครอบคลุมกรณีรีเฟรช/กลับเข้าห้องกลางเกมด้วย)
const BG_OF = { 1: 'game', 2: 'phase2', 3: 'phase3' };
watch(() => view.value && `${view.value.phase}|${view.value.stage}`, () => {
  const v = view.value;
  if (!v) return;
  sceneBg.key = v.stage === 'ended' ? null : BG_OF[v.phase] || 'game';
  // เพลงตามช่วง (ช่วงที่ 1 สดใส · 2 ตึงเครียด · 3 ดราม่า · จบเกม = ผ่อนคลาย) — ระหว่างฉากเปลี่ยนช่วง ฉากจะเปลี่ยนเพลงเอง
  if (!envShift.value && !endShow.value) setMusic(v.stage === 'ended' ? 'end' : `p${Math.min(3, v.phase || 1)}`);
  if (v.phase < 3) preloadMusic(`p${v.phase + 1}`);
});

async function handle(e) {
  const pname = nameOf(e.player);
  switch (e.type) {
    case 'setup':
      await wait(300);
      play('phase');
      await showSplash('p1', 'ช่วงที่ 1', PHASE_SUB[1], 2000);
      await scene.shuffleIntro();
      break;
    case 'coins':
      notify('ทุกคนได้รับเหรียญรวมกลุ่มคนละ 2 เหรียญ');
      break;
    case 'turn':
      if (e.player === me.value) {
        if (phoneUI.value) panel.value = null;
        play('turn');
        showBanner({
          kind: 'turn',
          title: 'ตาของคุณ!',
          sub: view.value?.abilities?.INF
            ? 'ดูการ์ดบนสุดได้ก่อนหยิบ · แตะกองจั่ว'
            : freeMode.value ? 'แตะการ์ด 3 ใบที่อยากได้' : 'แตะลูกศรข้างแถวหรือคอลัมน์ที่จะหยิบ',
        }, 1300);
        await wait(500);
      }
      break;
    case 'take':
      await scene.takeCards(e.player, e.slots);
      if (e.auto && e.player === me.value) notify('หมดเวลา! ระบบสุ่มหยิบแถวให้', 'error');
      else notify(e.player === me.value ? 'คุณหยิบการ์ด 3 ใบ' : `${pname} หยิบการ์ด 3 ใบ`);
      // (มือถือ: ไม่เด้งป๊อปอัปเอง — การ์ดในมือแสดงอยู่ในกล่อง "การ์ดในมือ" ตลอดแล้ว)
      break;
    case 'build': {
      const rn = cards[e.right]?.shortName;
      play('build');
      if (e.player === me.value && (phoneUI.value || document.querySelector('.mine-panel'))) {
        // คอม: แอนิเมชันเป็น HTML (อยู่เหนือแผงการ์ดของเรา) → ทิ้งการ์ดกิจกรรมลงกองทิ้ง แล้วการ์ดสิทธิเด้งไปช่อง "สิทธิที่สร้างแล้ว"
        await flyDiscards(e.discards);
        await flyRightToBuilt(e.right, e.from);
      } else {
        await scene.cardsLeavePlayer(e.player, e.discards);
        await scene.rightToBuilt(e.player, e.right, e.from);
      }
      notify(e.player === me.value ? `สร้าง "${rn}" สำเร็จ! +${cards[e.right].points} คะแนน` : `${pname} สร้าง "${rn}"`, e.player === me.value ? 'ok' : 'info');
      break;
    }
    case 'unlock':
      play('unlock');
      // ความสามารถพิเศษใช้ได้ "ทุกคน" (ไม่ใช่แค่คนที่สร้าง) → บอกให้ชัด
      await showBanner({
        kind: 'unlock',
        ability: e.ability,
        title: `ปลดล็อก: ${ABILITY_INFO[e.ability].title}`,
        sub: `${e.player === me.value ? 'คุณ' : nameOf(e.player)}สร้าง${ABILITY_INFO[e.ability].right} · ทุกคนใช้ได้แล้ว! ${ABILITY_INFO[e.ability].text}`,
      }, 3400);
      break;
    case 'endBuild':
      if (e.auto && e.player === me.value) notify('หมดเวลา · จบการสร้างสิทธิ', 'error');
      break;
    case 'draw':
      await scene.dealToSlot(e.slot, e.card);
      break;
    case 'phase':
      if (e.phase < 2) play('phase');
      if (e.phase >= 2) {
        // ช่วง 2/3: ซ่อน UI ทั้งหมด → ฉากสิ่งแวดล้อมแย่ลง (ควัน ฝุ่น ใบไม้แห้ง/ลูกไฟ จอสั่น) พร้อมเปลี่ยนพื้นหลัง
        // → ภาพประกาศช่วงกระแทกเต็มจอ → UI ค่อย ๆ กลับมา
        const id = Date.now();
        modal.card = null;
        panel.value = null;
        envShift.value = { phase: e.phase, id, stage: 'shift' };
        duckMusic(0.15, 1.2);                                  // เพลงเดิมค่อย ๆ เงียบลง
        play(e.phase >= 3 ? 'env3' : 'env2');                 // เสียงประกอบฉาก: ลมกระโชก คำราม ตูม ไรเซอร์
        await new Promise((r) => setTimeout(r, 2800));
        sceneBg.key = BG_OF[e.phase];                          // ฉากเปลี่ยน
        setMusic(`p${e.phase}`, { fade: 3 });                  // เพลงใหม่ค่อย ๆ ดังขึ้น
        duckMusic(0.5, 3);                                     // ค่อย ๆ ดังขึ้นครึ่งหนึ่ง (เสียงประกอบฉากยังเด่นอยู่)
        await new Promise((r) => setTimeout(r, 6200));
        if (envShift.value?.id === id) envShift.value = { ...envShift.value, stage: 'splash' }; // คำบรรยายหายไปก่อนภาพประกาศ
        await new Promise((r) => setTimeout(r, 350));
        await showSplash(`p${e.phase}`, `ช่วงที่ ${e.phase}`, PHASE_SUB[e.phase], 2800);
        if (envShift.value?.id === id) envShift.value = null;
        unduckMusic(1.5);
        await new Promise((r) => setTimeout(r, 600));
      } else {
        // เปลี่ยนพื้นหลังตอนภาพกระแทกเต็มจอพอดี (จุดที่ 5–6)
        await showSplash(`p${e.phase}`, `ช่วงที่ ${e.phase}`, PHASE_SUB[e.phase], 2600, () => { sceneBg.key = BG_OF[e.phase]; setMusic(`p${e.phase}`); });
      }
      break;
    case 'threat':
      play('threat');
      threatUI.value = { card: e.card, stage: 'intro', safe: {}, unsafe: [], chosen: [], choices: null, success: false, losses: {} };
      await scene.bigCard(e.card);
      await wait(900);
      await scene.bigCardAway(); // การ์ดใบใหญ่ไปแสดงในแผงภัยคุกคามกลางจอแทน
      threatUI.value.stage = 'check';
      break;
    case 'protect':
      if (threatUI.value) threatUI.value.safe[e.player] = e.reason;
      await scene.protectPop(e.player, e.reason === 'justice' ? 'ปลอดภัย' : '+1');
      break;
    case 'coinsStart':
      if (threatUI.value) {
        threatUI.value.unsafe = e.unsafe;
        threatUI.value.stage = 'choose';
      }
      break;
    case 'coinChosen':
      threatUI.value?.chosen.push(e.player);
      await wait(200);
      break;
    case 'coinReveal':
      if (threatUI.value) {
        threatUI.value.choices = e.choices;
        threatUI.value.success = e.success;
        threatUI.value.stage = 'reveal';
      }
      play('coin');
      await wait(1900);
      break;
    case 'lose':
      if (threatUI.value) threatUI.value.losses[e.player] = e.cards;
      if (e.player === me.value) play('lose');
      await scene.cardsLeavePlayer(e.player, e.cards, e.toPublic);
      break;
    case 'threatEnd':
      if (threatUI.value) threatUI.value.stage = 'done';
      await wait(1700);
      threatUI.value = null;
      await scene.bigCardAway();
      break;
    case 'peekStart':
      await scene.peekLift();
      if (e.player !== me.value) notify(`${pname} ใช้ความสามารถดูการ์ดบนสุด`);
      break;
    case 'peekDone':
      await scene.peekDone(e.bottom);
      if (e.player !== me.value) notify(`${pname} ${e.bottom ? 'ย้ายการ์ดไปไว้ใต้กอง' : 'วางการ์ดคืนไว้ที่เดิม'}`);
      break;
    case 'end':
      threatUI.value = null;
      modal.card = null;
      panel.value = null;
      // จบเกม → ซ่อน UI ทั้งหมด · ฉากหายนะ 3 ภาพต่อกัน (ภาพละ ~3.7 วิ) พร้อมเพลง/เสียงจบเกม
      // → ภาพประกาศจบเกม → พื้นหลังกลับเป็นแบบเดิม → การ์ดจุดพลิกผัน + ผลการแข่งขัน
      {
        const id = Date.now();
        setMusic('end', { fade: 2.5 });
        play('endfx');
        for (let k = 0; k < 3; k++) {
          endShow.value = { id, scene: k, stage: 'show' };
          await new Promise((r) => setTimeout(r, 3700));
        }
        endShow.value = { id, scene: 2, stage: 'splash' };
        await new Promise((r) => setTimeout(r, 300));
        await showSplash('end', 'จบเกม!', 'โลกเข้าสู่จุดพลิกผัน', 2800, () => { sceneBg.key = null; });
        if (endShow.value?.id === id) endShow.value = null;
        await new Promise((r) => setTimeout(r, 700));
      }
      endUI.value = { card: e.card, result: e.result, stage: 'card' };
      await scene.bigCard(e.card);
      await wait(1400);
      endUI.value = { ...endUI.value, stage: 'result' };
      play(e.result.winners.includes(me.value) ? 'win' : 'success');
      break;
    default:
      break;
  }
}

// ---------------- การกระทำของผู้เล่น ----------------
async function send(action) {
  if (pending.value || !socket) return false;
  pending.value = true;
  const r = await request(socket, 'sp:action', action);
  if (!r?.ok) {
    pending.value = false;
    play('error');
    notify(ERR[r?.error] || 'ทำรายการไม่สำเร็จ', 'error');
    return false;
  }
  return true;
}

function lineTap(line) {
  if (!myTake.value) return;
  play('tap');
  send({ type: 'take', line });
}
function slotTap(i) {
  if (!myTake.value || !freeMode.value) return;
  play('tap');
  const s = selection.value;
  selection.value = s.includes(i) ? s.filter((x) => x !== i) : s.length < 3 ? [...s, i] : s;
}
function takeSelected() {
  if (selection.value.length !== 3) return;
  play('tap');
  send({ type: 'take', slots: selection.value.slice() });
}
function peek() { play('click'); send({ type: 'peek' }); }
function peekDecide(bottom) { play('tap'); send({ type: 'peekDecide', bottom }); }
async function build(p) {
  const ok = await send({ type: 'build', right: p.right, discards: p.discards });
  if (ok) modal.build = false;
}
async function endBuild() {
  const ok = await send({ type: 'endBuild' });
  if (ok) modal.build = false;
}
function chooseCoin(use) { send({ type: 'coin', use }); }
function setFast(v) {
  fast.value = v;
  scene?.setSpeed(v);
  socket?.emit('sp:speed', { fast: v });
}
function toPostTest() {
  play('tap');
  session.setStep('post');
  router.replace('/posttest');
}

// เปิด/ปิดโหมดหยิบการ์ดบนกระดาน Phaser
const takeCfg = computed(() => ({
  enabled: myTake.value,
  mode: view.value?.takeMode || 'line',
  lines: view.value?.legalLines || [],
  selected: selection.value,
}));
watch(takeCfg, (cfg) => scene?.setTake(cfg));
// ไฮไลต์กองจั่วเมื่อดูการ์ดบนสุดได้ในตานี้
watch(() => Boolean(myTake.value && view.value?.canPeek && !pending.value), (on) => scene?.setPeekable(on));
// มือถือ: ถึงขั้นหยิบการ์ดของเรา → หุบป๊อปอัปการ์ดอัตโนมัติ (ต้องเห็นโต๊ะ) · ขั้นสร้างสิทธิ → กางการ์ดสิทธิในมือ
watch(myTake, (v) => { if (v && phoneUI.value) { clearTimeout(panelTimer); panel.value = null; } });
// มือถือ: ป๊อปอัปการ์ดเปิดเฉพาะตอนผู้เล่นกดปุ่มเอง (ไม่เด้งเอง → ไม่ต้องกดปิดซ้ำหลายรอบ)

// มีป๊อปอัปเปิดอยู่ → ปิดการแตะบนกระดาน (กันแตะทะลุ)
const overlayOpen = computed(() => Boolean(
  modal.card || modal.hand || modal.opp || modal.pub || modal.ability || modal.log || modal.rules
  || (modal.build && myBuild.value) || myPeek.value || threatUI.value || endUI.value,
));
watch(overlayOpen, (v) => { if (scene) scene.input.enabled = !v; });

const showTimer = computed(() => Boolean(myTimer.value && isMyTurn.value && !threatUI.value));
// ไอคอนปุ่มมุมขวาล่าง (มือถือ) จากรูปของทีม assets/ui/icon-*.webp — ไม่มีรูป → ใช้ไอคอน SVG เดิม
const PBTN_ICON = { built: uiImg('icon-built'), rights: uiImg('icon-rights'), acts: uiImg('icon-hand') };
const TITLES = { acts: 'การ์ดในมือ', rights: 'การ์ดสิทธิในมือ', built: 'สิทธิที่สร้างแล้ว' };
const sortedActs = computed(() => {
  const SYM = { INF: 0, PAR: 1, JUS: 2 };
  return handActs.value.slice().sort((a, b) => (SYM[cards[a].symbol] - SYM[cards[b].symbol]) || (cards[a].number - cards[b].number));
});
const peekList = (k) => (k === 'acts' ? sortedActs.value : handRights.value);
const cardTotal = computed(() => (view.value?.hand.length || 0) + myBuilt.value.length);
const canBuildNow = computed(() => Boolean(myBuild.value && view.value?.buildOptions?.length));
const panelCount = (k) => (k === 'acts' ? handActs.value.length : k === 'rights' ? handRights.value.length : myBuilt.value.length);
function selectPlayer(id) {
  play('click');
  if (id === me.value) modal.hand = true;
  else modal.opp = id;
}
</script>

<template>
  <main class="game-page" :class="[{ quake, 'env-out': envShift || endShow, 'fly-top': flyTop }, phoneUI ? 'is-phone' : 'is-desk']">
    <div ref="stageEl" class="stage" />

    <!-- ป้ายชื่อ/จำนวนของกองบนโต๊ะ (HTML → คมทุกจอ มุมโค้ง) -->
    <template v-if="view && piles">
      <div class="pile-lbl" :style="pileStyle(piles.deck)">
        <span class="pl top">{{ phoneUI ? 'กองจั่ว' : `กองจั่ว · ช่วงที่ ${view.phase}` }}</span>
        <span class="pl num">{{ view.deckLeft }} ใบ</span>
        <span v-if="myTake && view.canPeek && !pending" class="pl peek">แตะเพื่อดู</span>
      </div>
      <div class="pile-lbl" :style="pileStyle(piles.pub)">
        <span class="pl top">{{ phoneUI ? 'สาธารณะ' : 'สิทธิสาธารณะ' }}</span>
        <span v-if="view.publicRights.length" class="pl num">{{ view.publicRights.length }} ใบ</span>
        <span v-else class="pl hintp">ว่าง</span>
      </div>
      <div class="pile-lbl" :style="pileStyle(piles.disc)">
        <span class="pl top">กองทิ้ง</span>
        <span v-if="view.discardCount" class="pl num">{{ view.discardCount }} ใบ</span>
        <span v-else class="pl hintp">ว่าง</span>
      </div>
    </template>

    <!-- ================= เลย์เอาต์หลัก (ตามไวร์เฟรม) ================= -->
    <div v-if="status !== 'error'" ref="layoutEl" class="layout" :style="layoutStyle">
      <!-- ซ้าย: ช่วง · ตาของ · (คอม: เวลา + แจ้งเตือน) · ผู้เล่นในห้อง -->
      <aside class="col left">
        <div v-if="view" class="phase-pill" :class="`p${view.phase}`" title="ช่วงของเกม">
          <b>ช่วงที่ {{ view.phase }}</b>
          <span class="dots"><i v-for="n in 3" :key="n" :class="{ on: n <= view.phase }" /></span>
          <small>กองจั่ว {{ view.deckLeft }}</small>
        </div>
        <div v-if="view" class="turn-pill" :class="{ mine: isMyTurn, threat: view.stage === 'coins' }">
          <PlayerAvatar
            v-if="turnPlayer"
            :is-ai="turnPlayer.isAI"
            :avatar="turnPlayer.isAI ? turnPlayer.avatar : auth.avatar"
            :name="turnPlayer.name"
            :size="phoneUI ? '1.5rem' : '1.9rem'"
          />
          <span class="tt">{{ turnText }}</span>
        </div>
        <template v-if="!phoneUI && view">
          <div class="status">
            <div class="timer-box glass">
              <TimerRing v-if="showTimer" :deadline="myTimer.deadline" :duration="myTimer.duration" :size="tallUI ? 92 : 72" big />
              <div v-else class="idle" :class="{ sm: !tallUI }"><b>{{ isMyTurn ? '...' : 'รอ' }}</b><small>20 วินาที</small></div>
            </div>
            <div class="notify glass" aria-live="polite">
              <p v-if="!notes.length" class="none">การแจ้งเตือนจะแสดงที่นี่</p>
              <TransitionGroup name="note">
                <p v-for="(n, i) in notes" :key="n.id" :class="[n.type, { old: i > 0 }]">{{ n.text }}</p>
              </TransitionGroup>
            </div>
          </div>
        </template>
        <PlayersPanel
          v-if="view"
          class="players-box"
          :players="players"
          :me="me"
          :current="view.current"
          :ended="view.stage === 'ended'"
          :my-avatar="auth.avatar"
          :cards="cards"
          :intent="intentMsg"
          @select="selectPlayer"
        />
      </aside>

      <!-- กลาง: ช่องโต๊ะ (Phaser วาดทับตรงนี้) -->
      <div ref="boardEl" class="board-slot" />

      <!-- ขวา: เครื่องมือ · การ์ดของเรา · ปุ่ม -->
      <aside class="col right">
        <div v-if="view" class="tools">
          <button type="button" class="abil" title="ความสามารถพิเศษ" @click="play('click'); modal.ability = true">
            <span v-for="k in ['INF', 'PAR', 'JUS']" :key="k" class="ab" :class="{ on: view.abilities[k] }" :style="{ '--c': SYMBOL_COLOR[k].band, '--ink': SYMBOL_COLOR[k].ink }">
              <svg viewBox="0 0 24 24"><path :d="SYMBOL_ICON[k]" /></svg>
            </span>
          </button>
          <button type="button" class="tool" aria-label="บันทึกเหตุการณ์" @click="play('click'); modal.log = true">
            <svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
          </button>
          <button type="button" class="tool" aria-label="กติกาย่อ" @click="play('click'); modal.rules = true">
            <svg viewBox="0 0 24 24"><path d="M12 17v.01M12 13.5c0-2 2.5-2 2.5-4a2.5 2.5 0 0 0-5 0 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /></svg>
          </button>
        </div>

        <!-- มือถือ: การ์ดสถานะเดียว = เวลา + ตาของใคร + แจ้งเตือนล่าสุด -->
        <div v-if="phoneUI && view" class="pstat glass" :class="{ mine: isMyTurn && view.stage !== 'ended' }" aria-live="polite">
          <div class="ptimer">
            <TimerRing v-if="showTimer" :deadline="myTimer.deadline" :duration="myTimer.duration" :size="38" big />
            <span v-else class="pidle"><span class="dotty" /></span>
          </div>
          <div class="ptext">
            <b class="pturn">{{ view.stage === 'ended' ? 'จบเกม' : isMyTurn ? 'ตาของคุณ' : view.current ? `รอ ${nameOf(view.current)}` : 'กำลังแจกการ์ด...' }}</b>
            <TransitionGroup name="note" tag="span" class="pnote">
              <span v-for="n in notes.slice(0, 1)" :key="n.id" :class="n.type">{{ n.text }}</span>
            </TransitionGroup>
          </div>
        </div>

        <!-- คอม: การ์ดของเราแสดงตลอด -->
        <section v-if="!phoneUI && view" class="mine-panel glass">
          <MyCards :hand="view.hand" :built="myBuilt" :hidden="flying" :pulse="freshBuilt" @card="(id) => { play('click'); modal.card = id; }" />
          <div class="actions">
            <template v-if="myTake">
              <button v-if="freeMode" type="button" class="btn act" :disabled="selection.length !== 3 || pending" @click="takeSelected">หยิบ {{ selection.length }}/3</button>
              <span v-else-if="!view.canPeek" class="hint">แตะลูกศร ▸ ข้างแถวบนโต๊ะเพื่อหยิบ</span>
              <button v-if="view.canPeek" type="button" class="btn btn--sun act peek-btn" :disabled="pending" @click="peek">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                ดูการ์ดบนสุด
              </button>
            </template>
            <template v-else-if="myBuild">
              <button type="button" class="btn act" @click="play('click'); modal.build = true">สร้างสิทธิ ({{ view.buildOptions.length }})</button>
              <button type="button" class="btn btn--light act" :disabled="pending" @click="endBuild">จบตา</button>
            </template>
            <span v-else-if="myPeek" class="hint">ตัดสินใจการ์ดบนสุด</span>
            <span v-else-if="view.stage !== 'ended' && !isMyTurn" class="hint wait"><span class="dotty" /> {{ view.current ? `รอ ${nameOf(view.current)}` : 'กำลังแจกการ์ด...' }}</span>
          </div>
        </section>

        <!-- มือถือ: ปุ่มการกระทำ · การ์ดในมือ · ปุ่มเปิดการ์ด 3 หมวด (ตามไวร์เฟรม) -->
        <template v-if="phoneUI && view">
          <!-- สิ่งที่ต้องทำ (แสดงเฉพาะตอนถึงตาเรา · ไม่มีอะไรให้ทำ = ไม่แสดงกรอบว่าง) -->
          <div v-if="myTake || myBuild || myPeek" class="pact">
            <template v-if="myTake">
              <p v-if="!freeMode" class="phint">
                แตะ <i class="arw"><svg viewBox="0 0 24 24"><path d="M10 7l5 5-5 5" /></svg></i>
                หรือ <i class="arw"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" /></svg></i>
                บนโต๊ะเพื่อหยิบ
              </p>
              <div v-if="freeMode || view.canPeek" class="act-row">
                <button v-if="freeMode" type="button" class="btn act" :disabled="selection.length !== 3 || pending" @click="takeSelected">หยิบการ์ด {{ selection.length }}/3</button>
                <button v-if="view.canPeek" type="button" class="btn btn--sun act peek-btn" :disabled="pending" @click="peek">ดูการ์ดบนสุด</button>
              </div>
            </template>
            <div v-else-if="myBuild" class="act-row">
              <button type="button" class="btn act" @click="play('click'); modal.build = true">สร้างสิทธิ ({{ view.buildOptions.length }})</button>
              <button type="button" class="btn btn--light act" :disabled="pending" @click="endBuild">จบตา</button>
            </div>
            <p v-else class="phint">ตัดสินใจการ์ดบนสุด</p>
          </div>

          <!-- การ์ดของฉัน: กรอบเดียว 2 แถว (การ์ดในมือ · การ์ดสิทธิในมือ) · แตะแถวไหน → เปิดป๊อปอัปหมวดนั้น -->
          <div class="pmine glass">
            <button
              v-for="k in ['acts', 'rights']"
              :key="k"
              type="button"
              class="prow"
              :class="[k, { glow: k === 'rights' && canBuildNow }]"
              :data-anchor="k === 'acts' ? 'btn:cards' : null"
              :aria-label="TITLES[k]"
              @click="togglePanel(k)"
            >
              <span class="ptag">{{ TITLES[k] }} <b>{{ panelCount(k) }}</b></span>
              <span v-if="peekList(k).length" v-fit class="hp-row">
                <span v-for="id in peekList(k)" :key="id" class="hp-card" :class="{ flying: flying.includes(id) }" :data-card="id"><img :src="artUrl(id)" alt="" draggable="false" /></span>
              </span>
              <span v-else class="hp-empty">{{ k === 'acts' ? 'ยังไม่มีการ์ด' : 'ยังไม่มีการ์ดสิทธิ' }}</span>
            </button>
          </div>

          <!-- ปุ่มเปิดการ์ด 3 หมวด: สิทธิที่สร้างแล้ว · การ์ดสิทธิในมือ · การ์ดในมือ -->
          <nav class="pbtns" aria-label="การ์ดของฉัน">
            <button
              v-for="k in ['built', 'rights', 'acts']"
              :key="k"
              type="button"
              class="pbtn"
              :class="[k, { on: panel === k, glow: k === 'rights' && canBuildNow, bump: k === 'built' && bumpBuilt }]"
              :data-anchor="k === 'built' ? 'btn:built' : null"
              :aria-label="TITLES[k]"
              :title="TITLES[k]"
              @click="togglePanel(k)"
            >
              <img v-if="PBTN_ICON[k]" class="pic" :src="PBTN_ICON[k]" alt="" draggable="false" />
              <!-- สำรอง: ไอคอนทึบสีขาวบนวงกลมสี -->
              <svg v-else-if="k === 'built'" viewBox="0 0 24 24"><path class="w" d="M12 2.5 4.5 5.8v5.4c0 4.6 3.2 8.6 7.5 9.8 4.3-1.2 7.5-5.2 7.5-9.8V5.8Z" /><path class="d" d="M12 7.4l1.35 2.75 3 .43-2.18 2.12.52 3L12 14.3l-2.69 1.4.52-3-2.18-2.12 3-.43Z" /></svg>
              <svg v-else-if="k === 'rights'" viewBox="0 0 24 24"><rect class="w" x="5.5" y="2.8" width="13" height="18.4" rx="2.8" /><path class="d" d="M12 16.6s-4.2-2.5-4.2-5.4a2.3 2.3 0 0 1 4.2-1.3 2.3 2.3 0 0 1 4.2 1.3c0 2.9-4.2 5.4-4.2 5.4Z" /></svg>
              <svg v-else viewBox="0 0 24 24"><rect class="w2" x="2.8" y="6.2" width="10.2" height="14" rx="2.3" transform="rotate(-14 8 13.2)" /><rect class="w" x="10.6" y="4.4" width="10.2" height="14" rx="2.3" transform="rotate(9 15.7 11.4)" /><circle class="d" cx="15.6" cy="11.4" r="2.3" /></svg>
              <b class="pc">{{ panelCount(k) }}</b>
            </button>
          </nav>
        </template>
      </aside>

      <!-- มือถือ: ป๊อปอัปการ์ดแต่ละหมวด (ลอยเหนือปุ่ม 3 ปุ่มมุมขวาล่าง) · กางเองอัตโนมัติเมื่อควรดู -->
      <Transition name="pop">
        <section v-if="phoneUI && panel && view" ref="popEl" class="cards-pop" :class="`k-${panel}`">
          <header class="ph">
            <h4>{{ TITLES[panel] }} <span>({{ panelCount(panel) }})</span></h4>
            <button type="button" class="dx" aria-label="ปิด" @click.stop="play('click'); closePanel()">
              <svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
            </button>
          </header>
          <div class="pbody">
            <MyCards single :sections="[panel]" :hand="view.hand" :built="myBuilt" :hidden="flying" @card="(id) => { play('click'); modal.card = id; }" />
          </div>
          <div v-if="myBuild" class="pfoot">
            <button type="button" class="btn act" @click="play('click'); modal.build = true">สร้างสิทธิ ({{ view.buildOptions.length }})</button>
            <button type="button" class="btn btn--light act" :disabled="pending" @click="endBuild">จบตา</button>
          </div>
        </section>
      </Transition>
    </div>

    <GameSettings show-speed :fast="fast" :exiting="exiting" @speed="setFast" @exit="leave" />

    <!-- ป้ายประกาศกลางจอ -->
    <Transition name="banner">
      <div v-if="banner" class="banner" :class="banner.kind">
        <strong>{{ banner.title }}</strong>
        <span v-if="banner.sub">{{ banner.sub }}</span>
      </div>
    </Transition>

    <!-- ภาพประกาศช่วง (ช่วงที่ 1 / 2 / 3 / จบเกม) -->
    <EnvShift :shift="envShift" />
    <EndShift :show="endShow" />
    <PhaseSplash :splash="splash" />

    <!-- ภัยคุกคาม -->
    <ThreatPanel
      v-if="threatUI && threatUI.stage !== 'intro'"
      :ui="threatUI"
      :players="players"
      :me="me"
      :my-coins="view?.coins || 0"
      :my-avatar="auth.avatar"
      :timer="myTimer"
      :busy="pending"
      @choose="chooseCoin"
    />

    <!-- จบเกม -->
    <Transition name="fade">
      <div v-if="endUI && endUI.stage === 'result'" class="end">
        <section class="panel end-card">
          <h2>เกมจบแล้ว!</h2>
          <p class="sub">โลกเข้าสู่จุดพลิกผัน · นับคะแนน</p>
          <p class="who" :class="{ win: iWon }">
            {{ iWon ? (endUI.result.winners.length > 1 ? 'คุณชนะร่วม!' : 'คุณชนะ!') : `คุณได้อันดับที่ ${myRank}` }}
          </p>
          <ol class="mini-rank">
            <li v-for="r in endUI.result.rows" :key="r.id" :class="{ me: r.id === me }">
              <span class="rk">{{ r.rank }}</span>
              <span class="nm">{{ r.id === me ? 'คุณ' : r.name }}</span>
              <b>{{ r.total }} คะแนน</b>
            </li>
          </ol>
          <button type="button" class="btn btn--block" :disabled="saved === null" @click="toPostTest">
            <span v-if="saved === null" class="spinner" />
            ทำแบบทดสอบหลังเล่น
          </button>
          <p v-if="saved === false" class="save-err">บันทึกผลเกมไม่สำเร็จ (ตรวจการเชื่อมต่อฐานข้อมูลที่เซิร์ฟเวอร์)</p>
        </section>
      </div>
    </Transition>

    <!-- หน้าโหลด (เหมือนหน้าเปิดแอป) -->
    <LoadingScreen v-if="showLoader" :done="status !== 'connecting'" :progress="loadProgress" label="กำลังเตรียมโต๊ะเกม" @finished="onLoaderFinished" />

    <!-- เชื่อมต่อไม่สำเร็จ -->
    <div v-if="status === 'error'" class="boot">
      <p>{{ errorText }}</p>
      <div class="boot-btns">
        <button type="button" class="btn" @click="$router.go(0)">ลองใหม่</button>
        <button type="button" class="btn btn--light" @click="leave">กลับหน้าหลัก</button>
      </div>
    </div>

    <!-- ===== ป๊อปอัป ===== -->
    <BuildSheet
      :open="modal.build && myBuild"
      :options="view?.buildOptions || []"
      :hand="view?.hand || []"
      :timer="myTimer"
      :busy="pending"
      @build="build"
      @end="endBuild"
      @close="modal.build = false"
    />

    <!-- ดูการ์ดบนสุด: การ์ดสูงตามจอ + ข้อความสั้น + ปุ่ม → พอดีทุกจอ ไม่ต้องเลื่อน -->
    <BaseModal :open="Boolean(myPeek)" title="ดูการ์ดบนสุดของกองจั่ว" width="32rem" :closable="false">
      <div v-if="view?.peek?.card" class="peek">
        <CardImg :id="view.peek.card" class="peek-card" width="auto" @click="modal.card = view.peek.card" />
        <div class="peek-side">
          <span class="peek-type">{{ cards[view.peek.card]?.type === 'right' ? 'การ์ดสิทธิ' : cards[view.peek.card]?.type === 'activity' ? 'การ์ดกิจกรรม' : cards[view.peek.card]?.type === 'threat' ? 'ภัยคุกคาม!' : 'การ์ดจบเกม' }}</span>
          <h4>{{ cards[view.peek.card]?.name }}</h4>
          <p class="peek-note">ใบนี้จะถูกเปิดลงกองกลางตอนจบตาของคุณ · เห็นคนเดียว</p>
          <div class="peek-btns">
            <button type="button" class="btn" :disabled="pending" @click="peekDecide(false)">วางคืนบนกอง</button>
            <button type="button" class="btn btn--light" :disabled="pending" @click="peekDecide(true)">ย้ายไปใต้กอง</button>
          </div>
          <TimerRing v-if="myTimer" :deadline="myTimer.deadline" :duration="myTimer.duration" :size="40" />
        </div>
      </div>
    </BaseModal>

    <BaseModal :open="Boolean(modal.card)" title="รายละเอียดการ์ด" width="30rem" @close="modal.card = null">
      <CardInfo v-if="modal.card" :id="modal.card" />
    </BaseModal>

    <BaseModal :open="modal.hand" title="การ์ดของคุณ" width="40rem" @close="modal.hand = false">
      <div v-if="view" class="hand">
        <section>
          <h5>การ์ดสิทธิในมือ ({{ handRights.length }})</h5>
          <p v-if="!handRights.length" class="empty">ยังไม่มีการ์ดสิทธิ · หยิบจากกองกลางหรือสร้างจากโซนสิทธิสาธารณะ</p>
          <div class="rights">
            <div v-for="id in handRights" :key="id" class="right-item" @click="modal.card = id">
              <CardImg :id="id" width="5rem" />
              <div>
                <b>{{ cards[id].shortName }}</b>
                <small v-if="cards[id].kind === 'substantive'">
                  {{ missingFor(cards[id], view.hand, cards).length ? `ขาดหมายเลข ${missingFor(cards[id], view.hand, cards).join(', ')}` : 'สร้างได้แล้ว!' }}
                </small>
                <small v-else>
                  {{ missingFor(cards[id], view.hand, cards) ? `ขาดสัญลักษณ์ ${SYMBOL_SHORT[cards[id].symbol]} อีก ${missingFor(cards[id], view.hand, cards)} ใบ` : 'สร้างได้แล้ว!' }}
                </small>
              </div>
            </div>
          </div>
        </section>
        <section>
          <h5>การ์ดกิจกรรม ({{ handActs.length }})</h5>
          <div class="acts">
            <CardImg v-for="id in handActs" :id="id" :key="id" width="4.6rem" @click="modal.card = id" />
          </div>
          <p v-if="!handActs.length" class="empty">ยังไม่มี</p>
        </section>
        <section>
          <h5>สิทธิที่สร้างแล้ว ({{ myBuilt.length }}) · เหรียญรวมกลุ่ม {{ view.coins }} เหรียญ</h5>
          <div class="acts">
            <div v-for="b in myBuilt" :key="b.card" class="built">
              <CardImg :id="b.card" width="3.4rem" />
              <span v-if="cards[b.card].kind === 'substantive'" class="prot">ป้องกัน {{ b.protects }}</span>
            </div>
          </div>
        </section>
      </div>
    </BaseModal>

    <BaseModal :open="Boolean(oppModal)" :title="oppModal ? `${oppModal.name} (AI)` : ''" width="30rem" @close="modal.opp = null">
      <div v-if="oppModal" class="opp">
        <p>การ์ดในมือ <b>{{ oppModal.handCount }}</b> ใบ (ไม่เห็นว่าเป็นการ์ดอะไร) · เหรียญ: ไม่เปิดเผย</p>
        <h5>สิทธิที่สร้างแล้ว ({{ oppModal.built.length }})</h5>
        <div class="acts">
          <div v-for="b in oppModal.built" :key="b.card" class="built" @click="modal.card = b.card">
            <CardImg :id="b.card" width="3.6rem" />
            <span v-if="cards[b.card].kind === 'substantive'" class="prot">ป้องกัน {{ b.protects }}</span>
          </div>
          <p v-if="!oppModal.built.length" class="empty">ยังไม่มี</p>
        </div>
      </div>
    </BaseModal>

    <BaseModal :open="modal.pub" title="โซนสิทธิสาธารณะ" width="30rem" @close="modal.pub = false">
      <p class="pub-note">การ์ดสิทธิที่หลุดจากมือเพราะภัยคุกคาม ใครมีการ์ดกิจกรรมครบเงื่อนไขก็สร้างได้ในตาของตัวเอง ไม่ต้องมีการ์ดสิทธิในมือ</p>
      <div class="acts">
        <CardImg v-for="id in view?.publicRights || []" :id="id" :key="id" width="4rem" @click="modal.card = id" />
        <p v-if="!view?.publicRights?.length" class="empty">ยังไม่มีการ์ดในโซนนี้</p>
      </div>
    </BaseModal>

    <BaseModal :open="modal.ability" title="ความสามารถพิเศษ" width="30rem" @close="modal.ability = false">
      <ul class="abilities">
        <li v-for="k in ['INF', 'PAR', 'JUS']" :key="k" :class="{ on: view?.abilities[k] }">
          <span class="ab big" :class="{ on: view?.abilities[k] }" :style="{ '--c': SYMBOL_COLOR[k].band, '--ink': SYMBOL_COLOR[k].ink }">
            <svg viewBox="0 0 24 24"><path :d="SYMBOL_ICON[k]" /></svg>
          </span>
          <div>
            <b>{{ ABILITY_INFO[k].title }}</b> <em>{{ view?.abilities[k] ? 'ปลดล็อกแล้ว · ทุกคนใช้ได้' : 'ยังล็อก' }}</em>
            <p>{{ ABILITY_INFO[k].text }}</p>
            <small>ปลดล็อกเมื่อมีผู้เล่นคนใดก็ได้สร้าง{{ ABILITY_INFO[k].right }} แล้วทุกคนใช้ได้ในตาของตัวเอง</small>
          </div>
        </li>
      </ul>
    </BaseModal>

    <BaseModal :open="modal.log" title="บันทึกเหตุการณ์" width="34rem" @close="modal.log = false">
      <ol class="log">
        <li v-for="l in [...(view?.log || [])].reverse()" :key="l.n" :class="l.type">{{ l.text }}</li>
      </ol>
    </BaseModal>

    <RulesModal :open="modal.rules" @close="modal.rules = false" />
  </main>
</template>

<style scoped>
.game-page { position: fixed; inset: 0; z-index: 1; overflow: hidden; }
/* เปลี่ยนช่วง (2/3): UI ทุกอย่างหายไป เหลือแต่ฉาก — แล้วค่อย ๆ กลับมา */
.stage, .layout, .pile-lbl { transition: opacity 0.6s ease, transform 0.6s ease, filter 0.6s ease; }
.env-out .stage, .env-out .layout, .env-out .pile-lbl { opacity: 0; transform: scale(0.96); filter: blur(3px); pointer-events: none !important; }
.env-out :deep(.gear) { opacity: 0; pointer-events: none; }
.stage { position: absolute; inset: 0; }
/* การ์ดบิน (AI/เรา หยิบ-ทิ้ง-สร้างสิทธิ): canvas ขึ้นเหนือแผง (z 10) แต่ใต้ป้ายกอง (z 12) · ระหว่างนั้นคลิกทะลุไปที่แผงได้ */
.fly-top .stage { z-index: 11; pointer-events: none; }
.stage :deep(canvas) { display: block; }

/* =========================================================
   เลย์เอาต์หลัก: 3 คอลัมน์ (ซ้าย | โต๊ะ | ขวา) — แผงโปร่งแสงโทนพาสเทล เห็นพื้นหลังทะลุ
   ========================================================= */
.game-page {
  /* ฟันเฟืองตั้งค่า = ขนาดเท่าปุ่มเครื่องมือ อยู่แถวเดียวกัน (แถวเครื่องมือสูง 42px ปุ่ม 40px) */
  --gear-size: 40px; --gear-top: calc(var(--safe-t) + 11px); --gear-right: calc(var(--safe-r) + 10px);
  --lw: clamp(210px, 17vw, 280px);   /* คอลัมน์ซ้าย */
  --rw: clamp(250px, 22vw, 440px);   /* คอลัมน์ขวา (ขั้นต่ำ · fitBoard คำนวณค่าเดียวกันใน JS) */
  --rwmax: 640px;
  --gap: 12px;
  --ink: #2f5a3a;
}
.game-page.is-phone {
  --gear-size: 32px; --gear-top: calc(var(--safe-t) + 8px); --gear-right: calc(var(--safe-r) + 6px);
  --lw: clamp(116px, 21vw, 185px);  /* คอลัมน์ซ้าย: ช่วง · ตาของ · ผู้เล่นในห้อง (แบบเดียวกับคอม ย่อขนาด) */
  --rw: clamp(170px, 22vw, 196px);
  --rwmax: 250px;
  --gap: 8px;
}
.layout {
  position: absolute; z-index: 10;
  inset: calc(var(--safe-t) + 10px) calc(var(--safe-r) + 10px) calc(var(--safe-b) + 10px) calc(var(--safe-l) + 10px);
  display: grid; grid-template-columns: var(--lw) minmax(0, 1fr) var(--rw); gap: var(--gap);
  justify-content: space-between; /* ที่ว่างที่เหลือ (ถ้ามี) กระจายเป็นช่องไฟระหว่างคอลัมน์ */
  pointer-events: none;
}
.is-phone .layout { inset: calc(var(--safe-t) + 6px) calc(var(--safe-r) + 6px) calc(var(--safe-b) + 6px) calc(var(--safe-l) + 6px); }
.col { min-height: 0; display: flex; flex-direction: column; gap: var(--gap); pointer-events: auto; }
.board-slot { min-height: 0; pointer-events: none; } /* Phaser วาดโต๊ะตรงนี้ (คลิกทะลุไปที่ canvas) */

/* แผงกระจกฝ้าโปร่งแสง */
.glass {
  background: rgba(255, 255, 255, 0.58);
  backdrop-filter: blur(10px) saturate(1.15); -webkit-backdrop-filter: blur(10px) saturate(1.15);
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  border-radius: 18px;
  box-shadow: 0 6px 18px rgba(50, 90, 70, 0.12);
}

/* ---- ป้ายช่วง (สีพาสเทลตามช่วง) ---- */
.phase-pill {
  --a: #d9f5e1; --b: #b7e9c6; --t: #24603a;
  display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.95rem; border-radius: 999px;
  background: linear-gradient(180deg, var(--a), var(--b)); color: var(--t);
  border: 2px solid rgba(255, 255, 255, 0.9); box-shadow: 0 4px 12px rgba(50, 90, 70, 0.14);
  transition: background 0.6s, color 0.6s;
}
.phase-pill.p2 { --a: #fff0d9; --b: #ffd9a8; --t: #8a4f0e; }
.phase-pill.p3 { --a: #ffe3df; --b: #ffc2b8; --t: #9a2f25; animation: soft-pulse 2s ease-in-out infinite; }
.phase-pill b { font-family: var(--font-head); font-size: 1.15rem; font-weight: 700; }
.phase-pill small { margin-left: auto; font-size: 0.8rem; font-weight: 700; opacity: 0.85; white-space: nowrap; }
.dots { display: flex; gap: 3px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255, 255, 255, 0.8); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08); }
.dots i.on { background: currentColor; }
@keyframes soft-pulse { 50% { box-shadow: 0 0 0 4px rgba(255, 160, 150, 0.35), 0 4px 12px rgba(50, 90, 70, 0.14); } }

/* ---- ป้ายตาของใคร ---- */
.turn-pill {
  display: flex; align-items: center; gap: 0.45rem; min-width: 0;
  padding: 0.3rem 0.8rem 0.3rem 0.35rem; border-radius: 999px;
  background: rgba(255, 255, 255, 0.78); color: var(--ink);
  border: 2px solid rgba(255, 255, 255, 0.95); box-shadow: 0 4px 12px rgba(50, 90, 70, 0.12);
  transition: background 0.3s;
}
.turn-pill .tt { min-width: 0; font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.turn-pill.mine { background: linear-gradient(180deg, #fff6cf, #ffe49a); color: #7a5200; box-shadow: 0 0 0 3px rgba(255, 214, 102, 0.45), 0 4px 14px rgba(200, 150, 40, 0.25); animation: mine-glow 1.6s ease-in-out infinite; }
.turn-pill.threat { background: linear-gradient(180deg, #ffe6e2, #ffcbc3); color: #9a2f25; }
@keyframes mine-glow { 50% { box-shadow: 0 0 0 6px rgba(255, 214, 102, 0.3), 0 4px 14px rgba(200, 150, 40, 0.25); } }

/* ---- เวลา + การแจ้งเตือน ---- */
.status { display: flex; gap: var(--gap); align-items: stretch; }
.left .status { flex-direction: column; }
.timer-box { display: grid; place-items: center; padding: 0.55rem; flex: none; }
.idle {
  width: 92px; height: 92px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.7); box-shadow: inset 0 0 0 5px rgba(47, 107, 44, 0.12); color: #7d8e80;
}
.idle b { font-family: var(--font-head); font-size: 1.5rem; line-height: 1; }
.idle.sm { width: 72px; height: 72px; }
.idle.sm b { font-size: 1.2rem; }
.idle.sm small { font-size: 0.56rem; }
.idle small { max-width: 80%; text-align: center; white-space: nowrap; overflow: hidden; font-size: 0.66rem; font-weight: 600; line-height: 1.2; margin-top: 0.15rem; }
.notify { flex: 1; min-width: 0; min-height: 4.2rem; padding: 0.55rem 0.8rem; display: flex; flex-direction: column; justify-content: center; gap: 0.25rem; overflow: hidden; }
.notify p { margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--ink); line-height: 1.35; }
.notify p.ok { color: #2c7a44; }
.notify p.error { color: #b8433a; }
.notify p.old { font-size: 0.76rem; font-weight: 600; opacity: 0.55; }
.notify p.none { font-weight: 500; color: #8a9a8d; font-size: 0.85rem; text-align: center; }
/* ข้อความยาว: ตัดไม่ให้ดันกล่องจนผู้เล่นในห้องล้น (ล่าสุด 2 บรรทัด · เก่า 1 บรรทัด) */
.notify p { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.notify p.old { -webkit-line-clamp: 1; }

/* แท็บเล็ต / จอคอมเตี้ย (สูง 501–899px): ย่อคอลัมน์ซ้ายให้ "ผู้เล่นในห้อง" พอดี ไม่ล้น */
@media (min-height: 501px) and (max-height: 899px) {
  .left { gap: 8px; }
  .phase-pill { padding: 0.32rem 0.8rem; }
  .phase-pill b { font-size: 1rem; }
  .turn-pill { padding: 0.2rem 0.7rem 0.2rem 0.3rem; }
  .turn-pill .tt { font-size: 0.86rem; }
  .left .timer-box { padding: 0.35rem; }
  .left .notify { min-height: 3.2rem; padding: 0.45rem 0.7rem; }
  .left .notify p { font-size: 0.84rem; }
  .left .notify p.old { font-size: 0.7rem; }
}
.note-enter-active { transition: transform 0.35s var(--ease-back), opacity 0.25s; }
.note-enter-from { transform: translateY(-8px); opacity: 0; }
.note-leave-active { display: none; }
.note-move { transition: transform 0.3s; }

.players-box { flex: 1; min-height: 0; }

/* ---- เครื่องมือ (ขวาบน · เว้นที่ให้ปุ่มฟันเฟือง) ---- */
.tools { display: flex; justify-content: flex-end; align-items: center; gap: 0.4rem; min-height: 42px; padding-right: calc(var(--gear-size) + 0.4rem); flex: none; }
.tool, .abil {
  height: 40px; min-width: 40px; border-radius: 999px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 3px; padding: 0 7px;
  background: rgba(255, 255, 255, 0.82); border: 1.5px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 3px 10px rgba(50, 90, 70, 0.14);
}
.tool svg { width: 21px; height: 21px; fill: none; stroke: var(--leaf); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.ab { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: #eef0ec; }
.ab svg { width: 19px; height: 19px; fill: none; stroke: #b3bab0; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ab.on { background: var(--c); box-shadow: 0 0 0 2px #fff, 0 0 8px 2px color-mix(in srgb, var(--c) 60%, transparent); }
.ab.on svg { stroke: var(--ink); }
.ab.big { width: 2.6rem; height: 2.6rem; flex: none; }
.ab.big svg { width: 1.6rem; height: 1.6rem; }

/* ---- การ์ดของเรา (คอม) ---- */
.mine-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.5rem; padding: 0.6rem; }
.mine-panel > :first-child { flex: 1; min-height: 0; }

/* ---- ปุ่มการกระทำ ---- */
.actions { flex: none; min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.3rem; }
.act { min-height: 40px; padding: 0 1rem; font-size: 0.95rem; }
.hint { font-size: 0.85rem; font-weight: 700; color: var(--ink); text-align: center; min-width: 0; }
.peek-btn { display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; } /* ไม่มีเงากะพริบ — ปุ่มนิ่ง ๆ */
.peek-btn svg { width: 1.2em; height: 1.2em; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
@keyframes peek-pulse { 50% { box-shadow: 0 0 0 4px rgba(245, 166, 35, 0.3), 0 0.25rem 0 var(--btn-edge); } }
.hint.wait { display: inline-flex; align-items: center; gap: 0.4rem; color: #6d7f71; font-weight: 600; }
.dotty { width: 8px; height: 8px; border-radius: 50%; background: var(--leaf-soft); animation: blink 1s ease-in-out infinite; }

/* ---- ป้ายของกองบนโต๊ะ (HTML) ---- */
.pile-lbl { position: absolute; z-index: 12; pointer-events: none; }
.pl {
  position: absolute; left: 50%; transform: translate(-50%, -50%); white-space: nowrap;
  padding: 0.18rem 0.7rem; border-radius: 999px; font-size: 0.82rem; font-weight: 700; line-height: 1.3;
  background: rgba(255, 255, 255, 0.95); color: #2f5a3a;
  border: 1.5px solid #cfe8d6; box-shadow: 0 2px 8px rgba(40, 70, 50, 0.18);
}
.pl.top { top: 0; }
.pl.num { top: 100%; background: #4f7f5c; color: #fff; border-color: #fff; }
.pl.hintp { top: 50%; background: transparent; border: 0; box-shadow: none; color: rgba(47, 90, 58, 0.55); font-weight: 600; }
.pl.peek { top: 55%; background: #ffcf6e; color: #6b4a00; border-color: #fff; animation: peek-bob 1.2s ease-in-out infinite; }
@keyframes peek-bob { 50% { transform: translate(-50%, -50%) scale(1.1); } }

/* ---- มือถือ: ปุ่มการกระทำ · ปุ่มเปิดการ์ด 3 หมวด · ป๊อปอัปการ์ด ---- */
.hint.arrows { margin: 0; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.2rem; line-height: 1.5; }
.arw {
  width: 1.25rem; height: 1.25rem; border-radius: 50%; display: inline-grid; place-items: center; flex: none;
  background: #fff; border: 1.5px solid #3a7d2c; color: #3a7d2c;
}
.arw svg { width: 0.85rem; height: 0.85rem; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.act-row { display: flex; justify-content: center; gap: 0.35rem; flex-wrap: wrap; width: 100%; }
.is-phone .actions { flex-direction: column; gap: 0.3rem; }

/* ---- มือถือ: คอลัมน์ขวา (ออกแบบใหม่) ---- */
/* การ์ดสถานะ: วงเวลา | ตาของใคร + แจ้งเตือนล่าสุด */
.pstat { flex: none; display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.6rem 0.35rem 0.35rem; border-radius: 16px; min-height: 3.1rem; }
.pstat.mine { background: linear-gradient(180deg, rgba(255, 248, 214, 0.92), rgba(255, 236, 170, 0.88)); border-color: #fff; box-shadow: 0 0 0 2px #f6cf6a, 0 6px 18px rgba(200, 150, 40, 0.18); }
.ptimer { flex: none; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; }
.pidle { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.75); box-shadow: inset 0 0 0 3px rgba(47, 107, 44, 0.12); }
.ptext { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.05rem; }
.pturn { font-family: var(--font-head); font-size: 0.8rem; font-weight: 700; color: #2f5a3a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 2px; }
.pstat.mine .pturn { color: #8a5a00; }
.pnote { display: block; min-height: 1em; }
.pnote span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; padding-left: 2px; font-size: 0.64rem; font-weight: 600; line-height: 1.35; color: #4f6857; }
.pnote span.ok { color: #2c7a44; }
.pnote span.error { color: #b8433a; }

/* สิ่งที่ต้องทำ: แถบบาง ๆ ไม่มีกรอบหนา */
.pact { flex: none; display: flex; flex-direction: column; align-items: center; gap: 0.3rem; }
.phint { margin: 0; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.18rem; font-size: 0.66rem; font-weight: 700; color: #2f5a3a; padding: 0.15rem 0.6rem; border-radius: 999px; background: rgba(255, 255, 255, 0.82); }
.phint .arw { width: 1.05rem; height: 1.05rem; }
.pact .act { min-height: 30px; font-size: 0.76rem; }

/* การ์ดของฉัน: กรอบเดียว 2 แถว */
.pmine { flex: 1 1 0; min-height: 0; max-height: 13rem; display: flex; flex-direction: column; padding: 0.3rem; border-radius: 16px; gap: 0.25rem; }
.prow {
  flex: 1 1 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 0.15rem;
  padding: 0.25rem 0.35rem 0.3rem; border-radius: 12px; border: 0; cursor: pointer; font: inherit; text-align: left;
  background: rgba(255, 255, 255, 0.5); transition: background 0.15s;
}
.prow:active { background: rgba(255, 255, 255, 0.85); }
.prow.glow { box-shadow: inset 0 0 0 2px #f09bb5; background: rgba(255, 240, 245, 0.75); }
.ptag { flex: none; display: flex; align-items: center; gap: 0.3rem; font-size: 0.62rem; font-weight: 700; color: #4f6f57; padding-left: 2px; }
.ptag b { min-width: 1.1rem; padding: 0 0.3rem; border-radius: 999px; text-align: center; font-size: 0.6rem; color: #fff; background: #7fb5e3; }
.prow.rights .ptag b { background: #ea7fa2; }

.pbtns { flex: none; display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: auto; padding: 0 6px 6px 0; }
/* ปุ่มกลมแบบเกม: วงกลมสีพาสเทลไล่สี ขอบขาวหนา เงานูนด้านล่าง ไอคอนทึบสีขาว
   สิทธิที่สร้างแล้ว = เหลือง · การ์ดสิทธิในมือ = ชมพู · การ์ดในมือ = ฟ้า (สีเดียวกับ Navbar) */
.pbtn {
  --c: #5aa0dd; --c-light: #a9d4f7; --c-deep: #2f6fa8;
  position: relative; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; padding: 0; margin: 0;
  display: flex; align-items: center; justify-content: center; line-height: 0;
  background: radial-gradient(circle at 35% 28%, #ffffff 0 8%, transparent 9%), linear-gradient(180deg, var(--c-light) 0%, var(--c) 70%);
  border: 3px solid #ffffff;
  box-shadow: 0 4px 0 var(--c-deep), 0 7px 12px rgba(30, 60, 45, 0.25);
  transition: transform 0.15s var(--ease-back), box-shadow 0.15s;
}
.pbtn.built { --c: #efb834; --c-light: #ffe08a; --c-deep: #b8841a; --c-soft: #fff6dc; }
.pbtn.rights { --c: #ea7fa2; --c-light: #ffc2d4; --c-deep: #b24f73; --c-soft: #fde8ef; }
.pbtn.acts { --c-soft: #e6f2fd; }
.pbtn svg { display: block; flex: none; width: 24px; height: 24px; filter: drop-shadow(0 1.5px 0 var(--c-deep)); }
/* มีรูปไอคอนของทีม: พื้นปุ่มขาวนวล ขอบสีตามหมวด · รูปใหญ่เต็มวง ล้นขอบนิด ๆ ให้ดูน่ารัก */
.pbtn:has(.pic) {
  background: radial-gradient(circle at 50% 40%, #ffffff 0%, var(--c-soft, #f3f8ff) 100%);
  box-shadow: 0 0 0 2.5px var(--c), 0 4px 0 2.5px var(--c-deep), 0 8px 14px rgba(30, 60, 45, 0.25);
}
.pbtn .pic { display: block; width: 104%; height: 104%; max-width: none; object-fit: contain; pointer-events: none; filter: drop-shadow(0 1.5px 1px rgba(30, 50, 80, 0.25)); }
.pbtn.on:has(.pic) { box-shadow: 0 0 0 2.5px var(--c), 0 1px 0 2.5px var(--c-deep), 0 0 0 7px color-mix(in srgb, var(--c) 40%, transparent); }
.pbtn.glow:has(.pic) { box-shadow: 0 0 0 2.5px var(--c), 0 4px 0 2.5px var(--c-deep), 0 0 0 7px color-mix(in srgb, var(--c-light) 70%, transparent); }
.pbtn svg .w { fill: #ffffff; }
.pbtn svg .w2 { fill: rgba(255, 255, 255, 0.72); }
.pbtn svg .d { fill: var(--c); }
.pbtn:hover { transform: translateY(-2px); }
.pbtn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--c-deep), 0 3px 6px rgba(30, 60, 45, 0.2); }
/* ป๊อปอัปของปุ่มนี้เปิดอยู่: ยุบลง + วงแหวนสีขาวรอบ */
.pbtn.on { transform: translateY(3px); box-shadow: 0 1px 0 var(--c-deep), 0 0 0 4px rgba(255, 255, 255, 0.85), 0 0 0 7px color-mix(in srgb, var(--c) 45%, transparent); }
.pbtn.glow { box-shadow: 0 4px 0 var(--c-deep), 0 0 0 4px color-mix(in srgb, var(--c-light) 75%, transparent); } /* สร้างสิทธิได้: วงแหวนนิ่ง (ไม่กะพริบ) */
@keyframes pbtn-glow { 50% { box-shadow: 0 4px 0 var(--c-deep), 0 0 0 6px color-mix(in srgb, var(--c-light) 70%, transparent), 0 7px 12px rgba(30, 60, 45, 0.25); transform: translateY(-2px) rotate(-4deg); } }
.pbtn.bump { animation: pbtn-bump 0.6s var(--ease-back); }
@keyframes pbtn-bump { 0% { transform: scale(1); } 35% { transform: scale(1.3) rotate(-8deg); box-shadow: 0 4px 0 var(--c-deep), 0 0 0 6px rgba(255, 214, 102, 0.6); } 100% { transform: scale(1); } }
.hp-card.flying { visibility: hidden; }
.pc {
  position: absolute; right: -6px; top: -6px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 700; font-style: normal; line-height: 1; color: #fff;
  background: linear-gradient(180deg, #ff8a7a, #e0574b); border: 2px solid #fff; box-shadow: 0 2px 0 #a93a31;
}

/* ป๊อปอัปการ์ด: ลอยเหนือปุ่ม 3 ปุ่ม มุมขวาล่าง ทับโต๊ะบางส่วน (ตามไวร์เฟรม) */
.cards-pop {
  position: fixed; z-index: 70;
  pointer-events: auto; /* อยู่ใน .layout ที่ปิด pointer-events → ต้องเปิดคืน ไม่งั้นแตะทะลุไปโดนกล่องการ์ดข้างใต้ */
  right: calc(var(--safe-r) + 6px);
  bottom: calc(var(--safe-b) + 6px + 36px + 16px);
  width: min(56vw, 520px); height: min(60vh, 16rem);
  display: flex; flex-direction: column; overflow: hidden;
  background: rgba(255, 255, 255, 0.96); border: 2px solid #fff; border-radius: 18px;
  box-shadow: 0 12px 32px rgba(30, 60, 45, 0.28);
}
.ph { flex: none; display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.4rem 0.2rem 0.8rem; }
.ph h4 { flex: 1; margin: 0; font-family: var(--font-head); font-size: 0.9rem; font-weight: 700; color: #2f5a3a; }
.ph h4 span { color: #6d8a73; font-weight: 600; }
.dx { flex: none; width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid #e1ebe0; background: #f4f7f2; color: #56655a; display: grid; place-items: center; cursor: pointer; padding: 0; }
.dx svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
.pbody { flex: 1; min-height: 0; margin: 0 0.55rem 0.55rem; padding: 0.45rem; border-radius: 14px; border: 1.5px solid #e1ebe0; background: #fbfdfa; }
.pbody :deep(h4) { display: none; } /* ชื่อหมวดอยู่ที่หัวป๊อปอัปแล้ว */
.pfoot { flex: none; display: flex; justify-content: center; gap: 0.5rem; padding: 0 0.5rem 0.5rem; }
.pop-enter-active { transition: transform 0.3s var(--ease-back), opacity 0.2s; transform-origin: 90% 100%; }
.pop-leave-active { transition: transform 0.18s ease-in, opacity 0.18s; transform-origin: 90% 100%; }
.pop-enter-from, .pop-leave-to { transform: scale(0.85) translateY(10px); opacity: 0; }

/* ---- มือถือ: ขนาดเล็กลง ---- */
.is-phone .phase-pill { padding: 0.28rem 0.6rem; gap: 0.3rem; }
.is-phone .phase-pill b { font-size: 0.85rem; }
.is-phone .phase-pill small { display: none; } /* จำนวนกองจั่วมีป้ายบนโต๊ะแล้ว */
.is-phone .phase-pill { justify-content: center; }
.is-phone .dots i { width: 5px; height: 5px; }
.is-phone .turn-pill { padding: 0.18rem 0.55rem 0.18rem 0.2rem; gap: 0.3rem; }
.is-phone .turn-pill .tt { font-size: 0.72rem; }
.is-phone .tools { min-height: 36px; padding-right: calc(var(--gear-size) + 0.25rem); gap: 0.25rem; }
.is-phone .tool, .is-phone .abil { height: 32px; min-width: 32px; padding: 0 4px; gap: 2px; }
.is-phone .tool svg { width: 17px; height: 17px; }
.is-phone .ab { width: 24px; height: 24px; }
.is-phone .ab svg { width: 15px; height: 15px; }
.is-phone .timer-box { padding: 0.2rem; border-radius: 50%; }
.is-phone .idle { width: 42px; height: 42px; box-shadow: inset 0 0 0 4px rgba(47, 107, 44, 0.12); }
.is-phone .idle b { font-size: 0.82rem; }
/* มือถือ: ช่องโต๊ะยืดเกือบชิดขอบจอบน/ล่าง → การ์ดกองกลางใหญ่ขึ้น (ส่วนอื่นยังเว้นขอบตามเดิม) */
.is-phone .board-slot { margin: calc(2px - var(--safe-t) - 6px) 0 calc(1px - var(--safe-b) - 6px); }

/* มือถือ: ตัวอย่างการ์ดในมือ */
.hand-peek {
  flex: 1 1 0; min-height: 3rem; max-height: 6.5rem; display: flex; flex-direction: column; gap: 0.2rem;
  padding: 0.3rem 0.45rem 0.45rem; cursor: pointer; text-align: left; color: var(--ink);
  border-radius: 14px; font: inherit;
}
.hand-peek.glow { box-shadow: 0 0 0 3px rgba(108, 199, 136, 0.55), 0 6px 18px rgba(50, 90, 70, 0.12); }
.hand-peek:active { transform: scale(0.98); }
.hp-head { flex: none; font-size: 0.66rem; font-weight: 700; color: #4f6f57; }
.hp-row { flex: 1; min-height: 0; display: flex; justify-content: center; overflow: hidden; }
/* --rh = ความสูงจริงของแถว (วัดด้วย v-fit) · ไม่ใช้ container query เพราะ Safari/Android รุ่นเก่าไม่รองรับ → การ์ดล้นกรอบ */
.hp-card { flex: 0 1 calc(var(--rh, 2.6rem) * 0.714); min-width: 0; height: 100%; }
.hp-card + .hp-card { margin-left: 3px; }
.hp-card:last-child { flex-shrink: 0; }
.hp-card img {
  display: block; height: var(--rh, 2.6rem); width: auto; max-width: none; aspect-ratio: 5 / 7;
  border-radius: 7%/5%; box-shadow: 0 1px 5px rgba(40, 70, 50, 0.3);
}
.hp-empty { flex: 1; display: grid; place-items: center; font-size: 0.66rem; color: #8a9a8d; }
.is-phone .notify { min-height: 0; padding: 0.4rem 0.75rem; border-radius: 14px; }
.is-phone .notify p { padding-left: 2px; } /* สระ/วรรณยุกต์ที่ยื่นออกซ้าย (เช่น ใ ไ) ไม่ถูกตัด */
.is-phone .notify p { font-size: 0.66rem; }
.is-phone .pl { font-size: 0.62rem; padding: 0.1rem 0.45rem; }
.is-phone .pl.num { top: calc(100% - 9px); } /* ป้ายจำนวนขยับขึ้นมาบนการ์ด → ไม่ทับเส้นกรอบด้านล่าง */
.is-phone .notify p.old { font-size: 0.6rem; }
.is-phone .notify p.none { font-size: 0.66rem; }
.is-phone .actions { min-height: 0; padding: 0.35rem; border-radius: 14px; }
.is-phone .act { min-height: 32px; padding: 0 0.6rem; font-size: 0.78rem; }
.is-phone .hint { font-size: 0.7rem; }

/* ---------- ป้ายประกาศกลางจอ (โทนพาสเทล) ---------- */
.banner {
  --c1: rgba(255, 236, 170, 0.92); --c2: rgba(255, 246, 214, 0.96); --t: #7a5200; --sub: #6b5520;
  position: fixed; left: 0; right: 0; top: 44%; z-index: 45; transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
  padding: 0.7rem 1rem 0.8rem; text-align: center; pointer-events: none;
  background: linear-gradient(90deg, transparent 0%, var(--c1) 16%, var(--c2) 50%, var(--c1) 84%, transparent 100%);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 10px 30px rgba(50, 90, 70, 0.15);
}
.banner strong {
  font-family: var(--font-head); font-weight: 700; font-size: 2.4rem; line-height: 1.2; color: var(--t);
  text-shadow: 0 2px 0 #fff, 0 0 18px rgba(255, 255, 255, 0.9);
  animation: banner-pop 0.45s var(--ease-back) 0.08s both;
}
.banner span {
  max-width: min(46rem, 92vw); font-size: 1rem; font-weight: 700; color: var(--sub);
  animation: banner-sub 0.4s ease-out 0.25s both;
}
.banner.unlock { --c1: rgba(200, 238, 210, 0.92); --c2: rgba(232, 250, 236, 0.96); --t: #25653d; --sub: #2f5a3a; }
.banner.phase { --c1: rgba(255, 220, 180, 0.92); --c2: rgba(255, 240, 222, 0.96); --t: #8a4f0e; }
.banner-enter-active { transition: transform 0.35s var(--ease-back), opacity 0.25s; }
.banner-leave-active { transition: transform 0.3s ease-in, opacity 0.3s; }
.banner-enter-from { transform: translateY(-50%) scaleY(0.2); opacity: 0; }
.banner-leave-to { transform: translateY(-50%) scaleY(0.2); opacity: 0; }
@keyframes banner-pop { 0% { transform: scale(1.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes banner-sub { from { transform: translateY(6px); opacity: 0; } }

/* ---------- จบเกม ---------- */
.end { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(15, 25, 15, 0.55); padding: 1rem; }
.end-card {
  width: min(28rem, 100%); padding: 1.2rem 1.4rem; display: flex; flex-direction: column; gap: 0.5rem; text-align: center;
  animation: pop 0.5s var(--ease-back); max-height: 100%; overflow-y: auto;
  background: rgba(255, 255, 255, 0.94); border: 2px solid #ffe3a3; border-radius: 1.4rem;
  box-shadow: 0 16px 40px rgba(40, 60, 50, 0.3);
}
.end-card h2 { font-family: var(--font-head); font-size: 2rem; color: #c0514a; }
.end-card .sub { font-size: 0.85rem; color: var(--text-muted); }
.who { font-family: var(--font-head); font-size: 1.3rem; font-weight: 700; color: #24452b; }
.who.win { color: #b07a12; }
.mini-rank { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.mini-rank li { display: grid; grid-template-columns: 1.6rem 1fr auto; gap: 0.5rem; align-items: center; padding: 0.2rem 0.5rem; border-radius: 0.6rem; background: #f6f8f3; font-size: 0.9rem; }
.mini-rank li.me { background: #fff6d8; }
.rk { width: 1.4rem; height: 1.4rem; border-radius: 50%; background: #e7ece4; display: grid; place-items: center; font-weight: 700; font-size: 0.8rem; }
.mini-rank .nm { text-align: left; font-weight: 600; }
.save-err { font-size: 0.78rem; color: #b8433a; }

/* ---------- เชื่อมต่อ ---------- */
.boot { position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8rem; font-weight: 600; color: #24452b; text-shadow: 0 0 8px #fff; }
.boot-btns { display: flex; gap: 0.6rem; }
.spin { width: 1.8rem; height: 1.8rem; border: 3px solid var(--leaf); border-right-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; }

/* ---------- ป๊อปอัป ---------- */
.pub-note { font-size: 0.82rem; color: var(--text-muted); margin: 0.6rem 0; }
.peek { display: flex; gap: 1rem; align-items: center; }
/* ความสูงการ์ด = ความสูงจอ − หัวป๊อปอัป/ขอบ → ไม่มีวันล้นจอ */
.peek :deep(.peek-card) { height: min(22rem, calc(100dvh - 9.5rem)); width: auto; cursor: zoom-in; }
.peek-side { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 0.45rem; }
.peek-type { font-size: 0.75rem; font-weight: 700; color: #fff; background: var(--accent); padding: 0.05rem 0.6rem; border-radius: 999px; }
.peek-side h4 { margin: 0; font-family: var(--font-head); font-size: 1.2rem; color: #24452b; line-height: 1.3; }
.peek-note { font-size: 0.82rem; color: var(--text-muted); margin: 0; }
.peek-btns { display: flex; flex-direction: column; align-self: stretch; gap: 0.45rem; }
@media (max-height: 500px) {
  .peek { gap: 0.7rem; }
  .peek :deep(.peek-card) { height: calc(100dvh - 7rem); }
  .peek-side h4 { font-size: 0.95rem; }
  .peek-note { font-size: 0.7rem; }
  .peek-btns .btn { min-height: 34px; font-size: 0.82rem; }
}
.hand { display: flex; flex-direction: column; gap: 0.8rem; }
.hand h5, .opp h5 { margin: 0 0 0.4rem; font-size: 0.9rem; color: var(--accent); }
.rights { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.right-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.6rem 0.35rem 0.35rem; border-radius: 0.8rem; background: #f6f8f3; cursor: pointer; }
.right-item b { display: block; font-size: 0.9rem; }
.right-item small { font-size: 0.75rem; color: var(--text-muted); }
.acts { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.acts > * { cursor: pointer; }
.built { position: relative; }
.prot { position: absolute; left: 50%; bottom: -0.35rem; transform: translateX(-50%); white-space: nowrap; font-size: 0.62rem; font-weight: 700; padding: 0 0.4rem; border-radius: 999px; background: var(--leaf); color: #fff; }
.empty { font-size: 0.82rem; color: var(--text-faint); }
.opp p { font-size: 0.9rem; margin-bottom: 0.6rem; }
.abilities { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
.abilities li { display: flex; gap: 0.7rem; align-items: flex-start; opacity: 0.75; }
.abilities li.on { opacity: 1; }
.abilities em { font-style: normal; font-size: 0.72rem; padding: 0 0.45rem; border-radius: 999px; background: #eceee9; color: var(--text-muted); }
.abilities li.on em { background: #e2f3de; color: #2f7a2e; }
.abilities p { font-size: 0.85rem; margin-top: 0.1rem; }
.abilities small { font-size: 0.72rem; color: var(--text-faint); }
.log { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; }
.log li.threat, .log li.lose { color: #b8433a; }
.log li.build, .log li.unlock { color: #2f7a2e; }
.log li.phase { font-weight: 700; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes pop { from { transform: scale(0.85); opacity: 0; } }
@keyframes blink { 50% { opacity: 0.3; } }

/* จอใหญ่ (คอม) */
@media (min-height: 820px) {
  .phase-pill b { font-size: 1.35rem; }
  .turn-pill .tt { font-size: 1.1rem; }
  .notify p { font-size: 1.02rem; }
  .act { min-height: 46px; font-size: 1.08rem; padding: 0 1.2rem; }
  .hint { font-size: 1rem; }
}

@media (max-height: 500px) {
  .banner { padding: 0.45rem 1rem 0.55rem; }
  .banner strong { font-size: 1.7rem; }
  .banner span { font-size: 0.78rem; }
  .end-card { padding: 0.7rem 1rem; gap: 0.35rem; }
  .end-card h2 { font-size: 1.3rem; }
  .who { font-size: 1rem; }
  .mini-rank li { font-size: 0.78rem; padding: 0.1rem 0.4rem; }
}
</style>
