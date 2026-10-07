<script setup>
// รายละเอียดการ์ด 1 ใบ (ป๊อปอัป) — รูปการ์ด + ข้อความความรู้ + เงื่อนไข/ความสามารถ
import { computed, inject } from 'vue';
import CardImg from './CardImg.vue';
import { SYMBOL_SHORT, ABILITY_INFO } from '@/game/icons';

const props = defineProps({ id: { type: String, required: true } });
const cards = inject('cards');
const c = computed(() => cards[props.id]);
const rightNames = (keys) => keys.map((k) => Object.values(cards).find((x) => x.type === 'right' && x.key === k)?.shortName).filter(Boolean);
const typeLabel = computed(() => {
  const x = c.value;
  if (!x) return '';
  if (x.type === 'activity') return `การ์ดกิจกรรม · หมายเลข ${x.number} · ${SYMBOL_SHORT[x.symbol]}`;
  if (x.type === 'right') return `${x.kind === 'procedural' ? 'สิทธิเชิงกระบวนการ' : 'สิทธิเชิงเนื้อหา'} · ${x.points} คะแนน`;
  if (x.type === 'threat') return `ภัยคุกคาม · ทิ้งการ์ด ${x.discardCount} ใบ`;
  return 'การ์ดจบเกม';
});
const protectsNames = computed(() => {
  const x = c.value;
  if (x?.type !== 'right') return [];
  return x.protectsAgainst.map((id) => cards[id]?.name).filter(Boolean);
});
</script>

<template>
  <div v-if="c" class="info">
    <CardImg :id="id" class="big" width="min(12.5rem, 30vw, calc((100dvh - 9rem) * 0.66))" />
    <div class="txt">
      <span class="type">{{ typeLabel }}</span>
      <h4>{{ c.name }}</h4>
      <p class="body">{{ c.text }}</p>
      <template v-if="c.type === 'activity'">
        <p class="meta"><b>ใช้ทำอะไร:</b> ทิ้งเพื่อสร้างการ์ดสิทธิ (หมายเลข {{ c.number }} = {{ c.numberMeaning }})</p>
      </template>
      <template v-else-if="c.type === 'right'">
        <p class="meta"><b>เงื่อนไข:</b> {{ c.buildCondition }}</p>
        <p v-if="c.kind === 'procedural'" class="meta"><b>ความสามารถ ({{ ABILITY_INFO[c.key].title }}):</b> {{ ABILITY_INFO[c.key].text }} · ปลดล็อกให้ผู้เล่นทุกคน</p>
        <p v-if="protectsNames.length" class="meta"><b>ป้องกันภัย:</b> {{ protectsNames.join(', ') }}</p>
      </template>
      <template v-else-if="c.type === 'threat'">
        <p class="meta"><b>ป้องกันได้ด้วยสิทธิ:</b> {{ rightNames(c.protectedBy).join(', ') }}</p>
        <p class="meta">ผู้ที่ไม่ได้รับการป้องกันจะถูกสุ่มทิ้งการ์ดในมือ {{ c.discardCount }} ใบ</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.info { display: flex; gap: 1rem; align-items: flex-start; }
.info :deep(.big) { flex: none; filter: drop-shadow(0 0.4rem 0.6rem rgba(0, 0, 0, 0.25)); }
.txt { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.type {
  align-self: flex-start; font-size: 0.74rem; font-weight: 700; color: #fff; padding: 0.12rem 0.7rem; border-radius: 999px;
  background: linear-gradient(180deg, #7fd49a, #45a064); border: 2px solid #fff; box-shadow: 0 2px 0 #2f7446;
}
h4 { font-family: var(--font-head); font-size: 1.2rem; color: #24452b; line-height: 1.3; }
.body { font-size: 0.92rem; line-height: 1.55; color: var(--text); }
.meta { font-size: 0.84rem; line-height: 1.5; color: var(--text-muted); padding: 0.35rem 0.6rem; border-radius: 0.7rem; background: #f4f8f1; border: 1.5px solid #e2eedc; }
.meta b { color: var(--leaf-dark); }
@media (max-height: 500px) {
  .info { gap: 0.8rem; }
  h4 { font-size: 1.05rem; }
  .body { font-size: 0.86rem; line-height: 1.5; }
  .meta { font-size: 0.8rem; padding: 0.25rem 0.5rem; }
  .type { font-size: 0.7rem; }
}
</style>
