// รอบการเล่น (game session) + แบบทดสอบ Pre-test / Post-test + ผลเกม
// ทุกฟังก์ชันตรวจว่า session เป็นของผู้ใช้คนนี้เสมอ (user_id)
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';

export const DIFFICULTY = { easy: 2, medium: 3, hard: 4 }; // จำนวน AI
export const QUESTION_COUNT = 5;
export const TEST_TIME_SEC = 120;

const httpError = (status, code) => Object.assign(new Error(code), { status });

/** สร้างรอบการเล่นใหม่ + สุ่มข้อสอบ 5 ข้อ (ใช้ทั้ง Pre และ Post) */
export async function createSession(userId, difficulty) {
  const aiCount = DIFFICULTY[difficulty];
  if (!aiCount) throw httpError(400, 'BAD_DIFFICULTY');
  const id = randomUUID();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO game_sessions (id, user_id, mode, difficulty, ai_count) VALUES (?, ?, ?, ?, ?)',
      [id, userId, 'single', difficulty, aiCount],
    );
    const [qs] = await conn.query(
      "SELECT id FROM questions WHERE is_active = 1 AND bank = 'pre_post' ORDER BY RAND() LIMIT ?",
      [QUESTION_COUNT],
    );
    if (qs.length < QUESTION_COUNT) throw httpError(500, 'NOT_ENOUGH_QUESTIONS');
    await conn.query(
      'INSERT INTO session_questions (session_id, order_no, question_id) VALUES ?',
      [qs.map((q, i) => [id, i + 1, q.id])],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return { sessionId: id, difficulty, aiCount };
}

export async function getOwnedSession(sessionId, userId) {
  const [[row]] = await pool.query(
    `SELECT s.*,
       (SELECT COUNT(*) FROM game_players gp WHERE gp.session_id = s.id) AS players_saved,
       (SELECT COUNT(*) FROM test_attempts ta WHERE ta.session_id = s.id AND ta.phase = 'pre') AS pre_done,
       (SELECT COUNT(*) FROM test_attempts ta WHERE ta.session_id = s.id AND ta.phase = 'post') AS post_done
     FROM game_sessions s WHERE s.id = ? AND s.user_id = ?`,
    [sessionId, userId],
  );
  if (!row) throw httpError(404, 'SESSION_NOT_FOUND');
  return {
    id: row.id,
    difficulty: row.difficulty,
    aiCount: row.ai_count,
    status: row.status,
    gameFinished: row.players_saved > 0,
    preDone: row.pre_done > 0,
    postDone: row.post_done > 0,
  };
}

async function sessionQuestions(sessionId, withAnswers) {
  const [rows] = await pool.query(
    `SELECT sq.order_no, q.id, q.question, q.answer, q.explanation, q.category_th
       FROM session_questions sq JOIN questions q ON q.id = sq.question_id
      WHERE sq.session_id = ? ORDER BY sq.order_no`,
    [sessionId],
  );
  return rows.map((r) => ({
    order: r.order_no,
    id: r.id,
    question: r.question,
    category: r.category_th,
    ...(withAnswers ? { answer: Boolean(r.answer), explanation: r.explanation } : {}),
  }));
}

/**
 * ข้อสอบของรอบนี้
 * - pre : ไม่ส่งเฉลยให้ client (ไม่เฉลยระหว่างทำ)
 * - post: ส่งเฉลย + คำอธิบาย (แสดงทันทีหลังตอบแต่ละข้อ) — เปิดได้หลังเกมจบเท่านั้น
 */
export async function getTest(sessionId, userId, phase) {
  const s = await getOwnedSession(sessionId, userId);
  if (phase === 'pre' && s.preDone) throw httpError(409, 'ALREADY_SUBMITTED');
  if (phase === 'post') {
    if (!s.gameFinished) throw httpError(409, 'GAME_NOT_FINISHED');
    if (s.postDone) throw httpError(409, 'ALREADY_SUBMITTED');
  }
  return { phase, timeLimitSec: TEST_TIME_SEC, questions: await sessionQuestions(sessionId, phase === 'post') };
}

/**
 * ส่งคำตอบ — ตรวจคะแนนที่เซิร์ฟเวอร์เสมอ (ไม่เชื่อคะแนนจาก client)
 * @param {(boolean|null)[]} answers  คำตอบข้อ 1–5 (null = ไม่ได้ตอบ นับเป็นผิด)
 */
