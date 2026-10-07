<script setup>
// แถบ "ผู้เล่นในห้อง": รูป + ชื่อ + จำนวนการ์ด / สิทธิที่สร้าง / คะแนน · แถวที่ถึงตาจะไฮไลต์
// data-anchor = จุดที่การ์ดบินเข้าหา (Phaser ถามตำแหน่งผ่าน bridge.anchor)
import { computed } from 'vue';
import PlayerAvatar from '@/components/PlayerAvatar.vue';

const props = defineProps({
  players: { type: Array, default: () => [] },
  me: { type: String, default: 'me' },
  current: { type: String, default: null },
  ended: { type: Boolean, default: false },
  myAvatar: { type: String, default: null },
  myName: { type: String, default: 'คุณ' },
  cards: { type: Object, required: true },
  intent: { type: Object, default: null },   // { player, text } ข้อความ "AI กำลังทำอะไร"
  compact: { type: Boolean, default: false },
});
const emit = defineEmits(['select']);

// คะแนนสะสมระหว่างเกม (สิทธิที่สร้าง + โบนัสป้องกันครบ 2 ครั้ง) — ยังไม่หักเหรียญที่เหลือ
function score(p) {
  return p.built.reduce((sum, b) => {
    const c = props.cards[b.card];
    return sum + (c?.points || 0) + (c?.kind === 'substantive' && b.protects >= 2 ? 1 : 0);
  }, 0);
}
// เราอยู่บนสุด แล้วตามด้วย AI ตามลำดับที่นั่ง
const rows = computed(() => {
  const mine = props.players.filter((p) => p.id === props.me);
  return [...mine, ...props.players.filter((p) => p.id !== props.me)];
});
</script>

<template>
  <section class="players glass" :class="{ compact }">
    <h3>{{ compact ? 'ผู้เล่น' : 'ผู้เล่นในห้อง' }}</h3>
    <ul>
      <li
        v-for="p in rows"
        :key="p.id"
        :class="{ turn: !ended && current === p.id, mine: p.id === me }"
        :data-anchor="p.id === me ? null : p.id"
        @click="emit('select', p.id)"
      >
        <span class="avw">
          <PlayerAvatar :is-ai="p.isAI" :avatar="p.isAI ? p.avatar : myAvatar" :name="p.id === me ? myName : p.name" :size="compact ? '2.1rem' : 'var(--pav, 2.5rem)'" :active="!ended && current === p.id" />
          <i v-if="compact" class="hc" title="การ์ดในมือ">{{ p.handCount }}</i>
        </span>
        <b v-if="compact" class="cname">{{ p.id === me ? 'คุณ' : p.name }}</b>
        <div v-else class="info">
          <div class="name">
            <b>{{ p.id === me ? myName : p.name }}</b>
          </div>
          <!-- ป้ายสถานะ: ถึงตาใคร / AI กำลังทำอะไร (อยู่บรรทัดของตัวเอง ไม่ทับชื่อหรือตัวเลข) -->
          <Transition name="say" mode="out-in">
            <span v-if="!ended && current === p.id" :key="intent && intent.player === p.id ? intent.text : 'now'" class="now">
              <i class="pulse" />{{ intent && intent.player === p.id ? intent.text : (p.id === me ? 'ตาของคุณ' : 'กำลังเล่น') }}
            </span>
          </Transition>
          <div class="stats">
            <span title="การ์ดในมือ"><i class="dot c" />{{ p.handCount }}<small> ใบ</small></span>
            <span title="สิทธิที่สร้างแล้ว"><i class="dot r" />{{ p.built.length }}<small> สิทธิ</small></span>
            <span title="คะแนน"><i class="dot s" />{{ score(p) }}<small> คะแนน</small></span>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.players { display: flex; flex-direction: column; min-height: 0; overflow: hidden; container-type: inline-size; }
