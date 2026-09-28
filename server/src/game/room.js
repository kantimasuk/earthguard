// ============================================================
// SinglePlayerRoom — ผู้ควบคุม "จังหวะ" ของเกม 1 ห้อง (ผู้เล่นจริง 1 คน + AI 2–4 ตัว)
// ============================================================
// เอนจินรู้แค่ "กติกา" ส่วนห้องนี้ดูแล
//   - เวลาตัดสินใจ 20 วินาที (หมดเวลา → ระบบเลือกค่าเริ่มต้นให้)
//   - ดีเลย์ของ AI (ประกาศก่อนว่าจะทำอะไร → รอ 5 วินาที → ทำจริง) ให้ผู้เล่นมองทัน
//   - รอให้ client เล่นแอนิเมชันเสร็จก่อนเริ่มนับเวลา (ไม่ให้เวลาหายไปกับแอนิเมชัน)
//   - เก็บ Game Log ทุกการกระทำ แล้วส่งให้ onEnd() บันทึกลงฐานข้อมูลตอนจบเกม
//
// ไฟล์นี้ไม่ import อะไรของ Node/Socket.IO/MySQL เลย → ใช้ได้ทั้งบนเซิร์ฟเวอร์และในเบราว์เซอร์ (ทดสอบ)
// การส่งข้อมูลทำผ่าน emit(type, payload) ที่ถูกส่งเข้ามา

import { STAGE, SmartAI, describe } from './engine/index.js';

export const DEFAULT_TIMING = {
  decisionMs: 20000,     // เวลาตัดสินใจของผู้เล่น (สเปก 5.6)
  aiActionMs: 5000,      // AI หยิบการ์ด/สร้างสิทธิ (สเปก 5.7: ดีเลย์ 5 วินาทีต่อการกระทำ)
  aiQuickMs: 2500,       // AI ใช้ความสามารถดูการ์ด
  aiCoinMs: 1500,        // AI คิดเรื่องเหรียญ (เลือกแบบลับ ไม่ต้องรอนาน)
  fastFactor: 0.4,       // โหมด "AI เล่นเร็ว"
  readyTimeoutMs: 15000, // รอ client เล่นแอนิเมชันนานสุด
};

export const AI_PROFILES = [
  { name: 'ใบเตย', avatar: 'leaf' },
  { name: 'ธารา', avatar: 'water' },
  { name: 'ภูผา', avatar: 'mountain' },
  { name: 'พายุ', avatar: 'wind' },
];

export class SinglePlayerRoom {
  /**
   * @param {object} o
   * @param {import('./engine/engine.js').Engine} o.engine
   * @param {string} o.sessionId
   * @param {{id:string, name:string, avatar?:string}} o.human
   * @param {number} o.aiCount 2–4
   * @param {number} o.seed
   * @param {(type:string, payload:object)=>void} o.emit   ส่งข้อมูลไปหาผู้เล่น
   * @param {(summary:object)=>Promise<void>|void} [o.onEnd] บันทึกผลเมื่อจบเกม
   */
  constructor({ engine, sessionId, human, aiCount, seed, emit, onEnd, timing = {}, now = () => Date.now() }) {
    this.E = engine;
    this.sessionId = sessionId;
    this.human = human;
    this.aiCount = Math.max(2, Math.min(4, aiCount | 0));
    this.seed = seed;
    this.emit = emit;
    this.onEnd = onEnd;
    this.T = { ...DEFAULT_TIMING, ...timing };
    this.now = now;
    this.ai = new SmartAI(engine);
    this.fast = false;

    this.state = null;
    this.updateSeq = 0;
    this.awaitSeq = null;
    this.readyTimer = null;
    this.actTimer = null;      // ตัวจับเวลาของผู้เล่น (หมดเวลา → auto)
    this.aiTimer = null;       // ดีเลย์ของ AI
    this.timer = null;         // { key, player, stage, deadline, duration } ส่งให้ client แสดงวงกลมนับถอยหลัง
    this.logEntries = [];      // log ทั้งหมด (บันทึกลงฐานข้อมูลตอนจบ)
    this.publicLog = [];       // ข้อความที่แสดงระหว่างเกม (เฉพาะข้อมูลสาธารณะ)
    this.ended = false;
    this.destroyed = false;
  }

