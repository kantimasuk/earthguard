// เครื่องมือวิเคราะห์มือการ์ด (ใช้ทั้งตอนตรวจกติกา แนะนำการ์ดที่จะทิ้ง และให้ AI คิด)
//
// แนวคิดหลัก: การ์ดกิจกรรมที่ "สัญลักษณ์ + หมายเลข" เหมือนกัน ใช้แทนกันได้เสมอในการสร้างสิทธิ
// → แทนการ์ดกิจกรรมในมือด้วยตาราง 3×3 (แถว = สัญลักษณ์ INF/PAR/JUS, คอลัมน์ = หมายเลข 1/2/3)
//   ช่อง i = แถว*3 + (หมายเลข-1) เก็บจำนวนการ์ด
//
// เงื่อนไขสร้างสิทธิ
//   เชิงเนื้อหา   : เลือก 1 ใบจากแต่ละคอลัมน์ (หมายเลข 1, 2, 3 อย่างละใบ)
//   เชิงกระบวนการ : เลือก 3 ใบจากแถวของสัญลักษณ์นั้น (หมายเลขอะไรก็ได้)

import { SYMBOLS } from './catalog.js';

export const SYM_IDX = { INF: 0, PAR: 1, JUS: 2 };
export const cellOf = (card) => SYM_IDX[card.symbol] * 3 + (card.number - 1);

/** การ์ดกิจกรรมในมือ → ตาราง 3×3 */
export function toMatrix(cardIds, cards) {
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const id of cardIds) {
    const c = cards[id];
    if (c && c.type === 'activity') m[cellOf(c)]++;
  }
  return m;
}

const mkey = (m) => m.join('');

/**
 * ทางเลือกการทิ้งการ์ดทั้งหมดของสิทธิหนึ่งใบ (คืน array ของ "ช่องที่ทิ้ง" ยาว 3)
 * @param {object} right  การ์ดสิทธิ (มี kind, symbol)
 * @param {number[]} m    ตาราง 3×3
 */
export function discardOptions(right, m) {
  const out = [];
  if (right.kind === 'substantive') {
    for (let a = 0; a < 3; a++) {
      const ca = a * 3 + 0;
      if (!m[ca]) continue;
      for (let b = 0; b < 3; b++) {
        const cb = b * 3 + 1;
        if (!m[cb]) continue;
        for (let c = 0; c < 3; c++) {
          const cc = c * 3 + 2;
          if (!m[cc]) continue;
          out.push([ca, cb, cc]);
        }
      }
    }
  } else {
    const s = SYM_IDX[right.symbol];
    const cells = [s * 3, s * 3 + 1, s * 3 + 2];
    // เลือก 3 ใบจากแถวเดียว (ซ้ำช่องได้ถ้ามีหลายใบ) — เรียงแบบไม่ลดลงเพื่อไม่ให้นับซ้ำ
    for (let i = 0; i < 3; i++) {
      for (let j = i; j < 3; j++) {
        for (let k = j; k < 3; k++) {
          const need = [0, 0, 0];
          need[i]++; need[j]++; need[k]++;
          if (need[0] <= m[cells[0]] && need[1] <= m[cells[1]] && need[2] <= m[cells[2]]) {
            out.push([cells[i], cells[j], cells[k]]);
          }
        }
      }
    }
  }
  return out;
}

export function canBuild(right, m) {
  if (right.kind === 'substantive') {
    for (let n = 0; n < 3; n++) if (!(m[n] || m[3 + n] || m[6 + n])) return false;
    return true;
  }
  const s = SYM_IDX[right.symbol] * 3;
  return m[s] + m[s + 1] + m[s + 2] >= 3;
}

export function minus(m, cells) {
  const r = m.slice();
  for (const c of cells) r[c]--;
  return r;
}

/**
 * ความยืดหยุ่นของการ์ดที่เหลือ (ยิ่งสูงยิ่งดี) — ใช้ตัดสินเสมอว่าจะทิ้งชุดไหน
 * ให้ค่ากับชุด 1-2-3 ที่ยังครบ + แถวสัญลักษณ์ที่ยังมี 3 ใบ + ความหลากหลาย
 */
export function flexibility(m) {
  const col = [m[0] + m[3] + m[6], m[1] + m[4] + m[7], m[2] + m[5] + m[8]];
  const row = [m[0] + m[1] + m[2], m[3] + m[4] + m[5], m[6] + m[7] + m[8]];
  const sets = Math.min(col[0], col[1], col[2]);
  const triples = Math.floor(row[0] / 3) + Math.floor(row[1] / 3) + Math.floor(row[2] / 3);
  const total = col[0] + col[1] + col[2];
  const nonzero = m.filter(Boolean).length;
  return sets * 1 + triples * 0.9 + total * 0.05 + nonzero * 0.02;
}

