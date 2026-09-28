// ============================================================
// EarthGuard Game Engine — กติกาและสถานะเกมทั้งหมด (ไม่ผูกกับ UI/เครือข่าย/ฐานข้อมูล)
// ============================================================
// หลักการ
//   - state เป็น JSON ธรรมดา (ไม่มี class/function ข้างใน) → ส่ง/บันทึก/โคลนได้
//   - ทุกการกระทำผ่าน act(state, playerId, action) → ตรวจกติกา → แก้ state → คืน "events"
//   - events คือสิ่งที่เกิดขึ้นตามลำดับ (หยิบการ์ด เปิดการ์ด ภัยคุกคาม ...) ใช้ทำแอนิเมชัน + บันทึก log
//   - event ที่มี `to` เป็นข้อมูลลับ ส่งให้ผู้เล่นคนนั้นคนเดียว
//   - viewFor(state, playerId) ตัดข้อมูลลับออก (มือคนอื่น เหรียญคนอื่น การ์ดที่แอบดู)
//   - เวลา/ดีเลย์/AI ไม่อยู่ในนี้ → อยู่ใน room.js (ผู้ควบคุมจังหวะเกม)
//
// ใช้ซ้ำได้ทั้ง Single Player (ตอนนี้) และ Multiplayer (ภายหลัง) โดยไม่ต้องแก้

import { random, randInt, shuffle } from './rng.js';
import {
  toMatrix, canBuild, suggestCells, cellsToCardIds, validDiscards,
} from './analysis.js';

export const STAGE = {
  TAKE: 'take',     // เลือกหยิบการ์ดจากกองกลาง
  PEEK: 'peek',     // กำลังดูการ์ดบนสุด (ความสามารถ INF)
  BUILD: 'build',   // สร้างสิทธิ (ถ้าทำได้)
  COINS: 'coins',   // ภัยคุกคาม: รอผู้เล่นที่ยังไม่ปลอดภัยเลือกใช้เหรียญ
  ENDED: 'ended',
};

// กองกลาง 3×3 (ช่อง 0-8 เรียงซ้าย→ขวา บน→ล่าง) และแถวที่หยิบได้ 6 แบบ
export const LINES = {
  r0: [0, 1, 2], r1: [3, 4, 5], r2: [6, 7, 8],
  c0: [0, 3, 6], c1: [1, 4, 7], c2: [2, 5, 8],
};
export const LINE_TH = {
  r0: 'แถวบน', r1: 'แถวกลาง', r2: 'แถวล่าง',
  c0: 'คอลัมน์ซ้าย', c1: 'คอลัมน์กลาง', c2: 'คอลัมน์ขวา',
};

export const START_COINS = 2;
export const BONUS_PROTECT = 2; // ป้องกันครบ 2 ครั้ง → โบนัส +1

const err = (code) => ({ ok: false, error: code, events: [] });

export class Engine {
  /** @param {{cards: Record<string, object>}} catalog จาก buildCatalog() */
  constructor(catalog) {
    this.catalog = catalog;
    this.C = catalog.cards;
  }

