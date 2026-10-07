<script setup>
// ============================================================
// การ์ดของเรา (การ์ดจริง แตะดูรายละเอียดได้) แบ่งเป็น 3 ส่วนตามไวร์เฟรม
//   acts   = การ์ดในมือ (การ์ดกิจกรรม)
//   rights = การ์ดสิทธิในมือ (บอกด้วยว่า "สร้างได้!" หรือยังขาดอะไร)
//   built  = สิทธิที่สร้างแล้ว (บอกจำนวนครั้งที่ป้องกันได้)
// ============================================================
// ขนาดการ์ดปรับตามความสูงของแต่ละส่วนอัตโนมัติ (v-fit วัดความสูงแถว → --rh)
// การ์ดเยอะจนล้นความกว้าง → ช่องแต่ละใบหดลง (flex-shrink) แต่รูปการ์ดยังเต็มใบ → ซ้อนกันเอง
import { computed, inject } from 'vue';
import { missingFor } from '@/game/reduce';

const props = defineProps({
  hand: { type: Array, default: () => [] },
  built: { type: Array, default: () => [] },
  sections: { type: Array, default: () => ['acts', 'rights', 'built'] },
  single: { type: Boolean, default: false }, // มือถือ: แสดงทีละส่วนในป๊อปอัปลอย
  hidden: { type: Array, default: () => [] }, // การ์ดที่กำลังบิน (ซ่อนใบจริงไว้ระหว่างแอนิเมชัน)
  pulse: { type: String, default: null },     // การ์ดที่เพิ่งสร้าง (เรืองแสงแป๊บหนึ่ง)
});
const emit = defineEmits(['card']);
const cards = inject('cards');
const art = inject('cardArt');

const SYM = { INF: 0, PAR: 1, JUS: 2 };
const acts = computed(() => props.hand
  .filter((id) => cards[id]?.type === 'activity')
  .sort((a, b) => (SYM[cards[a].symbol] - SYM[cards[b].symbol]) || (cards[a].number - cards[b].number)));
const rights = computed(() => props.hand.filter((id) => cards[id]?.type === 'right'));

function status(id) {
  const c = cards[id];
  const miss = missingFor(c, props.hand, cards);
  if (c.kind === 'substantive') return miss.length ? `ขาดหมายเลข ${miss.join(', ')}` : '';
  return miss ? `ขาดอีก ${miss} ใบ` : '';
}
const TITLES = { acts: 'การ์ดในมือ', rights: 'การ์ดสิทธิในมือ', built: 'สิทธิที่สร้างแล้ว' };
const EMPTY = {
  acts: 'ยังไม่มีการ์ดกิจกรรม · หยิบจากกองกลางในตาของคุณ',
  rights: 'ยังไม่มีการ์ดสิทธิในมือ',
  built: 'ยังไม่ได้สร้างสิทธิ',
};
const list = (k) => (k === 'acts' ? acts.value : k === 'rights' ? rights.value : props.built.map((b) => b.card));
const protects = (id) => props.built.find((b) => b.card === id)?.protects || 0;
</script>

<template>
  <div class="mycards" :class="{ single }">
    <section v-for="k in sections" :key="k" class="sec" :class="k" :data-anchor="k === 'built' ? 'me:built' : k === 'acts' ? 'me:hand' : null">
      <h4>{{ TITLES[k] }} <span>({{ list(k).length }})</span></h4>
      <div v-fit class="row">
        <button
          v-for="id in list(k)"
          :key="id"
          type="button"
          class="card"
          :class="{ flying: hidden.includes(id), fresh: pulse === id && k === 'built' }"
          :data-card="id"
          :aria-label="cards[id]?.name"
          @click="emit('card', id)"
        >
          <img :src="art.url(id)" alt="" draggable="false" />
          <template v-if="k === 'rights'">
            <span v-if="!status(id)" class="tag ok">สร้างได้!</span>
            <span v-else class="tag">{{ status(id) }}</span>
          </template>
          <span v-if="k === 'built' && cards[id]?.kind === 'substantive'" class="prot" :class="{ full: protects(id) >= 2 }" :title="`ป้องกันได้ ${protects(id)} ครั้ง`">{{ protects(id) }}</span>
        </button>
        <p v-if="!list(k).length" class="empty">{{ EMPTY[k] }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mycards { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.sec {
  flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;
  padding: 0.4rem 0.55rem 0.55rem; border-radius: 1rem;
  background: rgba(255, 255, 255, 0.55); border: 1.5px solid rgba(255, 255, 255, 0.85);
}
.sec.acts { flex-grow: 1.25; }
h4 { margin: 0 0 0.3rem 0.15rem; font-size: 0.88rem; font-weight: 700; color: #2f5a3a; }
h4 span { color: #6d8a73; font-weight: 600; }
.row {
  flex: 1; min-height: 0; display: flex; align-items: stretch;
}
/* --rh = ความสูงจริงของแถว (วัดด้วย v-fit แทน container query ที่เครื่องรุ่นเก่าไม่รองรับ) */
.card {
  position: relative; flex: 0 1 calc(var(--rh, 6rem) * 0.714); min-width: 0; height: 100%;
  padding: 0; border: 0; background: none; cursor: pointer; overflow: visible;
  transition: transform 0.15s ease;
}
.card + .card { margin-left: 0.3rem; }
.card:last-child { flex-shrink: 0; }
.card img {
  display: block; height: var(--rh, 6rem); width: auto; max-width: none; aspect-ratio: 5 / 7;
  border-radius: 7%/5%; box-shadow: 0 2px 8px rgba(40, 70, 50, 0.22);
}
.card:hover { transform: translateY(-4px); z-index: 1; }
.card.flying { visibility: hidden; }
.card.fresh img { animation: fresh 1.4s ease-out; }
@keyframes fresh {
  0% { box-shadow: 0 0 0 0 rgba(255, 214, 102, 0.9), 0 2px 8px rgba(40, 70, 50, 0.22); transform: scale(1.08); }
  40% { box-shadow: 0 0 0 6px rgba(255, 214, 102, 0.6), 0 0 22px 6px rgba(255, 214, 102, 0.6); transform: scale(1); }
  100% { box-shadow: 0 0 0 0 rgba(255, 214, 102, 0), 0 2px 8px rgba(40, 70, 50, 0.22); }
}
.tag {
  position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); white-space: nowrap;
  padding: 0.05rem 0.45rem; border-radius: 999px; font-size: 0.66rem; font-weight: 700;
  background: rgba(255, 255, 255, 0.95); color: #8a5a00; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.tag.ok { background: #6cc788; color: #fff; }
.prot {
  position: absolute; right: -0.3rem; top: -0.3rem; width: 1.45rem; height: 1.45rem; border-radius: 50%;
  display: grid; place-items: center; font-size: 0.78rem; font-weight: 700; color: #fff;
  background: #5fae6e; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.prot.full { background: #f0b429; }
.empty { margin: auto; font-size: 0.8rem; color: #7d8e80; text-align: center; }

/* ป๊อปอัปลอยบนมือถือ: ส่วนเดียว เต็มกล่อง */
.single .sec { background: transparent; border: 0; padding: 0; }
.single h4 { font-size: 1rem; }
@media (max-height: 500px) {
  h4 { font-size: 0.78rem; }
  .tag { font-size: 0.58rem; }
  .prot { width: 1.2rem; height: 1.2rem; font-size: 0.66rem; }
}
</style>
