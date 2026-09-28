<script setup>
// ป๊อปอัป "สร้างสิทธิ": แสดงสิทธิที่สร้างได้ + การ์ดกิจกรรมที่ระบบเลือกทิ้งให้ (เปลี่ยนเองได้)
import { computed, inject, reactive, watch } from 'vue';
import BaseModal from '@/components/BaseModal.vue';
import CardImg from './CardImg.vue';
import TimerRing from './TimerRing.vue';
import { SYMBOL_SHORT } from '@/game/icons';
import { play } from '@/services/sound';

const props = defineProps({
  open: { type: Boolean, default: false },
  options: { type: Array, default: () => [] }, // [{ right, from, discards }]
  hand: { type: Array, default: () => [] },
  timer: { type: Object, default: null },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['build', 'end', 'close']);
const cards = inject('cards');

// การ์ดที่จะทิ้งของแต่ละตัวเลือก (เริ่มจากที่ระบบแนะนำ)
const picks = reactive({});
const editing = reactive({});
watch(() => props.options, (opts) => {
  for (const k of Object.keys(picks)) delete picks[k];
  for (const k of Object.keys(editing)) delete editing[k];
  for (const o of opts) picks[o.right] = o.discards.slice();
}, { immediate: true, deep: true });

const acts = computed(() => props.hand.filter((id) => cards[id]?.type === 'activity'));

/** ตัวเลือกการ์ดที่ใช้ทิ้งได้ของสิทธิใบนี้ */
function candidates(rightId) {
  const r = cards[rightId];
  if (r.kind === 'substantive') {
    return [1, 2, 3].map((n) => ({ n, ids: acts.value.filter((id) => cards[id].number === n) }));
  }
  return [{ n: null, ids: acts.value.filter((id) => cards[id].symbol === r.symbol) }];
}

function toggle(rightId, id) {
  play('tap');
  const r = cards[rightId];
  const cur = picks[rightId] || [];
  if (r.kind === 'substantive') {
    const n = cards[id].number;
    picks[rightId] = [...cur.filter((x) => cards[x].number !== n), id];
  } else if (cur.includes(id)) {
    picks[rightId] = cur.filter((x) => x !== id);
  } else if (cur.length < 3) {
    picks[rightId] = [...cur, id];
  }
}

function valid(rightId) {
  const r = cards[rightId];
  const p = picks[rightId] || [];
  if (p.length !== 3) return false;
  if (r.kind === 'substantive') return p.map((id) => cards[id].number).sort().join('') === '123';
  return p.every((id) => cards[id].symbol === r.symbol);
}

function build(o) {
  if (!valid(o.right) || props.busy) return;
  emit('build', { right: o.right, discards: picks[o.right].slice() });
}
</script>

<template>
  <BaseModal :open="open" title="สร้างสิทธิ" width="40rem" @close="emit('close')">
    <div class="head-row">
      <p class="lead">สร้างได้ {{ options.length }} แบบ · เลือกสร้างได้หลายใบในตาเดียว</p>
      <TimerRing v-if="timer" :deadline="timer.deadline" :duration="timer.duration" :size="40" />
    </div>

    <div class="opts">
      <article v-for="o in options" :key="o.right" class="opt">
        <CardImg :id="o.right" width="4.6rem" />
        <div class="mid">
          <div class="title">
            <b>{{ cards[o.right].shortName }}</b>
            <span class="pts">+{{ cards[o.right].points }} คะแนน</span>
            <span v-if="o.from === 'public'" class="pub">จากโซนสาธารณะ</span>
          </div>
          <p class="cond">{{ cards[o.right].buildCondition }}</p>

          <div v-if="!editing[o.right]" class="discards">
            <span class="lbl">ทิ้ง:</span>
            <CardImg v-for="d in picks[o.right]" :id="d" :key="d" width="2.5rem" />
            <button type="button" class="link-btn" @click="play('click'); editing[o.right] = true">เปลี่ยนใบที่ทิ้ง</button>
          </div>

          <div v-else class="edit">
            <div v-for="grp in candidates(o.right)" :key="String(grp.n)" class="grp">
              <span class="lbl">{{ grp.n ? `หมายเลข ${grp.n}` : `สัญลักษณ์ ${SYMBOL_SHORT[cards[o.right].symbol]} (เลือก 3)` }}</span>
              <div class="choices">
                <button
                  v-for="id in grp.ids"
                  :key="id"
                  type="button"
                  class="choice"
                  :class="{ on: picks[o.right]?.includes(id) }"
                  @click="toggle(o.right, id)"
                >
                  <CardImg :id="id" width="2.5rem" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="btn build" :disabled="!valid(o.right) || busy" @click="build(o)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.3l6-.8Z" /></svg>
          สร้าง
        </button>
      </article>
    </div>

    <div class="foot">
      <button type="button" class="btn btn--light" :disabled="busy" @click="play('click'); emit('end')">ไม่สร้างแล้ว · จบตา</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.head-row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-bottom: 0.5rem; }
.lead { font-size: 0.88rem; color: var(--text-muted); }
.opts { display: flex; flex-direction: column; gap: 0.6rem; }
.opt {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.8rem; align-items: center;
  padding: 0.6rem 0.7rem; border-radius: 1rem; background: #f6f8f3; border: 1.5px solid #e3eadf;
}
.mid { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.title { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
.title b { font-size: 1.05rem; }
.pts { font-size: 0.75rem; font-weight: 700; color: #6b4500; background: #ffe8a3; padding: 0.05rem 0.5rem; border-radius: 999px; }
.pub { font-size: 0.7rem; font-weight: 600; color: #1f6d9e; background: #dff0fb; padding: 0.05rem 0.5rem; border-radius: 999px; }
.cond { font-size: 0.78rem; color: var(--text-muted); }
.discards { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
.lbl { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }
.edit { display: flex; flex-direction: column; gap: 0.35rem; }
.grp { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.grp .lbl { min-width: 4.4rem; }
.choices { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.choice { padding: 2px; border-radius: 8px; border: 2px solid transparent; background: none; cursor: pointer; }
.choice.on { border-color: #f0b429; background: #fff4d6; }
.build { min-width: 5.5rem; }
.build svg { width: 1rem; height: 1rem; fill: currentColor; }
.foot { display: flex; justify-content: flex-end; margin-top: 0.7rem; }
@media (max-height: 500px) {
  .opt { gap: 0.55rem; padding: 0.45rem 0.55rem; }
  .title b { font-size: 0.9rem; }
  .cond { font-size: 0.68rem; }
  .build { min-width: 4.5rem; font-size: 0.85rem; min-height: 36px; }
  .foot .btn { font-size: 0.8rem; min-height: 34px; }
}
</style>