  // ------------------------------------------------------------------
  // สร้างเกมใหม่
  // ------------------------------------------------------------------
  /**
   * @param {{ players: {id:string, name:string, isAI:boolean, avatar?:string}[], seed:number }} opts
   */
  createGame({ players, seed }) {
    const C = this.C;
    const s = {
      v: 1,
      seed,
      rng: seed >>> 0,
      players: [],
      turn: 0,
      turnNo: 1,
      phase: 1,
      piles: { 1: [], 2: [], 3: [] }, // ใบบนสุด = ท้าย array
      market: Array(9).fill(null),
      publicRights: [],
      discard: [],
      removed: [],               // ภัยคุกคามที่จัดการแล้ว + การ์ดจบเกม
      abilities: { INF: false, PAR: false, JUS: false },
      stage: STAGE.TAKE,
      peek: { used: false, by: null, card: null },
      threat: null,
      result: null,
      coinsRemoved: 0,
    };
    const events = [];

    // สุ่มลำดับตาครั้งเดียว ใช้ไปจนจบเกม
    const order = shuffle(s, players);
    s.players = order.map((p) => ({
      id: p.id, name: p.name, isAI: Boolean(p.isAI), avatar: p.avatar || null,
      hand: [], built: [], coins: START_COINS,
    }));

    // ---- จัดกองจั่ว 3 ช่วง ----
    const ids = (type) => Object.values(C).filter((c) => c.type === type).map((c) => c.id);
    const acts = shuffle(s, ids('activity'));
    const rights = shuffle(s, ids('right'));
    const threats = shuffle(s, ids('threat'));
    const endCard = ids('end')[0];

    s.piles[1] = shuffle(s, [...acts.slice(0, 18), ...rights.slice(0, 9)]);
    s.piles[2] = shuffle(s, [...acts.slice(18, 36), ...rights.slice(9, 18), ...threats.slice(0, 4)]);
    const p3 = shuffle(s, [...acts.slice(36, 54), ...threats.slice(4, 8)]);
    p3.splice(randInt(s, p3.length + 1), 0, endCard); // การ์ดจบเกมอยู่ตำแหน่งสุ่มในกอง 3
    s.piles[3] = p3;

    events.push({
      type: 'setup',
      order: s.players.map((p) => p.id),
      piles: { 1: s.piles[1].length, 2: s.piles[2].length, 3: s.piles[3].length },
    });

    // ---- เปิดกองกลาง 9 ใบ ----
    for (let slot = 0; slot < 9; slot++) {
      const card = s.piles[1].pop();
      s.market[slot] = card;
      events.push({ type: 'deal', slot, card });
    }
    events.push({ type: 'coins', amount: START_COINS });
    events.push({ type: 'turn', player: s.players[0].id, turnNo: 1 });
    return { state: s, events };
  }

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------
  current(s) { return s.players[s.turn]; }
  player(s, id) { return s.players.find((p) => p.id === id); }

  /** แถวที่หยิบได้ตอนนี้ (ทุกช่องต้องมีการ์ด) */
  legalLines(s) {
    return Object.keys(LINES).filter((k) => LINES[k].every((i) => s.market[i]));
  }

  /** การ์ดใบบนสุดของกองจั่ว (ใบที่จะถูกเปิดต่อไป) + กองที่อยู่ */
  topCard(s) {
    for (let ph = s.phase; ph <= 3; ph++) {
      const pile = s.piles[ph];
      if (pile.length) return { card: pile[pile.length - 1], phase: ph };
    }
    return null;
  }

  /** ค่าของสิทธิแต่ละใบในการเลือกทิ้ง (คะแนน) */
  rightValue(r) { return r.points; }

  /**
   * สิทธิที่ผู้เล่นสร้างได้ตอนนี้ พร้อมชุดการ์ดที่ระบบแนะนำให้ทิ้ง
   * @returns {{ right:string, from:'hand'|'public', discards:string[] }[]}
   */
  buildOptions(s, playerId) {
    const C = this.C;
    const p = this.player(s, playerId);
    if (!p) return [];
    const m = toMatrix(p.hand, C);
    const cands = [
      ...p.hand.filter((id) => C[id].type === 'right').map((id) => ({ id, from: 'hand' })),
      ...s.publicRights.map((id) => ({ id, from: 'public' })),
    ];
    const seen = new Set();
    const out = [];
    for (const cand of cands) {
      const r = C[cand.id];
      const k = `${r.key}|${cand.from}`;
      if (seen.has(k) || !canBuild(r, m)) continue;
      seen.add(k);
      const others = cands.filter((o) => o.id !== cand.id).map((o) => C[o.id]);
      const cells = suggestCells(r, m, others, (x) => this.rightValue(x));
      const discards = cells && cellsToCardIds(cells, p.hand, C);
      if (discards) out.push({ right: cand.id, from: cand.from, discards });
    }
    return out;
  }