/**
 * ค้นหาชุดการสร้างสิทธิที่ได้ "ค่า" รวมสูงสุด จากการ์ดสิทธิที่มีให้สร้าง (ในมือ + โซนสาธารณะ)
 * @param {number[]} m               ตาราง 3×3 ของการ์ดกิจกรรม
 * @param {object[]} rights          การ์ดสิทธิที่สร้างได้ (ซ้ำได้)
 * @param {(r:object)=>number} value ค่าของการสร้างสิทธิใบนั้น (ค่าเริ่มต้น = คะแนน)
 * @returns {{ value:number, flex:number, builds:{ right:object, cells:number[] }[], rest:number[] }}
 */
export function bestBuildSet(m, rights, value = (r) => r.points) {
  // จัดกลุ่มสิทธิที่เงื่อนไขเหมือนกัน (key เดียวกัน) — ลำดับไม่สำคัญ ช่วยลดการค้นหาซ้ำ
  const groups = [];
  const byKey = {};
  for (const r of rights) {
    if (!byKey[r.key]) { byKey[r.key] = { rep: r, cards: [] }; groups.push(byKey[r.key]); }
    byKey[r.key].cards.push(r);
  }
  const memo = new Map();

  function solve(g, count, mm) {
    if (g >= groups.length) return { value: 0, flex: flexibility(mm), picks: [], rest: mm };
    const key = `${g}|${count}|${mkey(mm)}`;
    const hit = memo.get(key);
    if (hit) return hit;

    // ทางเลือก ก: ไม่สร้างสิทธิกลุ่มนี้ (เพิ่ม) แล้วไปกลุ่มถัดไป
    const nextCount = g + 1 < groups.length ? groups[g + 1].cards.length : 0;
    let best = solve(g + 1, nextCount, mm);

    // ทางเลือก ข: สร้างอีก 1 ใบ ด้วยการทิ้งแต่ละแบบ
    if (count > 0) {
      const grp = groups[g];
      const v = value(grp.rep);
      for (const cells of discardOptions(grp.rep, mm)) {
        const sub = solve(g, count - 1, minus(mm, cells));
        const total = sub.value + v;
        if (total > best.value + 1e-9 || (Math.abs(total - best.value) < 1e-9 && sub.flex > best.flex + 1e-9)) {
          best = { value: total, flex: sub.flex, picks: [{ g, cells }, ...sub.picks], rest: sub.rest };
        }
      }
    }
    memo.set(key, best);
    return best;
  }

  const res = solve(0, groups.length ? groups[0].cards.length : 0, m);
  // แปลงกลับเป็นการ์ดจริง (ใช้การ์ดในกลุ่มตามลำดับ)
  const used = {};
  const builds = res.picks.map((p) => {
    const grp = groups[p.g];
    const i = (used[p.g] = (used[p.g] ?? -1) + 1);
    return { right: grp.cards[i], cells: p.cells };
  });
  return { value: res.value, flex: res.flex, builds, rest: res.rest };
}

/**
 * เลือกช่องที่จะทิ้งให้ดีที่สุดสำหรับการสร้างสิทธิใบหนึ่ง
 * (ทิ้งแล้วยังสร้างสิทธิอื่นต่อได้มากที่สุด และการ์ดที่เหลือยืดหยุ่นที่สุด)
 */
export function suggestCells(right, m, otherRights, value) {
  let best = null;
  for (const cells of discardOptions(right, m)) {
    const rest = minus(m, cells);
    const after = bestBuildSet(rest, otherRights, value);
    const score = after.value * 100 + after.flex;
    if (!best || score > best.score + 1e-9) best = { cells, score };
  }
  return best?.cells || null;
}

/** แปลงช่อง → รหัสการ์ดจริงในมือ (ไม่ใช้ใบเดิมซ้ำ) */
export function cellsToCardIds(cells, handIds, cards) {
  const pool = {};
  for (const id of handIds) {
    const c = cards[id];
    if (c?.type !== 'activity') continue;
    (pool[cellOf(c)] ||= []).push(id);
  }
  const out = [];
  for (const cell of cells) {
    const id = pool[cell]?.shift();
    if (!id) return null;
    out.push(id);
  }
  return out;
}

/** ตรวจว่าการ์ดที่ผู้เล่นเลือกทิ้ง ถูกต้องตามเงื่อนไขของสิทธิหรือไม่ */
export function validDiscards(right, discardIds, handIds, cards) {
  if (!Array.isArray(discardIds) || discardIds.length !== 3) return false;
  if (new Set(discardIds).size !== 3) return false;
  const hand = new Set(handIds);
  const picked = discardIds.map((id) => cards[id]);
  if (picked.some((c, i) => !c || c.type !== 'activity' || !hand.has(discardIds[i]))) return false;
  if (right.kind === 'substantive') {
    const nums = picked.map((c) => c.number).sort().join('');
    return nums === '123';
  }
  return picked.every((c) => c.symbol === right.symbol);
}

export { SYMBOLS };
