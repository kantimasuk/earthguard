// จำลองเกมอัตโนมัติจำนวนมาก เพื่อ
//   1) ทดสอบว่ากติกาไม่พัง (การ์ดไม่หาย/ไม่ซ้ำ, เกมจบทุกครั้ง)
//   2) วัดความฉลาดของ AI (อัตราชนะเทียบกับ AI แบบง่าย/แบบสุ่ม)
//
// รัน:  cd server && node scripts/simulate.js [จำนวนเกม]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Engine, buildCatalog, SmartAI, SimpleAI, RandomAI, STAGE } from '../src/game/engine/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(here, '../src/game/data/cards.json'), 'utf8'));
const catalog = buildCatalog(raw);
const engine = new Engine(catalog);

function countCards(s) {
  const all = [
    ...s.piles[1], ...s.piles[2], ...s.piles[3],
    ...s.market.filter(Boolean),
    ...s.players.flatMap((p) => [...p.hand, ...p.built.map((b) => b.card)]),
    ...s.publicRights, ...s.discard, ...s.removed,
  ];
  if (s.threat && !s.removed.includes(s.threat.card)) all.push(s.threat.card);
  return all;
}

function check(s) {
  const all = countCards(s);
  if (all.length !== 81) throw new Error(`card count ${all.length}`);
  if (new Set(all).size !== 81) throw new Error('duplicate card');
  for (const p of s.players) if (p.coins < 0 || p.coins > 2) throw new Error('coins');
}

export function playGame(makers, seed, { verify = true } = {}) {
  const players = makers.map((m, i) => ({ id: `p${i}`, name: `${m.name}${i}`, isAI: true, kind: m.name }));
  const { state: s } = engine.createGame({ players, seed });
  const bots = Object.fromEntries(players.map((p, i) => [p.id, new makers[i].cls(engine)]));
  let steps = 0;
  const stats = { threats: 0, builds: 0, turns: 0, peeks: 0 };
  while (s.stage !== STAGE.ENDED) {
    if (++steps > 5000) throw new Error('game did not end');
    let actors;
    if (s.stage === STAGE.COINS) actors = s.threat.unsafe.filter((id) => !(id in s.threat.choices));
    else actors = [engine.current(s).id];
    for (const id of actors) {
      const a = bots[id].decide(s, id);
      if (!a) continue;
      const r = engine.act(s, id, a);
      if (!r.ok) throw new Error(`illegal ${JSON.stringify(a)} → ${r.error} at stage ${s.stage}`);
      for (const e of r.events) {
        if (e.type === 'threat') stats.threats++;
        if (e.type === 'build') stats.builds++;
        if (e.type === 'turn') stats.turns++;
        if (e.type === 'peekStart') stats.peeks++;
      }
      if (verify) check(s);
      if (s.stage !== STAGE.COINS) break;
    }
  }
  return { result: s.result, players, stats };
}

// ---------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const N = Number(process.argv[2]) || 300;
  const Smart = { name: 'Smart', cls: SmartAI };
  const Simple = { name: 'Simple', cls: SimpleAI };
  const Rand = { name: 'Random', cls: RandomAI };

  const t0 = Date.now();
  // 1) ความทนทาน: AI สุ่มล้วน (เจอทุกสถานการณ์แปลก ๆ)
  for (let i = 0; i < N; i++) playGame([Rand, Rand, Rand, Rand, Rand], 1000 + i);
  console.log(`✔ Random x5: ${N} เกม ไม่พัง`);

  // 2) ความฉลาด: Smart 1 ตัว vs Simple (สลับที่นั่งทุกเกม)
  for (const n of [3, 4, 5]) {
    let wins = 0; let share = 0; let score = 0; let others = 0; let turns = 0; let threats = 0;
    for (let i = 0; i < N; i++) {
      const makers = Array(n).fill(Simple);
      const seat = i % n;
      makers[seat] = Smart;
      const { result, players, stats } = playGame(makers, 5000 + i);
      const smartId = players[seat].id;
      const row = result.rows.find((r) => r.id === smartId);
      if (row.rank === 1) { wins++; share += 1 / result.winners.length; }
      score += row.total;
      others += result.rows.filter((r) => r.id !== smartId).reduce((a, r) => a + r.total, 0) / (n - 1);
      turns += stats.turns; threats += stats.threats;
    }
    console.log(`Smart vs Simple (${n} คน): ชนะ ${(100 * wins / N).toFixed(1)}% (คาดหวังถ้าเก่งเท่ากัน ${(100 / n).toFixed(1)}%) · คะแนนเฉลี่ย Smart ${(score / N).toFixed(2)} vs อื่น ${(others / N).toFixed(2)} · ตาเฉลี่ย ${(turns / N).toFixed(1)} · ภัยเฉลี่ย ${(threats / N).toFixed(1)}`);
  }
  // 3) Smart vs Random
  {
    let wins = 0;
    for (let i = 0; i < N; i++) {
      const { result, players } = playGame([Smart, Rand, Rand], 9000 + i);
      if (result.rows.find((r) => r.id === players[0].id).rank === 1) wins++;
    }
    console.log(`Smart vs Random (3 คน): ชนะ ${(100 * wins / N).toFixed(1)}%`);
  }
  console.log(`เวลา ${((Date.now() - t0) / 1000).toFixed(1)} วินาที`);
}
