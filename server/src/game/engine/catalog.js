// แปลงข้อมูลการ์ดดิบ (cards.json ที่สร้างจาก its_all_rights_cards.xlsx) → ข้อมูลที่เอนจินใช้งานง่าย
//
// รหัสที่ใช้ในเอนจิน
//   สิทธิ (right)      key: AIR WAT FOD CLM ECO TOX (เชิงเนื้อหา) | INF PAR JUS (เชิงกระบวนการ)
//   กิจกรรม (activity) symbol: INF (ข้อมูลข่าวสาร) PAR (มีส่วนร่วม) JUS (ยุติธรรม), number: 1 | 2 | 3
//   ภัยคุกคาม (threat) protectedBy: [key ของสิทธิที่ป้องกันได้], discardCount

export const SYMBOLS = ['INF', 'PAR', 'JUS'];
export const NUMBERS = [1, 2, 3];

export const SYMBOL_TH = {
  INF: 'เข้าถึงข้อมูลข่าวสาร',
  PAR: 'มีส่วนร่วมในการตัดสินใจ',
  JUS: 'เข้าถึงความยุติธรรม',
};
export const NUMBER_TH = { 1: 'สร้างการรับรู้', 2: 'เกิดการรับรอง', 3: 'คุ้มครองเยียวยา' };

// ความสามารถของสิทธิเชิงกระบวนการ (ปลดล็อกให้ผู้เล่นทุกคน)
export const ABILITY_TH = {
  INF: { title: 'ช่วยเตรียมตัว', text: 'ก่อนหยิบการ์ด ดูการ์ดบนสุดของกองจั่ว แล้วเลือกวางไว้ที่เดิมหรือใต้กอง' },
  PAR: { title: 'ช่วยสนับสนุน', text: 'หยิบการ์ด 3 ใบจากกองกลางตำแหน่งใดก็ได้ ไม่ต้องเป็นแถว' },
  JUS: { title: 'ช่วยเยียวยา', text: 'เมื่อเปิดเจอภัยคุกคาม ผู้เล่นที่มีการ์ดในมือ 2 ใบหรือน้อยกว่าไม่รับผล' },
};

const SYMBOL_FROM_TH = Object.fromEntries(Object.entries(SYMBOL_TH).map(([k, v]) => [v, k]));

/**
 * @param {Array<object>} raw  ข้อมูลจาก cards.json
 * @returns {{ cards: Record<string, object>, list: object[], rightsByKey: Record<string, object> }}
 */
export function buildCatalog(raw) {
  const rightKeyByShort = {};
  for (const c of raw) {
    if (c.type === 'right') rightKeyByShort[c.shortName] = c.code.split('-')[1];
  }

  const cards = {};
  const rightsByKey = {};
  for (const c of raw) {
    const base = {
      id: c.code,
      design: c.design,
      type: c.type,
      name: c.name,
      shortName: c.shortName || null,
      text: c.text || '',
      color: c.color || '#dddddd',
    };
    let card;
    if (c.type === 'right') {
      const key = c.code.split('-')[1];
      const kind = c.subtype === 'procedural' ? 'procedural' : 'substantive';
      card = {
        ...base,
        key,
        kind,
        points: Number(c.points) || (kind === 'procedural' ? 3 : 2),
        // สิทธิเชิงกระบวนการต้องใช้การ์ดกิจกรรมสัญลักษณ์เดียวกับชื่อสิทธิ
        symbol: kind === 'procedural' ? key : null,
        buildCondition: c.buildCondition || '',
        ability: c.ability || '',
        protectsAgainst: [], // เติมด้านล่าง
      };
      rightsByKey[key] ||= card;
    } else if (c.type === 'activity') {
      card = {
        ...base,
        number: Number(c.number),
        numberMeaning: c.numberMeaning || NUMBER_TH[c.number],
        symbol: SYMBOL_FROM_TH[c.symbol] || c.code.split('-')[1],
      };
    } else if (c.type === 'threat') {
      card = {
        ...base,
        discardCount: Number(c.discardCount) || 2,
        protectedBy: String(c.protectsOrProtectedBy || '')
          .split(',')
          .map((s) => rightKeyByShort[s.trim()])
          .filter(Boolean),
      };
    } else {
      card = { ...base }; // end: การ์ดจุดพลิกผัน
    }
    cards[card.id] = card;
  }

  // สิทธิแต่ละแบบป้องกันภัยคุกคามใดได้บ้าง (ใช้แสดงผล + AI ประเมินค่า)
  for (const t of Object.values(cards)) {
    if (t.type !== 'threat') continue;
    for (const r of Object.values(cards)) {
      if (r.type === 'right' && t.protectedBy.includes(r.key)) r.protectsAgainst.push(t.id);
    }
  }

  return { cards, list: Object.values(cards), rightsByKey };
}

/** ข้อมูลแค็ตตาล็อกแบบย่อสำหรับส่งให้ client (ใช้วาดการ์ด) */
export function catalogForClient(catalog) {
  return catalog.list.map((c) => {
    const o = { id: c.id, design: c.design, type: c.type, name: c.name, shortName: c.shortName, text: c.text, color: c.color };
    if (c.type === 'right') Object.assign(o, { key: c.key, kind: c.kind, points: c.points, symbol: c.symbol, buildCondition: c.buildCondition, ability: c.ability, protectsAgainst: c.protectsAgainst });
    if (c.type === 'activity') Object.assign(o, { number: c.number, numberMeaning: c.numberMeaning, symbol: c.symbol });
    if (c.type === 'threat') Object.assign(o, { discardCount: c.discardCount, protectedBy: c.protectedBy });
    return o;
  });
}
