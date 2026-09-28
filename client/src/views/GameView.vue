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
import PlayersPanel from '@/components/game/PlayersPanel.vue';
import MyCards from '@/components/game/MyCards.vue';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import { sceneBg, preloadUi } from '@/services/uiArt';
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
  const rwMin = num('--rw') || 170;
  const rwMax = num('--rwmax') || rwMin;
  const W = el.clientWidth;
  const ideal = scene.idealWidth(el.clientHeight);                  // โต๊ะกว้างเท่าไรถึงพอดีความสูง
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
function openPanel(k, ms = 0) {
  if (!phoneUI.value) return;
  clearTimeout(panelTimer);
  panel.value = k;
  if (ms) panelTimer = setTimeout(() => { if (panel.value === k) panel.value = null; }, ms);
}
function togglePanel(k) {
  play('click');
  clearTimeout(panelTimer);
  panel.value = panel.value === k ? null : k;
}
/** ปุ่มเปิดลิ้นชักการ์ด: เปิดแท็บที่น่าดูที่สุด (มีการ์ดสิทธิที่สร้างได้ → แท็บสิทธิ, ไม่งั้นการ์ดในมือ) */
function toggleDrawer() {
  if (panel.value) return togglePanel(panel.value);
  togglePanel(myBuild.value && handRights.value.length ? 'rights' : 'acts');
}
// ---- แอนิเมชันการ์ดบินบนแผงของเรา (HTML + Web Animations API) ----
const flying = ref([]);          // id การ์ดที่กำลังบิน → ซ่อนใบจริงใน MyCards
const freshBuilt = ref(null);    // การ์ดที่เพิ่งสร้าง → เรืองแสง
const cardRect = (id) => document.querySelector(`.mine-panel [data-card="${id}"]`)?.getBoundingClientRect() || null;
/** สร้างการ์ดลอย (position: fixed) แล้วเล่นคีย์เฟรมจากกรอบ from ไปกรอบ to */
async function flyCard(id, from, to, { lift = false, duration = 560 } = {}) {
  const img = document.createElement('img');
  img.src = art ? art.url(id) : '';
  Object.assign(img.style, {
    position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
    zIndex: 60, pointerEvents: 'none', borderRadius: '7% / 5%', transformOrigin: '50% 50%',
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
/** การ์ดสิทธิ: เด้งขึ้นจาก "การ์ดสิทธิในมือ" (หรือโซนสาธารณะ) แล้วลอยไปวางต่อท้ายใน "สิทธิที่สร้างแล้ว" */
async function flyRightToBuilt(id, from) {
  let src = from === 'public' && piles.value?.pub
    ? { left: piles.value.pub.x, top: piles.value.pub.y, width: piles.value.pub.w, height: piles.value.pub.h }
    : cardRect(id);
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
const nameOf = (id) => (id === me.value ? 'คุณ' : players.value.find((p) => p.id === id)?.name || id);
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
      on: {
        lineTap, slotTap,
        cardInfo: (id) => { if (id) { play('click'); modal.card = id; } },
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
    ? (kind === 'built' ? ['me:built', 'btn:cards'] : ['me:hand', 'btn:cards'])
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
      if (e.player === me.value) openPanel('acts', 3500); // มือถือ: กางการ์ดในมือให้เห็นใบที่เพิ่งได้ แล้วหุบเอง
      break;
    case 'build': {
      const rn = cards[e.right]?.shortName;
      play('build');
      if (e.player === me.value && !phoneUI.value && document.querySelector('.mine-panel')) {
        // คอม: แอนิเมชันเป็น HTML (อยู่เหนือแผงการ์ดของเรา) → ทิ้งการ์ดกิจกรรมลงกองทิ้ง แล้วการ์ดสิทธิเด้งไปช่อง "สิทธิที่สร้างแล้ว"
        await flyDiscards(e.discards);
        await flyRightToBuilt(e.right, e.from);
      } else {
        await scene.cardsLeavePlayer(e.player, e.discards);
        await scene.rightToBuilt(e.player, e.right, e.from);
      }
      notify(e.player === me.value ? `สร้าง "${rn}" สำเร็จ! +${cards[e.right].points} คะแนน` : `${pname} สร้าง "${rn}"`, e.player === me.value ? 'ok' : 'info');
      if (e.player === me.value) openPanel('built', 2600); // มือถือ: โชว์สิทธิที่เพิ่งสร้างแป๊บหนึ่ง
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
      play(e.phase >= 3 ? 'threat' : 'phase');
      // เปลี่ยนพื้นหลังตอนภาพกระแทกเต็มจอพอดี (จุดที่ 5–6)
      await showSplash(`p${e.phase}`, `ช่วงที่ ${e.phase}`, PHASE_SUB[e.phase], 2600, () => { sceneBg.key = BG_OF[e.phase]; });
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
      if (e.player === me.value) { play('lose'); openPanel('acts', 2600); }
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
      play('threat');
      // จบเกม → ภาพประกาศสีแดง แล้วพื้นหลังกลับเป็นแบบเดิม
      await showSplash('end', 'จบเกม!', 'โลกเข้าสู่จุดพลิกผัน', 2600, () => { sceneBg.key = null; });
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
watch(myBuild, (v) => { if (v && handRights.value.length) openPanel('rights'); });

// มีป๊อปอัปเปิดอยู่ → ปิดการแตะบนกระดาน (กันแตะทะลุ)
const overlayOpen = computed(() => Boolean(
  modal.card || modal.hand || modal.opp || modal.pub || modal.ability || modal.log || modal.rules
  || (modal.build && myBuild.value) || myPeek.value || threatUI.value || endUI.value,
));
watch(overlayOpen, (v) => { if (scene) scene.input.enabled = !v; });

const showTimer = computed(() => Boolean(myTimer.value && isMyTurn.value && !threatUI.value));
const TITLES = { acts: 'การ์ดในมือ', rights: 'การ์ดสิทธิในมือ', built: 'สิทธิที่สร้างแล้ว' };
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
  <main class="game-page" :class="[{ quake }, phoneUI ? 'is-phone' : 'is-desk']">
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
        <div v-if="view && phoneUI" class="phase-mini" :class="`p${view.phase}`" title="ช่วงของเกม">
          <small>ช่วง</small><b>{{ view.phase }}</b>
        </div>
        <div v-if="view && !phoneUI" class="phase-pill" :class="`p${view.phase}`" title="ช่วงของเกม">
          <b>ช่วงที่ {{ view.phase }}</b>
          <span class="dots"><i v-for="n in 3" :key="n" :class="{ on: n <= view.phase }" /></span>
          <small>กองจั่ว {{ view.deckLeft }}</small>
        </div>
        <div v-if="view && !phoneUI" class="turn-pill" :class="{ mine: isMyTurn, threat: view.stage === 'coins' }">
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
              <div v-else class="idle" :class="{ sm: !tallUI }"><b>{{ isMyTurn ? '...' : 'รอ' }}</b><small>เวลา 20 วินาที</small></div>
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
          :compact="phoneUI"
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

        <!-- มือถือ: เวลา + แจ้งเตือน -->
        <div v-if="phoneUI && view" class="status">
          <div class="timer-box glass">
            <TimerRing v-if="showTimer" :deadline="myTimer.deadline" :duration="myTimer.duration" :size="54" big />
            <div v-else class="idle"><b>{{ isMyTurn ? '...' : 'รอ' }}</b></div>
          </div>
          <div class="notify glass" aria-live="polite">
            <p class="turnline" :class="{ mine: isMyTurn }">{{ turnText }}</p>
            <p v-if="!notes.length" class="none">การแจ้งเตือน</p>
            <TransitionGroup name="note">
              <p v-for="n in notes.slice(0, 1)" :key="n.id" :class="n.type">{{ n.text }}</p>
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
            <span v-else-if="view.stage !== 'ended' && !isMyTurn" class="hint wait"><span class="dotty" /> รอ {{ nameOf(view.current) }}</span>
          </div>
        </section>

        <!-- มือถือ: ปุ่ม + ปุ่มลัดเปิดการ์ด -->
        <template v-if="phoneUI && view">
          <div class="actions glass">
            <template v-if="myTake">
              <button v-if="freeMode" type="button" class="btn act" :disabled="selection.length !== 3 || pending" @click="takeSelected">หยิบ {{ selection.length }}/3</button>
              <span v-else-if="!view.canPeek" class="hint">แตะลูกศร ▸ เพื่อหยิบ</span>
              <button v-if="view.canPeek" type="button" class="btn btn--sun act peek-btn" :disabled="pending" @click="peek">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                ดูบนสุด
              </button>
            </template>
            <template v-else-if="myBuild">
              <button type="button" class="btn act" @click="play('click'); modal.build = true">สร้าง ({{ view.buildOptions.length }})</button>
              <button type="button" class="btn btn--light act" :disabled="pending" @click="endBuild">จบตา</button>
            </template>
            <span v-else-if="myPeek" class="hint">ตัดสินใจการ์ด</span>
            <span v-else-if="view.stage !== 'ended' && !isMyTurn" class="hint wait"><span class="dotty" /> รอ {{ nameOf(view.current) }}</span>
          </div>
          <!-- ปุ่มเปิดลิ้นชักการ์ดของเรา -->
          <button type="button" class="cards-btn" :class="{ on: panel, glow: canBuildNow }" data-anchor="btn:cards" @click="toggleDrawer">
            <span class="fan" aria-hidden="true"><i /><i /><i /></span>
            <span class="lbl">การ์ดของฉัน</span>
            <span class="cnt">{{ cardTotal }}</span>
          </button>
        </template>
      </aside>

      <!-- มือถือ: ลิ้นชักการ์ดเลื่อนออกจากขวา (แท็บ 3 หมวด) · กางเองอัตโนมัติเมื่อควรดู -->
      <Transition name="drawer">
        <div v-if="phoneUI && panel && view" class="drawer-wrap" @click.self="togglePanel(panel)">
          <section class="drawer">
            <header class="dh">
              <nav class="tabs">
                <button v-for="k in ['acts', 'rights', 'built']" :key="k" type="button" :class="{ on: panel === k }" @click="play('click'); panel = k">
                  {{ TITLES[k] }} <b>{{ panelCount(k) }}</b>
                </button>
              </nav>
              <button type="button" class="dx" aria-label="ปิด" @click="togglePanel(panel)">
                <svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
              </button>
            </header>
            <div class="dbody">
              <MyCards single :sections="[panel]" :hand="view.hand" :built="myBuilt" @card="(id) => { play('click'); modal.card = id; }" />
            </div>
            <div v-if="myBuild" class="dfoot">
              <button type="button" class="btn act" @click="play('click'); modal.build = true">สร้างสิทธิ ({{ view.buildOptions.length }})</button>
              <button type="button" class="btn btn--light act" :disabled="pending" @click="endBuild">จบตา</button>
            </div>
          </section>
        </div>
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

    <BaseModal :open="Boolean(modal.card)" title="รายละเอียดการ์ด" width="40rem" @close="modal.card = null">
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
.stage { position: absolute; inset: 0; }
.stage :deep(canvas) { display: block; }

/* =========================================================
   เลย์เอาต์หลัก: 3 คอลัมน์ (ซ้าย | โต๊ะ | ขวา) — แผงโปร่งแสงโทนพาสเทล เห็นพื้นหลังทะลุ
   ========================================================= */
.game-page {
  --lw: clamp(210px, 17vw, 280px);   /* คอลัมน์ซ้าย */
  --rw: clamp(300px, 27vw, 440px);   /* คอลัมน์ขวา (ขั้นต่ำ) */
  --rwmax: 640px;
  --gap: 12px;
  --ink: #2f5a3a;
}
.game-page.is-phone {
  --lw: 58px;                       /* แถบรูปผู้เล่น (แคบ → โต๊ะกลางใหญ่ขึ้น) */
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
.idle small { font-size: 0.66rem; font-weight: 600; margin-top: 0.15rem; }
.notify { flex: 1; min-width: 0; min-height: 4.2rem; padding: 0.55rem 0.8rem; display: flex; flex-direction: column; justify-content: center; gap: 0.25rem; overflow: hidden; }
.notify p { margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--ink); line-height: 1.35; }
.notify p.ok { color: #2c7a44; }
.notify p.error { color: #b8433a; }
.notify p.old { font-size: 0.76rem; font-weight: 600; opacity: 0.55; }
.notify p.none { font-weight: 500; color: #8a9a8d; font-size: 0.85rem; text-align: center; }
.note-enter-active { transition: transform 0.35s var(--ease-back), opacity 0.25s; }
.note-enter-from { transform: translateY(-8px); opacity: 0; }
.note-leave-active { display: none; }
.note-move { transition: transform 0.3s; }

.players-box { flex: 1; min-height: 0; }

/* ---- เครื่องมือ (ขวาบน · เว้นที่ให้ปุ่มฟันเฟือง) ---- */
.tools { display: flex; justify-content: flex-end; align-items: center; gap: 0.4rem; min-height: 42px; padding-right: 50px; flex: none; }
.tool, .abil {
  height: 40px; min-width: 40px; border-radius: 999px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 3px; padding: 0 7px;
  background: rgba(255, 255, 255, 0.82); border: 1.5px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 3px 10px rgba(50, 90, 70, 0.14);
}
.tool svg { width: 21px; height: 21px; fill: none; stroke: var(--leaf); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.ab { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #eef0ec; }
.ab svg { width: 17px; height: 17px; fill: none; stroke: #b3bab0; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
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
.peek-btn { display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; animation: peek-pulse 1.3s ease-in-out infinite; }
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

/* ---- มือถือ: ปุ่มการ์ดของฉัน + ลิ้นชัก ---- */
.phase-mini {
  --a: #d9f5e1; --b: #b7e9c6; --t: #24603a;
  display: flex; flex-direction: column; align-items: center; line-height: 1; padding: 0.3rem 0 0.35rem; border-radius: 14px;
  background: linear-gradient(180deg, var(--a), var(--b)); color: var(--t);
  border: 2px solid rgba(255, 255, 255, 0.9); box-shadow: 0 3px 10px rgba(50, 90, 70, 0.14);
}
.phase-mini.p2 { --a: #fff0d9; --b: #ffd9a8; --t: #8a4f0e; }
.phase-mini.p3 { --a: #ffe3df; --b: #ffc2b8; --t: #9a2f25; }
.phase-mini small { font-size: 0.6rem; font-weight: 700; }
.phase-mini b { font-family: var(--font-head); font-size: 1.35rem; }
.turnline { font-size: 0.68rem !important; font-weight: 700; color: #3d5a45 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.turnline.mine { color: #8a5a00 !important; }
.cards-btn {
  margin-top: auto; position: relative; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
  padding: 0.45rem 0.8rem 0.45rem 0.55rem; border-radius: 16px;
  background: rgba(255, 255, 255, 0.9); border: 2px solid #fff; color: #2f5a3a;
  box-shadow: 0 4px 12px rgba(50, 90, 70, 0.18); font-weight: 700; font-size: 0.85rem;
  transition: transform 0.15s, background 0.2s;
}
.cards-btn.on { background: #4f7f5c; color: #fff; }
.cards-btn.glow { box-shadow: 0 0 0 3px rgba(108, 199, 136, 0.55), 0 4px 12px rgba(50, 90, 70, 0.18); animation: soft-pulse 1.6s ease-in-out infinite; }
.cards-btn:active { transform: scale(0.96); }
.fan { position: relative; width: 26px; height: 24px; flex: none; }
.fan i { position: absolute; bottom: 0; left: 8px; width: 13px; height: 19px; border-radius: 3px; background: #b7e0c3; border: 1.5px solid #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); transform-origin: 50% 100%; }
.fan i:nth-child(1) { transform: rotate(-22deg); background: #f7b6c8; }
.fan i:nth-child(2) { background: #a9cdef; }
.fan i:nth-child(3) { transform: rotate(22deg); background: #f6d88a; }
.cards-btn .lbl { flex: 1; text-align: left; }
.cards-btn .cnt {
  min-width: 22px; height: 22px; padding: 0 5px; border-radius: 999px; display: grid; place-items: center;
  font-size: 0.72rem; color: #fff; background: #e39a5a; border: 2px solid #fff;
}
.drawer-wrap {
  position: fixed; inset: 0; z-index: 70; pointer-events: auto;
  background: linear-gradient(90deg, rgba(30, 50, 40, 0.05), rgba(30, 50, 40, 0.28));
  display: flex; justify-content: flex-end;
  padding: calc(var(--safe-t) + 6px) calc(var(--safe-r) + 6px) calc(var(--safe-b) + 6px) 0;
}
.drawer {
  width: min(66vw, 560px); height: 100%; display: flex; flex-direction: column; overflow: hidden;
  background: rgba(255, 255, 255, 0.94); border: 2px solid #fff; border-radius: 20px;
  box-shadow: -8px 0 30px rgba(30, 60, 45, 0.25);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.dh { flex: none; display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 3.3rem 0.35rem 0.55rem; /* เว้นขวาให้ปุ่มฟันเฟือง */ border-bottom: 1.5px solid #e6efe4; }
.tabs { flex: 1; display: flex; gap: 0.3rem; min-width: 0; }
.tabs button {
  flex: 1; min-width: 0; padding: 0.35rem 0.3rem; border-radius: 12px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border: 0; background: #f0f5ee; color: #56655a; font-size: 0.74rem; font-weight: 700;
}
.tabs button b { margin-left: 0.15rem; padding: 0 0.35rem; border-radius: 999px; background: #fff; color: #4f7f5c; }
.tabs button.on { background: #4f7f5c; color: #fff; }
.tabs button.on b { color: #4f7f5c; }
.dx { flex: none; width: 32px; height: 32px; border-radius: 50%; border: 0; background: #f0f3ee; color: #56655a; display: grid; place-items: center; cursor: pointer; }
.dx svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
.dbody { flex: 1; min-height: 0; padding: 0.5rem 0.6rem 0.6rem; }
.dbody :deep(h4) { display: none; } /* ชื่อหมวดอยู่ในแท็บแล้ว */
.dfoot { flex: none; display: flex; justify-content: center; gap: 0.5rem; padding: 0.4rem; border-top: 1.5px solid #e6efe4; }
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.25s; }
.drawer-enter-active .drawer { transition: transform 0.35s var(--ease-out); }
.drawer-leave-active .drawer { transition: transform 0.25s ease-in; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(105%); }

/* ---- มือถือ: ขนาดเล็กลง ---- */
.is-phone .phase-pill { padding: 0.28rem 0.6rem; gap: 0.3rem; }
.is-phone .phase-pill b { font-size: 0.85rem; }
.is-phone .phase-pill small { font-size: 0.62rem; }
.is-phone .dots i { width: 5px; height: 5px; }
.is-phone .turn-pill { padding: 0.18rem 0.55rem 0.18rem 0.2rem; gap: 0.3rem; }
.is-phone .turn-pill .tt { font-size: 0.72rem; }
.is-phone .tools { min-height: 36px; padding-right: 46px; gap: 0.25rem; }
.is-phone .tool, .is-phone .abil { height: 32px; min-width: 32px; padding: 0 4px; gap: 2px; }
.is-phone .tool svg { width: 17px; height: 17px; }
.is-phone .ab { width: 19px; height: 19px; }
.is-phone .ab svg { width: 13px; height: 13px; }
.is-phone .timer-box { padding: 0.3rem; border-radius: 50%; }
.is-phone .idle { width: 54px; height: 54px; }
.is-phone .idle b { font-size: 1rem; }
.is-phone .notify { min-height: 0; padding: 0.35rem 0.5rem; border-radius: 14px; }
.is-phone .notify p { font-size: 0.66rem; }
.is-phone .pl { font-size: 0.62rem; padding: 0.1rem 0.45rem; }
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
