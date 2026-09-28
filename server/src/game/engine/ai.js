// ============================================================
// ผู้เล่น AI (rule-based + ประเมินค่าแบบมองล่วงหน้า 1 ตา)
// ============================================================
// ลำดับความสำคัญตามสเปก 5.7 แต่ "คิด" ให้ฉลาดขึ้นในแต่ละข้อ:
//   1) สร้างสิทธิได้ → สร้างทันที  (ค้นหาชุดที่ได้ค่ารวมสูงสุด ไม่ใช่แค่ใบแรกที่เจอ)
//   2) หยิบแถวที่ทำให้เข้าใกล้การสร้างสิทธิมากที่สุด  (จำลองทุกแถว → ประเมินมือหลังหยิบ)
//   3) ใช้เหรียญเมื่อยังมีเหรียญ และไม่มีสิทธิที่ป้องกันตัวเองได้
//
// สิ่งที่ AI "รู้" = ข้อมูลที่ผู้เล่นจริงรู้ได้เท่านั้น (ไม่แอบดูลำดับกองจั่ว/มือคนอื่น)
//   - ภัยคุกคามใบไหนยังไม่ออก (นับการ์ด) → ให้ค่าสิทธิที่ป้องกันภัยที่เหลือได้สูงขึ้น
//   - ช่วงของเกม → ช่วงท้ายให้ค่ากับ "สร้างได้เลย" มากกว่า "สะสมไว้"
//   - คะแนนบนโต๊ะของคู่แข่ง → ใช้ตัดสินใจตอนแอบดูการ์ดจบเกม

import { randInt, random } from './rng.js';
import { STAGE, LINES } from './engine.js';
import { toMatrix, bestBuildSet, cellsToCardIds, SYM_IDX } from './analysis.js';

const CLOSE = [1, 0.45, 0.2, 0.08]; // ค่าของสิทธิที่ขาดการ์ด 0/1/2/3 ใบ
const ABILITY_VALUE = { INF: 0.35, PAR: 0.45, JUS: 0.35 };

export class SmartAI {
  /** @param {import('./engine.js').Engine} engine */
  constructor(engine, { noise = 0.02 } = {}) {
    this.E = engine;
    this.C = engine.C;
    this.noise = noise;
  }

  /** คืน action ที่ AI เลือกในสถานะปัจจุบัน (หรือ null ถ้าไม่ต้องทำอะไร) */
  decide(s, pid) {
    if (s.stage === STAGE.COINS) {
      const t = s.threat;
      if (!t || !t.unsafe.includes(pid) || pid in t.choices) return null;
      return this.coinChoice(s, pid);
    }
    if (this.E.current(s).id !== pid) return null;
    if (s.stage === STAGE.TAKE) {
      if (s.abilities.INF && !s.peek.used && this.E.topCard(s)) return { type: 'peek' };
      return this.chooseTake(s, pid);
    }
    if (s.stage === STAGE.PEEK) return this.peekDecision(s, pid);
    if (s.stage === STAGE.BUILD) return this.chooseBuild(s, pid);
    return null;
  }

  // ---------------- บริบทของเกม (ข้อมูลสาธารณะ) ----------------
  context(s, pid) {
    const C = this.C;
    const me = this.E.player(s, pid);
    const seen = new Set(s.removed);
    const threatsLeft = Object.values(C).filter((c) => c.type === 'threat' && !seen.has(c.id));
    const covered = new Set();
    for (const b of me.built) {
      for (const t of threatsLeft) if (t.protectedBy.includes(C[b.card].key)) covered.add(t.id);
    }
    // ช่วงท้าย: ภัยคุกคามอาจไม่ทันออกก่อนเกมจบ
    const threatOdds = s.phase === 3 ? 0.55 : 0.95;
    const futureFactor = s.phase === 1 ? 1 : s.phase === 2 ? 0.85 : 0.55;
    return { me, threatsLeft, covered, threatOdds, futureFactor };
  }

  /** ค่าของการสร้างสิทธิใบนี้ สำหรับ AI คนนี้ */
  rightValue(r, s, ctx) {
    let v = r.points;
    if (r.kind === 'substantive') {
      // ป้องกันภัยคุกคามที่ยังไม่ออก และตัวเองยังไม่มีสิทธิที่ป้องกันได้
      let prot = 0;
      let matches = 0;
      for (const t of ctx.threatsLeft) {
        if (!t.protectedBy.includes(r.key)) continue;
        matches++;
        if (!ctx.covered.has(t.id)) prot += t.discardCount * 0.22;
      }
      v += prot * ctx.threatOdds;
      if (matches >= 2) v += 0.35 * ctx.threatOdds; // มีลุ้นโบนัส +1
    } else {
      if (!s.abilities[r.key]) v += ABILITY_VALUE[r.key];
      const slapp = ctx.threatsLeft.find((t) => t.protectedBy.includes(r.key));
      if (slapp && !ctx.covered.has(slapp.id)) v += slapp.discardCount * 0.22 * ctx.threatOdds;
    }
    return v;
  }

