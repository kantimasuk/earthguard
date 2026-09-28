// ทดสอบกติกาหลักของเอนจิน   รัน: cd server && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Engine, buildCatalog, STAGE } from '../src/game/engine/index.js';

const raw = JSON.parse(readFileSync(new URL('../src/game/data/cards.json', import.meta.url), 'utf8'));
const E = new Engine(buildCatalog(raw));
const players = [
  { id: 'me', name: 'ฉัน', isAI: false },
  { id: 'a1', name: 'AI 1', isAI: true },
  { id: 'a2', name: 'AI 2', isAI: true },
];
const newGame = (seed = 1) => E.createGame({ players, seed }).state;
const act = (sym, num, copy) => `A-${sym}-${num}-0${copy}`; // เช่น act("INF", 1, 1) = A-INF-1-01

test('จัดกองจั่วตามสเปก: 27 / 31 / 23 ใบ และเปิดกองกลาง 9 ใบ', () => {
  const s = newGame();
  assert.equal(s.piles[1].length, 27 - 9);
  assert.equal(s.piles[2].length, 31);
  assert.equal(s.piles[3].length, 23);
  assert.ok(s.market.every(Boolean));
  assert.ok(s.piles[3].includes('E-TIP'));
  assert.ok(s.piles[1].every((id) => !id.startsWith('T-')));
  assert.equal(s.players.every((p) => p.coins === 2), true);
});

test('หยิบได้เฉพาะแถว/คอลัมน์เต็มแถว และต้องเป็นตาตัวเอง', () => {
  const s = newGame(2);
  const cur = E.current(s).id;
  const other = s.players.find((p) => p.id !== cur).id;
  assert.equal(E.act(s, other, { type: 'take', line: 'r0' }).ok, false);
  assert.equal(E.act(s, cur, { type: 'take', slots: [0, 4, 8] }).error, 'NEED_PARTICIPATION');
  const r = E.act(s, cur, { type: 'take', line: 'c1' });
  assert.equal(r.ok, true);
  assert.equal(E.player(s, cur).hand.length, 3);
  assert.ok(s.market.every(Boolean), 'เติมกองกลางครบ 9 ใบหลังจบตา');
});

test('สร้างสิทธิเชิงเนื้อหา: ต้องทิ้งหมายเลข 1, 2, 3 อย่างละใบ', () => {
  const s = newGame(3);
  const p = E.current(s);
  p.hand = ['R-AIR-01', act('INF', 1, 1), act('PAR', 2, 1), act('JUS', 3, 1), act('JUS', 3, 2)];
  s.stage = STAGE.BUILD;
  const bad = E.act(s, p.id, { type: 'build', right: 'R-AIR-01', discards: [act('INF', 1, 1), act('JUS', 3, 1), act('JUS', 3, 2)] });
  assert.equal(bad.error, 'BAD_DISCARDS');
  const ok = E.act(s, p.id, { type: 'build', right: 'R-AIR-01' }); // ใช้ชุดที่ระบบแนะนำ
  assert.equal(ok.ok, true);
  assert.deepEqual(p.built.map((b) => b.card), ['R-AIR-01']);
});

test('สิทธิเชิงกระบวนการปลดล็อกความสามารถให้ทุกคน', () => {
  const s = newGame(4);
  const p = E.current(s);
  p.hand = ['R-PAR-01', act('PAR', 1, 1), act('PAR', 1, 2), act('PAR', 3, 1)];
  s.stage = STAGE.BUILD;
  const r = E.act(s, p.id, { type: 'build', right: 'R-PAR-01' });
  assert.equal(r.ok, true);
  assert.equal(s.abilities.PAR, true);
  assert.ok(r.events.some((e) => e.type === 'unlock' && e.ability === 'PAR'));
});

/** วางภัยคุกคามไว้บนกองจั่ว แล้วให้ผู้เล่นปัจจุบันจบตา → ระบบเติมกองกลางแล้วเปิดเจอภัย */
function triggerThreat(s, threatId) {
  s.phase = 2;
  s.piles[2] = [...s.piles[2].filter((id) => id !== threatId), threatId];
  const cur = E.current(s);
  return E.act(s, cur.id, { type: 'take', line: 'r0' });
}

test('ภัยคุกคาม: สิทธิที่ตรงป้องกันได้ + ตัวนับ +1, ใช้เหรียญคนเดียว = ไม่สำเร็จ ได้เหรียญคืน', () => {
  const s = newGame(5);
  const [p0, p1, p2] = s.players;
  p0.built = [{ card: 'R-AIR-01', protects: 0 }];
  p0.hand = []; p1.hand = ['R-WAT-01', act('INF', 1, 1), act('INF', 2, 1)]; p2.hand = [act('PAR', 1, 1)];
  s.turn = 0;
  s.piles[1] = [];
  const r = triggerThreat(s, 'T-PM25');
  assert.equal(s.stage, STAGE.COINS);
  assert.equal(p0.built[0].protects, 1);
  assert.deepEqual(s.threat.unsafe.sort(), [p1.id, p2.id].sort());
  assert.ok(r.events.some((e) => e.type === 'protect' && e.player === p0.id));

  E.act(s, p1.id, { type: 'coin', use: true });
  const after = E.act(s, p2.id, { type: 'coin', use: false });
  const reveal = after.events.find((e) => e.type === 'coinReveal');
  assert.equal(reveal.success, false);
  assert.equal(p1.coins, 2, 'รวมกลุ่มไม่สำเร็จ → คืนเหรียญ');
  const lost = after.events.filter((e) => e.type === 'lose');
  assert.equal(lost.length, 2);
  assert.ok(s.publicRights.includes('R-WAT-01') || p1.hand.includes('R-WAT-01'));
});