  // ------------------------------------------------------------------
  // การกระทำของผู้เล่น
  // ------------------------------------------------------------------
  /**
   * @param {object} s        state (ถูกแก้ไขโดยตรง)
   * @param {string} playerId
   * @param {object} a        { type:'take', line } | { type:'take', slots:[..3] } | { type:'peek' }
   *                          | { type:'peekDecide', bottom:boolean } | { type:'build', right, discards? }
   *                          | { type:'endBuild' } | { type:'coin', use:boolean }
   * @param {{auto?:boolean}} opt  auto = ระบบทำแทนเพราะหมดเวลา
   */
  act(s, playerId, a, opt = {}) {
    if (!a || typeof a.type !== 'string') return err('BAD_ACTION');
    if (s.stage === STAGE.ENDED) return err('GAME_ENDED');
    const auto = Boolean(opt.auto);
    const events = [];

    if (a.type === 'coin') return this.#coin(s, playerId, a, auto, events);

    const cur = this.current(s);
    if (cur.id !== playerId) return err('NOT_YOUR_TURN');

    switch (a.type) {
      case 'take': return this.#take(s, cur, a, auto, events);
      case 'peek': return this.#peek(s, cur, events);
      case 'peekDecide': return this.#peekDecide(s, cur, a, auto, events);
      case 'build': return this.#build(s, cur, a, auto, events);
      case 'endBuild':
        if (s.stage !== STAGE.BUILD) return err('WRONG_STAGE');
        events.push({ type: 'endBuild', player: cur.id, auto });
        this.#endTurn(s, events);
        return { ok: true, events };
      default:
        return err('BAD_ACTION');
    }
  }

  /** การกระทำเริ่มต้นเมื่อหมดเวลา (ตามสเปก 5.6) */
  autoAction(s, playerId) {
    if (s.stage === STAGE.TAKE) {
      const lines = this.legalLines(s);
      return { type: 'take', line: lines[randInt(s, lines.length)] }; // สุ่มหยิบแถวที่ถูกกติกา
    }
    if (s.stage === STAGE.PEEK) return { type: 'peekDecide', bottom: false }; // วางไว้ที่เดิม
    if (s.stage === STAGE.BUILD) return { type: 'endBuild' };                 // ไม่สร้าง
    if (s.stage === STAGE.COINS) return { type: 'coin', use: false };         // ไม่ใช้เหรียญ
    return null;
  }

  #take(s, p, a, auto, events) {
    if (s.stage !== STAGE.TAKE) return err('WRONG_STAGE');
    let slots;
    let line = null;
    if (a.line && LINES[a.line]) {
      slots = LINES[a.line];
      line = a.line;
    } else if (Array.isArray(a.slots)) {
      // หยิบ 3 ใบตำแหน่งใดก็ได้ ต้องปลดล็อก "สิทธิในการมีส่วนร่วม" ก่อน
      if (!s.abilities.PAR) return err('NEED_PARTICIPATION');
      slots = [...new Set(a.slots.map(Number))];
      if (slots.length !== 3 || slots.some((i) => !(i >= 0 && i < 9))) return err('BAD_SLOTS');
    } else {
      return err('BAD_SLOTS');
    }
    if (slots.some((i) => !s.market[i])) return err('EMPTY_SLOT');

    const cards = slots.map((i) => s.market[i]);
    slots.forEach((i) => { s.market[i] = null; });
    p.hand.push(...cards);
    events.push({ type: 'take', player: p.id, line, slots, cards, auto });