  /** จำนวนการ์ดที่ยังขาดเพื่อสร้างสิทธิ r จากตาราง m */
  missing(r, m) {
    if (r.kind === 'substantive') {
      let miss = 0;
      for (let n = 0; n < 3; n++) if (!(m[n] || m[3 + n] || m[6 + n])) miss++;
      return miss;
    }
    const i = SYM_IDX[r.symbol] * 3;
    return Math.max(0, 3 - (m[i] + m[i + 1] + m[i + 2]));
  }

  /**
   * ประเมินค่ามือการ์ด = ค่าสิทธิที่สร้างได้ทันที + ศักยภาพที่จะสร้างได้ในตาต่อ ๆ ไป − ความเสี่ยง
   */
  evaluateHand(s, pid, handIds, ctx) {
    const C = this.C;
    const m = toMatrix(handIds, C);
    const handRights = handIds.filter((id) => C[id].type === 'right').map((id) => C[id]);
    const pubRights = s.publicRights.map((id) => C[id]);
    const value = (r) => this.rightValue(r, s, ctx);

    const now = bestBuildSet(m, [...handRights, ...pubRights], value);
    const builtIds = new Set(now.builds.map((b) => b.right.id));

    // ศักยภาพของสิทธิที่ยังสร้างไม่ได้ (ของในมือเต็มค่า, โซนสาธารณะคนอื่นแย่งได้ → ลดค่า)
    let future = 0;
    const rest = now.rest.slice();
    const pending = [
      ...handRights.filter((r) => !builtIds.has(r.id)).map((r) => ({ r, w: 1 })),
      ...pubRights.filter((r) => !builtIds.has(r.id)).map((r) => ({ r, w: 0.45 })),
    ].sort((a, b) => value(b.r) * b.w - value(a.r) * a.w);
    const usedKeys = new Set();
    for (const { r, w } of pending) {
      const dup = usedKeys.has(r.key) ? 0.6 : 1; // สิทธิซ้ำแบบเดียวกันต้องใช้การ์ดชุดใหม่
      usedKeys.add(r.key);
      future += value(r) * w * dup * CLOSE[Math.min(3, this.missing(r, rest))];
    }
    // การ์ดกิจกรรมที่เหลือยังมีประโยชน์ (สิทธิที่อาจได้มาภายหลัง)
    const actCount = rest.reduce((a, b) => a + b, 0);
    future += Math.min(actCount, 9) * 0.04;

    // ความเสี่ยง: มือใหญ่ = เสียการ์ดเมื่อเจอภัยคุกคามที่ป้องกันไม่ได้
    const handAfter = handIds.length - now.builds.length * 4;
    const uncovered = ctx.threatsLeft.filter((t) => !ctx.covered.has(t.id)).length;
    const justiceSafe = s.abilities.JUS && handAfter <= 2;
    const risk = s.phase >= 2 && !justiceSafe ? Math.min(uncovered, 4) * 0.03 * Math.max(0, handAfter - 2) : 0;

    return now.value + future * ctx.futureFactor - risk;
  }

  chooseTake(s, pid) {
    const ctx = this.context(s, pid);
    const me = ctx.me;
    const options = [];
    for (const line of this.E.legalLines(s)) options.push({ line, slots: LINES[line] });
    if (s.abilities.PAR) {
      // หยิบตำแหน่งใดก็ได้ → ลองทุกชุด 3 ใบ (84 แบบ)
      for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) for (let c = b + 1; c < 9; c++) {
        if (s.market[a] && s.market[b] && s.market[c]) options.push({ slots: [a, b, c] });
      }
    }
    let best = null;
    for (const o of options) {
      const hand = [...me.hand, ...o.slots.map((i) => s.market[i])];
      const score = this.evaluateHand(s, pid, hand, ctx) + random(s) * this.noise;
      if (!best || score > best.score) best = { ...o, score };
    }
    return best.line ? { type: 'take', line: best.line } : { type: 'take', slots: best.slots };
  }

  chooseBuild(s, pid) {
    const C = this.C;
    const ctx = this.context(s, pid);
    const me = ctx.me;
    const m = toMatrix(me.hand, C);
    const avail = [
      ...me.hand.filter((id) => C[id].type === 'right').map((id) => C[id]),
      ...s.publicRights.map((id) => C[id]),
    ];
    const plan = bestBuildSet(m, avail, (r) => this.rightValue(r, s, ctx));
    const first = plan.builds[0];
    if (!first) return { type: 'endBuild' };
    const discards = cellsToCardIds(first.cells, me.hand, C);
    return discards ? { type: 'build', right: first.right.id, discards } : { type: 'endBuild' };
  }

  coinChoice(s, pid) {
    // ใช้เหรียญถ้ามี: สำเร็จ = ไม่เสียการ์ด + เหรียญหายไป (ไม่โดนหักคะแนนตอนจบ), ไม่สำเร็จ = ได้เหรียญคืน
    // → การใช้เหรียญไม่มีข้อเสียเลย จึงใช้ทุกครั้งที่ไม่ปลอดภัย
    const me = this.E.player(s, pid);
    return { type: 'coin', use: me.coins > 0 };
  }

  peekDecision(s, pid) {
    const C = this.C;
    const card = C[s.peek.card];
    const me = this.E.player(s, pid);
    if (card.type === 'end') {
      // การ์ดนี้จะถูกเปิดตอนเติมกองกลางท้ายตานี้ = เกมจบ → ปล่อยไว้ถ้าเรานำอยู่
      const mine = this.publicScore(me);
      const others = Math.max(...s.players.filter((p) => p.id !== pid).map((p) => this.publicScore(p)));
      return { type: 'peekDecide', bottom: mine <= others };
    }
    if (card.type === 'threat') {
      const protectedByRight = me.built.some((b) => card.protectedBy.includes(C[b.card].key));
      return { type: 'peekDecide', bottom: !protectedByRight }; // เราปลอดภัย → ปล่อยให้คนอื่นเจอ
    }
    if (card.type === 'right') return { type: 'peekDecide', bottom: true }; // ไม่ปล่อยการ์ดสิทธิให้คนถัดไป
    return { type: 'peekDecide', bottom: false };
  }

  /** คะแนนที่เห็นบนโต๊ะ (ไม่รวมเหรียญ เพราะไม่รู้ของคนอื่น) */
  publicScore(p) {
    const C = this.C;
    let v = 0;
    for (const b of p.built) {
      const r = C[b.card];
      v += r.points + (r.kind === 'substantive' && b.protects >= 2 ? 1 : 0);
    }
    return v;
  }
}