test('ภัยคุกคาม: ใช้เหรียญ 2 คน = รวมกลุ่มสำเร็จ เหรียญถูกนำออก ไม่เสียการ์ด', () => {
  const s = newGame(6);
  const [, p1, p2] = s.players;
  s.players.forEach((p) => { p.hand = [act('INF', 1, 1).replace('01', p.id === p1.id ? '01' : '02')]; });
  p2.hand = [act('JUS', 2, 1), act('JUS', 2, 2), act('JUS', 3, 1)];
  s.turn = 0; s.piles[1] = [];
  triggerThreat(s, 'T-OIL');
  const unsafe = s.threat.unsafe.slice();
  let last;
  for (const id of unsafe) last = E.act(s, id, { type: 'coin', use: true });
  const reveal = last.events.find((e) => e.type === 'coinReveal');
  assert.equal(reveal.success, true);
  for (const id of unsafe) assert.equal(E.player(s, id).coins, 1);
  assert.equal(last.events.filter((e) => e.type === 'lose').length, 0);
});

test('สิทธิเข้าถึงความยุติธรรม: การ์ดในมือ ≤ 2 ใบ ปลอดภัย', () => {
  const s = newGame(7);
  s.abilities.JUS = true;
  s.players.forEach((p) => { p.hand = []; });
  s.turn = 0; s.piles[1] = [];
  // ผู้เล่นปัจจุบันหยิบ 3 ใบ → มือ 3 ใบ ไม่ปลอดภัย, คนอื่นมือว่าง → ปลอดภัย
  triggerThreat(s, 'T-HEAT');
  const cur = s.players[0].id;
  if (s.threat) assert.deepEqual(s.threat.unsafe, [cur]);
});

test('คะแนน: สิทธิ + โบนัสป้องกันครบ 2 ครั้ง − เหรียญที่เหลือ และตัดสินเสมอด้วยจำนวนครั้งที่ป้องกัน', () => {
  const s = newGame(8);
  const [p0, p1, p2] = s.players;
  p0.built = [{ card: 'R-AIR-01', protects: 0 }, { card: 'R-WAT-01', protects: 2 }, { card: 'R-PAR-01', protects: 0 }];
  p0.coins = 1; // 2 + (2+1) + 3 − 1 = 7 (ตัวอย่างในกติกา)
  p1.built = [{ card: 'R-FOD-01', protects: 2 }, { card: 'R-CLM-01', protects: 0 }, { card: 'R-INF-01', protects: 0 }];
  p1.coins = 1; // 2+1 + 2 + 3 − 1 = 7, ป้องกัน 2 ครั้ง (เท่ากัน)
  p2.coins = 2;
  const { rows, winners } = E.scores(s);
  assert.equal(rows.find((r) => r.id === p0.id).total, 7);
  assert.equal(rows.find((r) => r.id === p1.id).total, 7);
  assert.equal(winners.length, 2, 'คะแนนเท่ากัน + ป้องกันเท่ากัน = ชนะร่วม');
  assert.equal(rows.find((r) => r.id === p2.id).total, -2);
});

test('ความสามารถดูการ์ดบนสุด: ย้ายไปใต้กองได้ และข้อมูลลับส่งให้คนดูคนเดียว', () => {
  const s = newGame(9);
  s.abilities.INF = true;
  const cur = E.current(s).id;
  const top = s.piles[1][s.piles[1].length - 1];
  const r = E.act(s, cur, { type: 'peek' });
  assert.equal(r.ok, true);
  const secret = r.events.find((e) => e.type === 'peekCard');
  assert.equal(secret.to, cur);
  const other = s.players.find((p) => p.id !== cur).id;
  assert.equal(E.eventsFor(r.events, other).some((e) => e.type === 'peekCard'), false);
  assert.equal(E.viewFor(s, other).peek.card, null);
  E.act(s, cur, { type: 'peekDecide', bottom: true });
  assert.equal(s.piles[1][0], top);
  assert.equal(E.act(s, cur, { type: 'peek' }).error, 'ALREADY_PEEKED');
});

test('การ์ดจุดพลิกผัน: เกมจบทันที', () => {
  const s = newGame(10);
  s.phase = 3; s.piles[1] = []; s.piles[2] = [];
  s.piles[3] = ['E-TIP'];
  const r = E.act(s, E.current(s).id, { type: 'take', line: 'r2' });
  assert.equal(s.stage, STAGE.ENDED);
  assert.ok(r.events.some((e) => e.type === 'end'));
  assert.ok(s.result.rows.length === 3);
});
