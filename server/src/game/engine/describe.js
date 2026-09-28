// แปลง event → ข้อความภาษาไทยสำหรับ Game Log (ใช้ทั้งฝั่ง server บันทึกลงฐานข้อมูล และ client แสดงผล)

import { LINE_TH } from './engine.js';
import { SYMBOL_TH, ABILITY_TH } from './catalog.js';

const RIGHT_ABILITY_NAME = { INF: 'เข้าถึงข้อมูลข่าวสาร', PAR: 'มีส่วนร่วมในการตัดสินใจ', JUS: 'เข้าถึงความยุติธรรม' };

/**
 * @param {object} e        event จากเอนจิน
 * @param {Record<string, object>} cards  แค็ตตาล็อกการ์ด (id → card)
 * @param {(id:string)=>string} nameOf    ชื่อผู้เล่นจาก id
 * @param {{ reveal?: boolean }} opt     reveal = แสดงข้อมูลลับ (ใช้หลังจบเกม)
 * @returns {string|null}
 */
export function describe(e, cards, nameOf, opt = {}) {
  const n = (id) => nameOf(id);
  const cn = (id) => cards[id]?.name || id;
  const list = (ids) => ids.map(cn).join(', ');
  const auto = e.auto ? ' (ระบบทำแทนเพราะหมดเวลา)' : '';

  switch (e.type) {
    case 'setup': return `เริ่มเกม · ลำดับการเล่น: ${e.order.map(n).join(' → ')}`;
    case 'turn': return `ตาที่ ${e.turnNo}: ตาของ ${n(e.player)}`;
    case 'take':
      return e.line
        ? `${n(e.player)} หยิบ${LINE_TH[e.line]}: ${list(e.cards)}${auto}`
        : `${n(e.player)} หยิบการ์ด 3 ใบ (ความสามารถมีส่วนร่วม): ${list(e.cards)}${auto}`;
    case 'build': {
      const where = e.from === 'public' ? ' จากโซนสิทธิสาธารณะ' : '';
      return `${n(e.player)} สร้าง "${cn(e.right)}"${where} (ทิ้ง ${e.discards.length} ใบ)`;
    }
    case 'unlock': return `ปลดล็อกความสามารถ "${ABILITY_TH[e.ability].title}" จากสิทธิ${RIGHT_ABILITY_NAME[e.ability]} ให้ผู้เล่นทุกคน`;
    case 'endBuild': return e.auto ? `${n(e.player)} ไม่สร้างสิทธิเพิ่ม${auto}` : null;
    case 'phase': return `เข้าสู่ช่วงที่ ${e.phase}${e.phase === 2 ? ' · ภัยคุกคามเริ่มปรากฏ' : e.phase === 3 ? ' · โลกใกล้จุดพลิกผัน' : ''}`;
    case 'threat': return `เปิดเจอภัยคุกคาม "${cn(e.card)}"`;
    case 'protect':
      return e.reason === 'justice'
        ? `${n(e.player)} ปลอดภัย (การ์ดในมือไม่เกิน 2 ใบ + สิทธิเข้าถึงความยุติธรรม)`
        : `${n(e.player)} ปลอดภัยด้วย "${cn(e.card)}"${e.protects ? ` (ป้องกันครั้งที่ ${e.protects})` : ''}`;
    case 'coinsStart': return `ผู้เล่นที่ยังไม่ปลอดภัย: ${e.unsafe.map(n).join(', ')} · เลือกใช้เหรียญรวมกลุ่มแบบลับ`;
    case 'coinChosen': return opt.reveal && e.auto ? `${n(e.player)} ไม่ได้เลือก → ไม่ใช้เหรียญ${auto}` : null;
    case 'coinReveal': {
      const users = Object.keys(e.choices).filter((id) => e.choices[id]);
      const who = users.length ? users.map(n).join(', ') : 'ไม่มีใคร';
      return e.success
        ? `รวมกลุ่มสำเร็จ! ${who} ใช้เหรียญและได้รับการป้องกัน`
        : `รวมกลุ่มไม่สำเร็จ (ใช้เหรียญ: ${who}) · คืนเหรียญให้ผู้ใช้`;
    }
    case 'lose':
      if (!e.cards.length) return `${n(e.player)} ไม่มีการ์ดให้ทิ้ง`;
      return `${n(e.player)} เสียการ์ด ${e.cards.length} ใบ: ${list(e.cards)}${e.toPublic.length ? ` · สิทธิที่หลุดไปอยู่โซนสาธารณะ: ${list(e.toPublic)}` : ''}`;
    case 'peekStart': return `${n(e.player)} ใช้ความสามารถดูการ์ดบนสุดของกองจั่ว`;
    case 'peekCard': return opt.reveal ? `${n(e.player)} เห็นการ์ด "${cn(e.card)}"` : null;
    case 'peekDone': return `${n(e.player)} ${e.bottom ? 'ย้ายการ์ดไปไว้ใต้กอง' : 'วางการ์ดคืนไว้บนกอง'}${auto}`;
    case 'end': return `เปิดเจอ "${cn(e.card)}" · เกมจบแล้ว!`;
    default: return null;
  }
}

export { SYMBOL_TH };