export async function submitTest(sessionId, userId, phase, { answers, timeUsedSec, timedOut }) {
  const s = await getOwnedSession(sessionId, userId);
  if (s.status !== 'in_progress') throw httpError(409, 'SESSION_CLOSED');
  if (phase === 'pre' && s.preDone) throw httpError(409, 'ALREADY_SUBMITTED');
  if (phase === 'post' && (!s.gameFinished || s.postDone)) throw httpError(409, s.postDone ? 'ALREADY_SUBMITTED' : 'GAME_NOT_FINISHED');
  if (!Array.isArray(answers)) throw httpError(400, 'BAD_ANSWERS');

  const qs = await sessionQuestions(sessionId, true);
  const graded = qs.map((q, i) => {
    const a = answers[i];
    const user = a === true || a === false ? a : null;
    return { order: q.order, questionId: q.id, user, correct: user !== null && user === q.answer };
  });
  const score = graded.filter((g) => g.correct).length;
  const used = Math.max(0, Math.min(TEST_TIME_SEC, Math.round(Number(timeUsedSec) || 0)));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO test_attempts (session_id, user_id, phase, score, total, time_used_sec, timed_out) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sessionId, userId, phase, score, qs.length, used, timedOut ? 1 : 0],
    );
    await conn.query(
      'INSERT INTO test_answers (attempt_id, order_no, question_id, user_answer, is_correct) VALUES ?',
      [graded.map((g) => [r.insertId, g.order, g.questionId, g.user === null ? null : g.user ? 1 : 0, g.correct ? 1 : 0])],
    );
    if (phase === 'post') {
      // Post-test เสร็จ = รอบการเล่นนี้สมบูรณ์ (หลังจากนี้กด "ออก" ก็ไม่ลบแล้ว)
      await conn.query("UPDATE game_sessions SET status = 'completed', ended_at = UTC_TIMESTAMP() WHERE id = ?", [sessionId]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') throw httpError(409, 'ALREADY_SUBMITTED');
    throw e;
  } finally {
    conn.release();
  }
  return { score, total: qs.length };
}

/** บันทึกผลเกม (เรียกจากห้องเกมตอนจบ) — ผู้เล่นทุกคน + Game Log ทั้งหมด */
export async function saveGameResult(sessionId, userId, summary) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO game_players (session_id, seat, is_ai, user_id, display_name, rights_points, bonus_points,
         coin_penalty, cards_left, protect_count, total_points, final_rank) VALUES ?`,
      [summary.players.map((p) => [
        sessionId, p.seat, p.isAI ? 1 : 0, p.isAI ? null : userId, p.name.slice(0, 40),
        p.rightsPoints, p.bonus, p.coinPenalty, p.cardsLeft, p.protectCount, p.total, p.rank,
      ])],
    );
    const rows = summary.log.map((l) => [
      sessionId, l.seq, l.turnNo, l.phase, l.actorSeat, l.action.slice(0, 40),
      JSON.stringify(l.payload), l.isPublic ? 1 : 0, l.isAuto ? 1 : 0, new Date(l.at),
    ]);
    for (let i = 0; i < rows.length; i += 200) {
      await conn.query(
        `INSERT INTO game_logs (session_id, seq, turn_no, game_phase, actor_seat, action, payload, is_public, is_auto, created_at)
         VALUES ?`,
        [rows.slice(i, i + 200)],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** หน้าสรุปผล: อันดับ + ตารางคะแนน + Pre/Post + log ทั้งหมด (เปิดเผยหลังจบเกม) */
export async function getSummary(sessionId, userId) {
  const s = await getOwnedSession(sessionId, userId);
  const [players] = await pool.query(
    'SELECT * FROM game_players WHERE session_id = ? ORDER BY final_rank, seat',
    [sessionId],
  );
  const [attempts] = await pool.query(
    'SELECT phase, score, total, time_used_sec, timed_out FROM test_attempts WHERE session_id = ?',
    [sessionId],
  );
  const [logs] = await pool.query(
    'SELECT seq, turn_no, game_phase, action, payload, is_auto FROM game_logs WHERE session_id = ? ORDER BY seq',
    [sessionId],
  );
  const test = (phase) => {
    const a = attempts.find((x) => x.phase === phase);
    return a ? { score: a.score, total: a.total, timeUsedSec: a.time_used_sec, timedOut: Boolean(a.timed_out) } : null;
  };
  return {
    session: s,
    players: players.map((p) => ({
      seat: p.seat,
      isAI: Boolean(p.is_ai),
      isMe: !p.is_ai,
      name: p.display_name,
      rightsPoints: p.rights_points,
      bonus: p.bonus_points,
      coinPenalty: p.coin_penalty,
      cardsLeft: p.cards_left,
      protectCount: p.protect_count,
      total: p.total_points,
      rank: p.final_rank,
    })),
    pre: test('pre'),
    post: test('post'),
    log: logs
      .map((l) => {
        const payload = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        return { seq: l.seq, turn: l.turn_no, phase: l.game_phase, action: l.action, text: payload?.text || null, auto: Boolean(l.is_auto) };
      })
      .filter((l) => l.text),
  };
}

/** ออกจากเกม: ลบรอบนี้ทั้งหมด (ผลเกม + Pre/Post ถูกลบตามด้วย ON DELETE CASCADE) */
export async function deleteSession(sessionId, userId) {
  const s = await getOwnedSession(sessionId, userId);
  if (s.status !== 'in_progress') throw httpError(409, 'SESSION_CLOSED');
  await pool.query('DELETE FROM game_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
}