  // ------------------------------------------------------------------
  start() {
    const players = [
      { id: this.human.id, name: this.human.name, isAI: false, avatar: this.human.avatar || null },
      ...AI_PROFILES.slice(0, this.aiCount).map((p, i) => ({ id: `ai${i + 1}`, name: p.name, isAI: true, avatar: p.avatar })),
    ];
    const { state, events } = this.E.createGame({ players, seed: this.seed });
    this.state = state;
    this.#commit(events);
  }

  /** ข้อมูลเริ่มต้นเมื่อผู้เล่นเชื่อมต่อ (หรือเชื่อมต่อใหม่) */
  snapshot() {
    return { seq: this.updateSeq, view: this.view(), serverNow: this.now() };
  }

  view() {
    const v = this.E.viewFor(this.state, this.human.id);
    v.timer = this.timer;
    v.log = this.publicLog.slice(-40);
    v.aiFast = this.fast;
    return v;
  }

  setFast(fast) { this.fast = Boolean(fast); }

  /** client เล่นแอนิเมชันของอัปเดต seq เสร็จแล้ว */
  ready(seq) {
    if (this.awaitSeq !== null && seq >= this.awaitSeq) this.#onReady();
  }

  /** การกระทำของผู้เล่นจริง */
  handleAction(action) {
    if (this.ended || this.destroyed || !this.state) return { ok: false, error: 'GAME_ENDED' };
    const r = this.E.act(this.state, this.human.id, action);
    if (!r.ok) return r;
    this.#commit(r.events);
    return { ok: true };
  }

  destroy() {
    this.destroyed = true;
    this.#clearTimers();
    clearTimeout(this.readyTimer);
  }

