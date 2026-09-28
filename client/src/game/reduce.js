// อัปเดต "ภาพที่แสดงบนจอ" ทีละ event ระหว่างเล่นแอนิเมชัน
// (เซิร์ฟเวอร์ส่งสถานะสุดท้ายมาพร้อมรายการ event → ฝั่ง client ค่อย ๆ ไล่ event ให้ผู้เล่นเห็นทีละขั้น
//  แล้วค่อยแทนด้วยสถานะจริงจากเซิร์ฟเวอร์ตอนจบ จึงไม่มีทางคลาดเคลื่อน)

const clone = (v) => JSON.parse(JSON.stringify(v));

export function applyEvent(prev, e, cards) {
  const v = clone(prev);
  const pl = (id) => v.players.find((p) => p.id === id);
  switch (e.type) {
    case 'turn':
      v.current = e.player;
      v.turnNo = e.turnNo;
      v.stage = 'take';
      break;
    case 'take': {
      e.slots.forEach((i) => { v.market[i] = null; });
      const p = pl(e.player);
      if (p) p.handCount += e.cards.length;
      if (e.player === v.me) v.hand.push(...e.cards);
      break;
    }
    case 'build': {
      const p = pl(e.player);
      if (p) {
        p.built.push({ card: e.right, protects: 0 });
        p.handCount -= e.discards.length + (e.from === 'hand' ? 1 : 0);
      }
      if (e.player === v.me) v.hand = v.hand.filter((id) => id !== e.right && !e.discards.includes(id));
      if (e.from === 'public') v.publicRights = v.publicRights.filter((id) => id !== e.right);
      v.discardCount += e.discards.length;
      v.discardTop = e.discards[e.discards.length - 1];
      break;
    }
    case 'unlock':
      v.abilities[e.ability] = true;
      break;
    case 'draw':
      v.market[e.slot] = e.card;
      if (v.piles[v.phase] > 0) v.piles[v.phase]--;
      v.deckLeft = v.piles[v.phase];
      break;
    case 'phase':
      v.phase = e.phase;
      v.deckLeft = v.piles[v.phase];
      break;
    case 'threat':
      if (v.piles[v.phase] > 0) v.piles[v.phase]--;
      v.deckLeft = v.piles[v.phase];
      break;
    case 'protect': {
      if (e.reason === 'right' && e.protects) {
        const p = pl(e.player);
        const b = p?.built.find((x) => x.card === e.card);
        if (b) b.protects = e.protects;
      }
      break;
    }
    case 'lose': {
      const p = pl(e.player);
      if (p) p.handCount = Math.max(0, p.handCount - e.cards.length);
      if (e.player === v.me) v.hand = v.hand.filter((id) => !e.cards.includes(id));
      v.publicRights.push(...e.toPublic);
      const toDiscard = e.cards.filter((id) => !e.toPublic.includes(id));
      v.discardCount += toDiscard.length;
      if (toDiscard.length) v.discardTop = toDiscard[toDiscard.length - 1];
      break;
    }
    case 'end':
      if (v.piles[v.phase] > 0) v.piles[v.phase]--;
      v.stage = 'ended';
      v.result = e.result;
      break;
    default:
      break;
  }
  return v;
}

/** สิทธิที่ต้องใช้การ์ดกิจกรรมแบบไหน (ใช้แสดงในหน้าต่างมือการ์ด) */
export function missingFor(right, hand, cards) {
  const acts = hand.map((id) => cards[id]).filter((c) => c?.type === 'activity');
  if (right.kind === 'substantive') {
    return [1, 2, 3].filter((n) => !acts.some((c) => c.number === n));
  }
  const have = acts.filter((c) => c.symbol === right.symbol).length;
  return Math.max(0, 3 - have);
}