    if (this.buildOptions(s, p.id).length) {
      s.stage = STAGE.BUILD;
      events.push({ type: 'buildStage', player: p.id });
    } else {
      this.#endTurn(s, events);
    }
    return { ok: true, events };
  }

  #peek(s, p, events) {
    if (s.stage !== STAGE.TAKE) return err('WRONG_STAGE');
    if (!s.abilities.INF) return err('NEED_INFORMATION');
    if (s.peek.used) return err('ALREADY_PEEKED');
    const top = this.topCard(s);
    if (!top) return err('EMPTY_DECK');
    s.stage = STAGE.PEEK;
    s.peek = { used: true, by: p.id, card: top.card, phase: top.phase };
    events.push({ type: 'peekStart', player: p.id });
    events.push({ type: 'peekCard', player: p.id, card: top.card, to: p.id }); // ลับ: เห็นคนเดียว
    return { ok: true, events };
  }

  #peekDecide(s, p, a, auto, events) {
    if (s.stage !== STAGE.PEEK) return err('WRONG_STAGE');
    const bottom = Boolean(a.bottom);
    if (bottom) {
      const pile = s.piles[s.peek.phase];
      const card = pile.pop();
      pile.unshift(card);
    }
    events.push({ type: 'peekDone', player: p.id, bottom, auto });
    s.peek = { used: true, by: null, card: null };
    s.stage = STAGE.TAKE;
    return { ok: true, events };
  }

  #build(s, p, a, auto, events) {
    if (s.stage !== STAGE.BUILD) return err('WRONG_STAGE');
    const C = this.C;
    const right = C[a.right];
    if (!right || right.type !== 'right') return err('BAD_RIGHT');
    let from;
    if (p.hand.includes(right.id)) from = 'hand';
    else if (s.publicRights.includes(right.id)) from = 'public';
    else return err('RIGHT_NOT_AVAILABLE');

    let discards = a.discards;
    if (!discards) {
      const opt = this.buildOptions(s, p.id).find((o) => o.right === right.id)
        || this.buildOptions(s, p.id).find((o) => C[o.right].key === right.key && o.from === from);
      discards = opt?.discards;
    }
    if (!discards || !validDiscards(right, discards, p.hand, C)) return err('BAD_DISCARDS');

    // ทิ้งการ์ดกิจกรรม → กองทิ้ง, การ์ดสิทธิ → วางหน้าผู้เล่น
    p.hand = p.hand.filter((id) => !discards.includes(id));
    s.discard.push(...discards);
    if (from === 'hand') p.hand = p.hand.filter((id) => id !== right.id);
    else s.publicRights = s.publicRights.filter((id) => id !== right.id);
    p.built.push({ card: right.id, protects: 0 });
    events.push({ type: 'build', player: p.id, right: right.id, from, discards, auto });

    if (right.kind === 'procedural' && !s.abilities[right.key]) {
      s.abilities[right.key] = true;
      events.push({ type: 'unlock', ability: right.key, player: p.id });
    }

    if (!this.buildOptions(s, p.id).length) this.#endTurn(s, events);
    return { ok: true, events };
  }

  #coin(s, playerId, a, auto, events) {
    if (s.stage !== STAGE.COINS || !s.threat) return err('WRONG_STAGE');
    const t = s.threat;
    if (!t.unsafe.includes(playerId)) return err('NOT_AT_RISK');
    if (playerId in t.choices) return err('ALREADY_CHOSEN');
    const p = this.player(s, playerId);
    t.choices[playerId] = Boolean(a.use) && p.coins > 0; // ไม่มีเหรียญ → นับเป็น "ไม่ใช้"
    events.push({ type: 'coinChosen', player: playerId, auto }); // ไม่บอกว่าเลือกอะไร (เปิดพร้อมกันทีหลัง)
    if (t.unsafe.every((id) => id in t.choices)) this.#resolveCoins(s, events);
    return { ok: true, events };
  }

  // ------------------------------------------------------------------
  // จบตา → เติมกองกลาง (อาจเจอภัยคุกคาม/การ์ดจบเกม) → ตาถัดไป
  // ------------------------------------------------------------------
  #endTurn(s, events) {
    events.push({ type: 'endTurn', player: this.current(s).id });
    s.stage = 'refill';
    this.#refill(s, events);
  }

  #draw(s, events) {
    while (s.phase <= 3 && !s.piles[s.phase].length) {
      if (s.phase === 3) return null;
      s.phase++;
      events.push({ type: 'phase', phase: s.phase });
    }
    return s.piles[s.phase].pop();
  }

  /** กองช่วงนี้หมดแล้ว → เข้าช่วงถัดไปทันที (แถบบอกช่วงจะได้ตรง) */
  #checkPhase(s, events) {
    if (!s.piles[s.phase].length && s.phase < 3) {
      s.phase++;
      events.push({ type: 'phase', phase: s.phase });
    }
  }

  #refill(s, events) {
    const C = this.C;
    for (;;) {
      const slot = s.market.indexOf(null);
      if (slot === -1) break;
      const card = this.#draw(s, events);
      if (!card) break;
      const c = C[card];
      if (c.type === 'end') {
        s.removed.push(card);
        this.#endGame(s, card, events);
        return;
      }
      if (c.type === 'threat') {
        // จัดการภัยคุกคาม: ถ้าต้องรอผู้เล่นเลือกเหรียญจะหยุดที่นี่
        // เมื่อจัดการเสร็จ #finishThreat จะเรียก #refill ต่อเอง → จึง return ออกจากรอบนี้เสมอ
        this.#startThreat(s, card, events);
        return;
      }
      s.market[slot] = card;
      events.push({ type: 'draw', slot, card, phase: s.phase });
      this.#checkPhase(s, events);
    }
    // ครบ 9 ใบ → ส่งตาให้ผู้เล่นคนถัดไป
    s.turn = (s.turn + 1) % s.players.length;
    s.turnNo++;
    s.stage = STAGE.TAKE;
    s.peek = { used: false, by: null, card: null };
    events.push({ type: 'turn', player: this.current(s).id, turnNo: s.turnNo });
  }

  // ------------------------------------------------------------------
  // ภัยคุกคาม
  // ------------------------------------------------------------------
  #startThreat(s, cardId, events) {
    const C = this.C;
    const threat = C[cardId];
    const t = { card: cardId, safe: {}, unsafe: [], choices: {} };
    events.push({ type: 'threat', card: cardId });

    for (const p of s.players) {
      // ขั้นที่ 1: ป้องกันด้วยการ์ดสิทธิที่สร้างแล้ว
      const match = p.built.filter((b) => threat.protectedBy.includes(C[b.card].key));
      if (match.length) {
        t.safe[p.id] = 'right';
        const subs = match.filter((b) => C[b.card].kind === 'substantive');
        let counted = null;
        if (subs.length) {
          // ถ้ามีหลายใบ ให้ใบที่ใกล้ได้โบนัสที่สุดนับ +1 (เป็นประโยชน์กับผู้เล่นที่สุด)
          counted = subs.find((b) => b.protects === BONUS_PROTECT - 1)
            || subs.reduce((a, b) => (b.protects < a.protects ? b : a));
          counted.protects++;
        }
        events.push({
          type: 'protect', player: p.id, reason: 'right',
          card: (counted || match[0]).card, protects: counted ? counted.protects : null,
        });
      } else if (s.abilities.JUS && p.hand.length <= 2) {
        // สิทธิในการเข้าถึงความยุติธรรม: การ์ดในมือ ≤ 2 ใบ → ปลอดภัย
        t.safe[p.id] = 'justice';
        events.push({ type: 'protect', player: p.id, reason: 'justice' });
      } else {
        t.unsafe.push(p.id);
      }
    }
    s.threat = t;
    if (t.unsafe.length) {
      s.stage = STAGE.COINS;
      events.push({ type: 'coinsStart', card: cardId, unsafe: t.unsafe.slice() });
    } else {
      this.#finishThreat(s, events, []);
    }
  }

  #resolveCoins(s, events) {
    const t = s.threat;
    const users = t.unsafe.filter((id) => t.choices[id]);
    const success = users.length > 1; // รวมกลุ่มสำเร็จ: ใช้เหรียญมากกว่า 1 คน
    if (success) {
      for (const id of users) {
        this.player(s, id).coins--;
        s.coinsRemoved++;
      }
    }
    events.push({
      type: 'coinReveal',
      choices: Object.fromEntries(t.unsafe.map((id) => [id, Boolean(t.choices[id])])),
      success,
      protected: success ? users : [],
    });
    const losers = t.unsafe.filter((id) => !(success && users.includes(id)));
    this.#finishThreat(s, events, losers);
  }

  #finishThreat(s, events, losers) {
    const C = this.C;
    const threat = C[s.threat.card];
    // ขั้นที่ 3: ผู้เล่นที่ไม่ได้รับการป้องกัน ถูกสุ่มทิ้งการ์ด
    for (const id of losers) {
      const p = this.player(s, id);
      const n = Math.min(threat.discardCount, p.hand.length);
      const lost = [];
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(random(s) * p.hand.length);
        lost.push(p.hand.splice(idx, 1)[0]);
      }
      const toPublic = lost.filter((c) => C[c].type === 'right');
      s.publicRights.push(...toPublic);
      s.discard.push(...lost.filter((c) => C[c].type !== 'right'));
      events.push({ type: 'lose', player: id, cards: lost, toPublic, need: threat.discardCount });
    }
    // ขั้นที่ 4: นำภัยคุกคามออก แล้วเติมกองกลางต่อ
    s.removed.push(s.threat.card);
    events.push({ type: 'threatEnd', card: s.threat.card });
    s.threat = null;
    s.stage = 'refill';
    this.#refill(s, events);
  }

  // ------------------------------------------------------------------
  // จบเกม + นับคะแนน
  // ------------------------------------------------------------------
  #endGame(s, cardId, events) {
    s.stage = STAGE.ENDED;
    s.result = this.scores(s);
    events.push({ type: 'end', card: cardId, result: s.result });
  }

  /** ตารางคะแนน + อันดับ (ใช้ได้ทุกเวลา เช่นดูคะแนนระหว่างเกม) */
  scores(s) {
    const C = this.C;
    const rows = s.players.map((p) => {
      let rightsPoints = 0;
      let bonus = 0;
      let protectCount = 0;
      for (const b of p.built) {
        const r = C[b.card];
        rightsPoints += r.points;
        if (r.kind === 'substantive') {
          protectCount += b.protects;
          if (b.protects >= BONUS_PROTECT) bonus++;
        }
      }
      const coinPenalty = p.coins;
      return {
        id: p.id, name: p.name, isAI: p.isAI,
        rightsPoints, bonus, coinPenalty, cardsLeft: p.hand.length, protectCount,
        builtCount: p.built.length,
        total: rightsPoints + bonus - coinPenalty,
      };
    });
    // เรียง: คะแนนรวม → จำนวนครั้งที่ป้องกันได้ (เสมอกันทั้งคู่ = ชนะร่วม)
    rows.sort((a, b) => b.total - a.total || b.protectCount - a.protectCount);
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      r.rank = prev && prev.total === r.total && prev.protectCount === r.protectCount ? prev.rank : i + 1;
    });
    return { rows, winners: rows.filter((r) => r.rank === 1).map((r) => r.id) };
  }

  // ------------------------------------------------------------------
  // มุมมองของผู้เล่นแต่ละคน (ตัดข้อมูลลับออก)
  // ------------------------------------------------------------------
  viewFor(s, viewer) {
    const cur = this.current(s);
    const me = this.player(s, viewer);
    const myTurn = cur.id === viewer;
    const t = s.threat;
    return {
      turnNo: s.turnNo,
      phase: s.phase,
      stage: s.stage,
      current: cur.id,
      piles: { 1: s.piles[1].length, 2: s.piles[2].length, 3: s.piles[3].length },
      deckLeft: s.piles[s.phase].length,
      market: s.market.slice(),
      publicRights: s.publicRights.slice(),
      discardCount: s.discard.length,
      discardTop: s.discard[s.discard.length - 1] || null,
      abilities: { ...s.abilities },
      players: s.players.map((p) => ({
        id: p.id,
        name: p.name,
        isAI: p.isAI,
        avatar: p.avatar,
        handCount: p.hand.length,
        built: p.built.map((b) => ({ ...b })),
        coins: p.id === viewer ? p.coins : null, // ไม่เห็นเหรียญของคนอื่น
      })),
      me: viewer,
      hand: me ? me.hand.slice() : [],
      coins: me ? me.coins : 0,
      takeMode: s.abilities.PAR ? 'free' : 'line',
      legalLines: myTurn && s.stage === STAGE.TAKE ? this.legalLines(s) : [],
      canPeek: myTurn && s.stage === STAGE.TAKE && s.abilities.INF && !s.peek.used && Boolean(this.topCard(s)),
      peek: s.stage === STAGE.PEEK
        ? { by: s.peek.by, card: s.peek.by === viewer ? s.peek.card : null }
        : null,
      buildOptions: myTurn && s.stage === STAGE.BUILD ? this.buildOptions(s, viewer) : [],
      threat: t
        ? {
          card: t.card,
          safe: { ...t.safe },
          unsafe: t.unsafe.slice(),
          chosen: Object.keys(t.choices),
          myChoice: viewer in t.choices ? t.choices[viewer] : null,
        }
        : null,
      result: s.result,
    };
  }

  /** เลือกเฉพาะ event ที่ผู้เล่นคนนี้ควรเห็น */
  eventsFor(events, viewer) {
    return events.filter((e) => !e.to || e.to === viewer);
  }
}