  // ------------------------------------------------------------------
  // ภายใน
  // ------------------------------------------------------------------
  #nameOf = (id) => this.state.players.find((p) => p.id === id)?.name || id;
  #seatOf = (id) => {
    const i = this.state.players.findIndex((p) => p.id === id);
    return i >= 0 ? i : null;
  };

  #commit(events) {
    if (this.destroyed) return;
    const s = this.state;
    for (const e of events) {
      const isPublic = !e.to && e.type !== 'coinChosen';
      const text = describe(e, this.E.C, this.#nameOf, { reveal: true });
      const { type, ...payload } = e;
      this.logEntries.push({
        seq: this.logEntries.length + 1,
        turnNo: s.turnNo,
        phase: s.phase,
        actorSeat: e.player ? this.#seatOf(e.player) : null,
        action: type,
        payload: { ...payload, text },
        isPublic,
        isAuto: Boolean(e.auto),
        at: this.now(),
      });
      if (isPublic) {
        const pub = describe(e, this.E.C, this.#nameOf);
        if (pub) this.publicLog.push({ n: this.logEntries.length, text: pub, type });
      }
    }

    // สถานะเปลี่ยน → ยกเลิกตัวจับเวลาเดิม (ถ้าขั้นตอนเปลี่ยนไปแล้ว)
    if (this.timer && this.timer.key !== this.#stageKey()) {
      this.timer = null;
      clearTimeout(this.actTimer);
    }

    this.updateSeq++;
    this.emit('sp:update', {
      seq: this.updateSeq,
      events: this.E.eventsFor(events, this.human.id),
      view: this.view(),
      serverNow: this.now(),
    });

    if (s.stage === STAGE.ENDED) {
      this.#finish();
      return;
    }
    // รอ client เล่นแอนิเมชันเสร็จ แล้วค่อยเดินเกมต่อ
    this.awaitSeq = this.updateSeq;
    clearTimeout(this.readyTimer);
    this.readyTimer = setTimeout(() => this.#onReady(), this.T.readyTimeoutMs);
  }

  #onReady() {
    clearTimeout(this.readyTimer);
    this.awaitSeq = null;
    this.#schedule();
  }

  #stageKey() {
    const s = this.state;
    return `${s.turnNo}|${s.stage}|${s.threat ? s.threat.card : ''}`;
  }

  #clearTimers() {
    clearTimeout(this.actTimer);
    clearTimeout(this.aiTimer);
    this.actTimer = null;
    this.aiTimer = null;
  }

  /** ใครต้องทำอะไรต่อ → ตั้งเวลา/สั่ง AI */
  #schedule() {
    if (this.ended || this.destroyed) return;
    const s = this.state;
    clearTimeout(this.aiTimer);
    const k = this.#stageKey();
    const scale = this.fast ? this.T.fastFactor : 1;

    if (s.stage === STAGE.COINS) {
      const t = s.threat;
      const pendingAI = t.unsafe.filter((id) => id !== this.human.id && !(id in t.choices));
      const humanPending = t.unsafe.includes(this.human.id) && !(this.human.id in t.choices);
      if (humanPending) this.#startHumanTimer(k);
      if (pendingAI.length) {
        this.aiTimer = setTimeout(() => {
          if (this.#stageKey() !== k || this.destroyed) return;
          const events = [];
          for (const id of pendingAI) {
            const a = this.ai.decide(this.state, id) || { type: 'coin', use: false };
            const r = this.E.act(this.state, id, a);
            if (r.ok) events.push(...r.events);
          }
          this.#commit(events);
        }, this.T.aiCoinMs * scale);
      }
      return;
    }

    const cur = this.E.current(s);
    if (cur.id === this.human.id) {
      this.#startHumanTimer(k);
      return;
    }

    // ---- ตาของ AI: บอกก่อนว่าจะทำอะไร (ไฮไลต์ค้างไว้) แล้วค่อยทำ ----
    const action = this.ai.decide(s, cur.id) || this.E.autoAction(s, cur.id);
    const quick = action.type === 'peek' || action.type === 'peekDecide' || action.type === 'endBuild';
    const delay = (quick ? this.T.aiQuickMs : this.T.aiActionMs) * scale;
    this.emit('sp:intent', {
      player: cur.id,
      action: action.type === 'build'
        ? { type: 'build', right: action.right } // ไม่บอกล่วงหน้าว่าจะทิ้งใบไหน
        : action.type === 'peekDecide' ? { type: 'peekDecide' } : action,
      delay,
      serverNow: this.now(),
    });
    this.aiTimer = setTimeout(() => {
      if (this.#stageKey() !== k || this.destroyed) return;
      let r = this.E.act(this.state, cur.id, action);
      if (!r.ok) r = this.E.act(this.state, cur.id, this.E.autoAction(this.state, cur.id), { auto: true });
      if (r.ok) this.#commit(r.events);
    }, delay);
  }

  #startHumanTimer(key) {
    if (this.timer && this.timer.key === key) return; // ตั้งไว้แล้ว (ไม่รีเซ็ตเวลา)
    const s = this.state;
    const deadline = this.now() + this.T.decisionMs;
    this.timer = {
      key,
      player: this.human.id,
      stage: s.stage,
      deadline,
      duration: this.T.decisionMs,
    };
    clearTimeout(this.actTimer);
    this.actTimer = setTimeout(() => this.#onTimeout(key), this.T.decisionMs + 250);
    this.emit('sp:timer', { ...this.timer, serverNow: this.now() });
  }

  #onTimeout(key) {
    if (this.#stageKey() !== key || this.ended || this.destroyed) return;
    const a = this.E.autoAction(this.state, this.human.id);
    if (!a) return;
    const r = this.E.act(this.state, this.human.id, a, { auto: true });
    this.timer = null;
    if (r.ok) this.#commit(r.events);
  }

  async #finish() {
    this.ended = true;
    this.#clearTimers();
    this.timer = null;
    const s = this.state;
    const result = s.result;
    const summary = {
      sessionId: this.sessionId,
      result,
      players: s.players.map((p, seat) => {
        const row = result.rows.find((r) => r.id === p.id);
        return {
          seat,
          id: p.id,
          isAI: p.isAI,
          name: p.name,
          ...row,
        };
      }),
      log: this.logEntries,
    };
    try {
      await this.onEnd?.(summary);
      this.emit('sp:saved', { ok: true });
    } catch (e) {
      console.error('[room] save failed', e);
      this.emit('sp:saved', { ok: false });
    }
  }
}