h3 {
  margin: 0; padding: 0.45rem 0.8rem; text-align: center;
  font-family: var(--font-head); font-size: 1rem; font-weight: 700; color: #2f5a3a;
  background: rgba(255, 255, 255, 0.5); border-bottom: 1px solid rgba(255, 255, 255, 0.8);
}
ul { list-style: none; margin: 0; padding: 0.45rem; display: flex; flex-direction: column; gap: 0.4rem; overflow-y: auto; min-height: 0; }
li {
  position: relative; display: flex; align-items: center; gap: 0.55rem;
  padding: 0.4rem 0.55rem; border-radius: 0.9rem; cursor: pointer;
  background: rgba(255, 255, 255, 0.72); border: 1.5px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 6px rgba(60, 90, 70, 0.08);
  transition: background 0.25s, border-color 0.25s, box-shadow 0.25s, transform 0.15s;
}
li:hover { transform: translateY(-1px); }
li.turn { background: #fff8dc; border-color: #f6cf6a; box-shadow: 0 0 0 3px rgba(246, 207, 106, 0.35), 0 3px 10px rgba(180, 140, 40, 0.15); }
.info { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.2rem; padding-left: 0.15rem; }
.name { display: flex; align-items: center; gap: 0.35rem; min-width: 0; }
.name b { font-size: 0.95rem; color: #24452b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 0.2rem; }
/* padding-left: สระหน้า (ใ ไ โ) ของฟอนต์ยื่นออกทางซ้าย → ถ้าไม่เว้นที่ จะถูก overflow: hidden ตัดหาย */
.stats { padding-left: 0.1rem; }
.now {
  align-self: flex-start; max-width: 100%; display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.7rem; font-weight: 700; padding: 0.05rem 0.55rem 0.05rem 0.4rem; border-radius: 999px;
  background: #ffe9a8; color: #6b4a00; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pulse { flex: none; width: 6px; height: 6px; border-radius: 50%; background: #e0a100; animation: blink 1s ease-in-out infinite; }
@keyframes blink { 50% { opacity: 0.25; } }
.stats { display: flex; gap: 0.55rem; font-size: 0.78rem; font-weight: 700; color: #3d5a45; white-space: nowrap; }
.stats small { font-weight: 500; color: #6d7f71; }
.dot { display: inline-block; width: 0.55rem; height: 0.55rem; border-radius: 3px; margin-right: 0.22rem; vertical-align: 0.02em; }
.dot.c { background: #9fc7ec; }
.dot.r { background: #8fd19e; border-radius: 50% 0; }
.dot.s { background: #f6cf6a; border-radius: 50%; }
.say-enter-active, .say-leave-active { transition: opacity 0.2s, transform 0.2s; }
.say-enter-from, .say-leave-to { opacity: 0; transform: translateY(4px); }

/* แผงแคบ (คอลัมน์ซ้ายบนแท็บเล็ต/จอเล็ก): ตัวเลขสถิติเล็กลง ไม่ล้นขอบ */
@container (max-width: 250px) {
  li { gap: 0.6rem; padding: 0.4rem 0.5rem 0.4rem 0.55rem; }
  .stats { gap: 0.35rem; font-size: 0.7rem; }
  .dot { width: 0.45rem; height: 0.45rem; margin-right: 0.15rem; }
}
/* แท็บเล็ต / จอคอมเตี้ย: แถวผู้เล่นเตี้ยลง → 5 คนพอดีกล่อง */
@media (min-height: 501px) and (max-height: 899px) {
  .players { --pav: 2.1rem; }
  h3 { padding: 0.3rem 0.8rem; font-size: 0.92rem; }
  ul { gap: 0.3rem; padding: 0.35rem; }
  li { padding-top: 0.25rem; padding-bottom: 0.25rem; }
  .name b { font-size: 0.88rem; }
  .now { font-size: 0.64rem; }
}

/* มือถือแนวนอน: หน้าตาเหมือนคอม แต่ย่อทุกอย่างให้ 5 คนพอดีคอลัมน์แคบ ๆ */
@media (max-height: 500px) {
  .players { --pav: 1.65rem; border-radius: 14px; }
  h3 { padding: 0.22rem 0.4rem; font-size: 0.74rem; }
  ul { padding: 0.35rem 0.45rem; gap: 0.3rem; }
  /* แถวที่ถึงตามีวงแหวนเหลืองรอบรูป (ใหญ่ขึ้น) → เว้นซ้ายและช่องรูป-ชื่อ ให้ไม่ชิดกัน */
  li { gap: 0.55rem; padding: 0.35rem 0.55rem 0.35rem 0.5rem; border-radius: 0.7rem; border-width: 1px; }
  .info { gap: 0.15rem; padding-left: 0.1rem; }
  .name b { font-size: 0.7rem; line-height: 1.4; }
  .now { font-size: 0.54rem; padding: 0 0.4rem 0 0.3rem; gap: 0.2rem; }
  .pulse { width: 4px; height: 4px; }
  .stats { gap: 0.3rem; font-size: 0.56rem; line-height: 1.45; }
  .stats small { font-size: 0.5rem; }
  .dot { width: 0.36rem; height: 0.36rem; margin-right: 0.1rem; }
}

/* แบบย่อ (มือถือ): แถบรูปแนวตั้ง · ตัวเลขบนรูป = การ์ดในมือ · แตะเพื่อดูรายละเอียด */
.avw { position: relative; flex: none; display: inline-flex; margin: 0 0.1rem; } /* เผื่อวงแหวนเหลืองตอนถึงตา */
.hc {
  position: absolute; right: -5px; bottom: -3px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 999px;
  display: grid; place-items: center; font-style: normal; font-size: 0.6rem; font-weight: 700; color: #fff;
  background: #7fa9d6; border: 1.5px solid #fff;
}
.compact h3 { font-size: 0.68rem; padding: 0.25rem 0.2rem; }
.compact ul { padding: 0.3rem 0.2rem; gap: 0.3rem; align-items: stretch; }
.compact li { flex-direction: column; gap: 0.1rem; padding: 0.3rem 0.1rem 0.2rem; border-radius: 0.8rem; }
.compact .cname { font-size: 0.6rem; color: #24452b; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
