// รูปประจำตัวของผู้เล่น AI (วาดด้วย path แบบ SVG — ใช้ได้ทั้งใน Vue <svg> และ Canvas ผ่าน Path2D)
// viewBox 0 0 24 24
// ถ้าทีมวางรูปไว้ที่ src/assets/ui/ai-<avatar>.png (เช่น ai-leaf.png) จะใช้รูปนั้นแทนไอคอน
import { uiImg } from '../services/uiArt';

/** URL รูปโปรไฟล์ AI ของทีม (ไม่มี → null) */
export const aiImage = (avatar) => uiImg(`ai-${avatar}`);

export const AVATARS = {
  leaf: {
    bg: '#e3f4dc', ring: '#5fae5a', ink: '#2f7a33',
    path: 'M6 18c0-7 5-12 13-12 0 8-5 13-12 13 M6 18c2-3 5-6 9-8',
  },
  water: {
    bg: '#dff0fb', ring: '#4d9fd6', ink: '#1f6d9e',
    path: 'M12 3.5c3.5 4.5 6 7.6 6 10.5a6 6 0 0 1-12 0c0-2.9 2.5-6 6-10.5Z M9.5 14.5a2.6 2.6 0 0 0 2.5 2.5',
  },
  mountain: {
    bg: '#f3eadf', ring: '#b58a5e', ink: '#7b5534',
    path: 'M3 19l6.5-11 3.5 6 2.5-3.5L21 19Z M8 12.5l1.5 1.5 1.5-1.5',
  },
  wind: {
    bg: '#ece7f7', ring: '#8a70c2', ink: '#5d4596',
    path: 'M3 9h11a3 3 0 1 0-3-3 M3 13h15a3 3 0 1 1-3 3 M3 17h7',
  },
};

export const HUMAN_COLOR = { bg: '#fff4d6', ring: '#e5b457', ink: '#7a5310' };

export function avatarOf(player) {
  if (player?.isAI) return AVATARS[player.avatar] || AVATARS.leaf;
  return HUMAN_COLOR;
}

// รายชื่อ AI ตามลำดับ (ตรงกับ server/src/game/room.js)
export const AI_LIST = [
  { name: 'ใบเตย', avatar: 'leaf' },
  { name: 'ธารา', avatar: 'water' },
  { name: 'ภูผา', avatar: 'mountain' },
  { name: 'พายุ', avatar: 'wind' },
];
