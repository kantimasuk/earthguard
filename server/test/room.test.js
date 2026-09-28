// ทดสอบห้องเกม: เล่นจนจบทั้งแบบผู้เล่นกดเอง และแบบปล่อยให้หมดเวลาทุกครั้ง (ระบบเล่นแทน)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Engine, buildCatalog, SmartAI } from '../src/game/engine/index.js';
import { SinglePlayerRoom } from '../src/game/room.js';

const raw = JSON.parse(readFileSync(new URL('../src/game/data/cards.json', import.meta.url), 'utf8'));
const engine = new Engine(buildCatalog(raw));
const FAST = { decisionMs: 40, aiActionMs: 2, aiQuickMs: 1, aiCoinMs: 1, readyTimeoutMs: 1000 };

function runRoom({ humanPlays, aiCount = 3, seed = 42 }) {
  return new Promise((resolve, reject) => {
    const brain = new SmartAI(engine);
    const got = { updates: 0, intents: 0, timers: 0, sawPrivateOfOthers: false };
    let room;
    const emit = (type, p) => {
      if (type === 'sp:update') {
        got.updates++;
        // ต้องไม่เห็นมือของ AI
        if (p.view.players.some((pl) => pl.id !== 'me' && pl.coins !== null)) got.sawPrivateOfOthers = true;
        setTimeout(() => room.ready(p.seq), 0); // จำลอง client เล่นแอนิเมชันเสร็จ
      }
      if (type === 'sp:intent') got.intents++;
      if (type === 'sp:timer') {
        got.timers++;
        if (humanPlays) {
          setTimeout(() => {
            const a = brain.decide(room.state, 'me');
            if (a) room.handleAction(a);
          }, 1);
        }
      }
    };
    room = new SinglePlayerRoom({
      engine, sessionId: 'test', human: { id: 'me', name: 'ฉัน' }, aiCount, seed, emit, timing: FAST,
      onEnd: (summary) => resolve({ summary, got }),
    });
    setTimeout(() => reject(new Error('timeout')), 20000);
    room.start();
  });
}

test('ห้องเกม: ผู้เล่นเล่นเองจนจบ + บันทึก log', async () => {
  const { summary, got } = await runRoom({ humanPlays: true, aiCount: 4, seed: 7 });
  assert.equal(summary.players.length, 5);
  assert.ok(summary.result.winners.length >= 1);
  assert.ok(summary.log.length > 50);
  assert.ok(summary.log.some((l) => l.action === 'take' && l.actorSeat !== null));
  assert.ok(got.intents > 5, 'AI ประกาศการกระทำก่อนทำ');
  assert.equal(got.sawPrivateOfOthers, false);
});

test('ห้องเกม: ไม่กดอะไรเลย → ระบบเล่นแทนเมื่อหมดเวลาจนเกมจบ', async () => {
  const { summary } = await runRoom({ humanPlays: false, aiCount: 2, seed: 11 });
  const autos = summary.log.filter((l) => l.isAuto);
  assert.ok(autos.length > 0);
  assert.ok(autos.every((l) => l.actorSeat === summary.players.find((p) => p.id === 'me').seat || l.action === 'coinChosen'));
});