// ---------------- AI แบบง่าย (ใช้เปรียบเทียบความฉลาดในการทดสอบ) ----------------
// ทำตามสเปกตรงตัว: หยิบแถวที่มีการ์ด "ที่ต้องใช้" มากที่สุด, สร้างสิทธิใบแรกที่สร้างได้, ใช้เหรียญถ้ามี
export class SimpleAI {
  constructor(engine) {
    this.E = engine;
    this.C = engine.C;
  }

  decide(s, pid) {
    const C = this.C;
    if (s.stage === STAGE.COINS) {
      const t = s.threat;
      if (!t || !t.unsafe.includes(pid) || pid in t.choices) return null;
      const me = this.E.player(s, pid);
      return { type: 'coin', use: me.coins > 0 };
    }
    if (this.E.current(s).id !== pid) return null;
    const me = this.E.player(s, pid);
    if (s.stage === STAGE.PEEK) return { type: 'peekDecide', bottom: false };
    if (s.stage === STAGE.BUILD) {
      const opt = this.E.buildOptions(s, pid)[0];
      return opt ? { type: 'build', right: opt.right, discards: opt.discards } : { type: 'endBuild' };
    }
    if (s.stage === STAGE.TAKE) {
      const m = toMatrix(me.hand, C);
      let best = null;
      for (const line of this.E.legalLines(s)) {
        let score = 0;
        for (const i of LINES[line]) {
          const c = C[s.market[i]];
          if (c.type === 'right') score += 2;
          else if (c.type === 'activity' && !m[SYM_IDX[c.symbol] * 3 + c.number - 1]) score += 1;
          else score += 0.3;
        }
        score += random(s) * 0.01;
        if (!best || score > best.score) best = { line, score };
      }
      return { type: 'take', line: best.line };
    }
    return null;
  }
}

// ---------------- AI สุ่ม (ใช้ทดสอบว่ากติกาไม่พังในทุกสถานการณ์) ----------------
export class RandomAI {
  constructor(engine) { this.E = engine; }
  decide(s, pid) {
    if (s.stage === STAGE.COINS) {
      const t = s.threat;
      if (!t || !t.unsafe.includes(pid) || pid in t.choices) return null;
      return { type: 'coin', use: random(s) < 0.5 };
    }
    if (this.E.current(s).id !== pid) return null;
    if (s.stage === STAGE.TAKE) {
      if (s.abilities.INF && !s.peek.used && this.E.topCard(s) && random(s) < 0.5) return { type: 'peek' };
      if (s.abilities.PAR && random(s) < 0.5) {
        const filled = s.market.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
        const slots = [];
        while (slots.length < 3) {
          const i = filled[randInt(s, filled.length)];
          if (!slots.includes(i)) slots.push(i);
        }
        return { type: 'take', slots };
      }
      const lines = this.E.legalLines(s);
      return { type: 'take', line: lines[randInt(s, lines.length)] };
    }
    if (s.stage === STAGE.PEEK) return { type: 'peekDecide', bottom: random(s) < 0.5 };
    if (s.stage === STAGE.BUILD) {
      const opts = this.E.buildOptions(s, pid);
      if (!opts.length || random(s) < 0.2) return { type: 'endBuild' };
      const o = opts[randInt(s, opts.length)];
      return { type: 'build', right: o.right, discards: o.discards };
    }
    return null;
  }
}
