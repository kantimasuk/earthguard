// ค่าคงที่ของกติกา — ใช้ร่วมกันทั้ง client (Single Player) และ server (Multiplayer ภายหลัง)
// game engine ทั้งหมดจะอยู่ในโฟลเดอร์นี้ เป็น JavaScript ล้วน ห้าม import อะไรจาก Vue/Phaser/DOM

export const DIFFICULTY = {
  easy: { label: 'ง่าย', aiCount: 2 },
  medium: { label: 'ปานกลาง', aiCount: 3 },
  hard: { label: 'ยาก', aiCount: 4 },
};

export const DECK_LAYOUT = {
  1: { activity: 18, right: 9, threat: 0, end: 0 },
  2: { activity: 18, right: 9, threat: 4, end: 0 },
  3: { activity: 18, right: 0, threat: 4, end: 1 },
};

export const COINS_PER_PLAYER = 2;
export const MARKET_SIZE = 3; // ตาราง 3×3

export const TIMERS_SEC = {
  pickRow: 20,
  buildRight: 20,
  coinChoice: 20,
  peekTop: 20,
  aiActionDelay: 5,
};

export const SCORE = {
  substantive: 2,
  procedural: 3,
  protectBonusThreshold: 2,
  protectBonus: 1,
  leftoverCoinPenalty: -1,
};

export const TEST = { questions: 5, timeLimitSec: 120 };
