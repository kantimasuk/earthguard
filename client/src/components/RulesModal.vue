<script setup>
// กติกาย่อ (เปิดได้จากหน้าตั้งค่าเกม และปุ่ม ? ระหว่างเล่น)
// จัดเป็นการ์ดย่อย ๆ + ไอคอน อ่านทีละก้อน ไม่ต้องอ่านเป็นย่อหน้ายาว
import BaseModal from './BaseModal.vue';
import { ABILITY_INFO, SYMBOL_ICON, SYMBOL_COLOR, THREAT_ICON, STAR_PATH } from '@/game/icons';

defineProps({ open: { type: Boolean, default: false } });
defineEmits(['close']);

const STEPS = [
  { t: 'หยิบการ์ด 3 ใบ', d: 'จากกองกลาง 3×3 แถวแนวนอนหรือแนวตั้ง (แตะลูกศรข้างแถว)', icon: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z' },
  { t: 'สร้างสิทธิ', d: 'ถ้ามีการ์ดครบเงื่อนไข สร้างได้หลายใบในตาเดียว', icon: 'M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7Z M8.5 12l2.5 2.5 4.5-5' },
  { t: 'ส่งตาต่อ', d: 'ระบบเติมกองกลางให้ครบ 9 ใบ แล้วถึงตาคนถัดไป', icon: 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4 M20 12a8 8 0 0 1-14 5.3M4 20v-4h4' },
];
const THREAT = [
  { t: 'มีสิทธิที่ป้องกันได้', d: 'ปลอดภัยทันที', c: '#3a7d2c', icon: 'M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7Z' },
  { t: 'ใช้เหรียญรวมกลุ่ม', d: 'เลือกแบบลับ ถ้าใช้พร้อมกันมากกว่า 1 คน ทุกคนที่ใช้ปลอดภัย', c: '#c98a12', icon: SYMBOL_ICON.PAR },
  { t: 'ยังไม่ปลอดภัย', d: 'ถูกสุ่มทิ้งการ์ดในมือ การ์ดสิทธิที่หลุดไปอยู่โซนสิทธิสาธารณะ', c: '#c0392b', icon: THREAT_ICON },
];
</script>

<template>
  <BaseModal :open="open" title="กติกาย่อ" width="40rem" @close="$emit('close')">
    <div class="rules">
      <!-- เป้าหมาย -->
      <section class="goal">
        <span class="gi"><svg viewBox="0 0 24 24"><path :d="STAR_PATH" /></svg></span>
        <p>สร้าง<b>การ์ดสิทธิ</b>ให้ได้คะแนนมากที่สุด ก่อนโลกเข้าสู่<b class="red">จุดพลิกผัน</b> (การ์ดจบเกม)</p>
      </section>

      <!-- ในแต่ละตา -->
      <section>
        <h4>ในแต่ละตา</h4>
        <ol class="steps">
          <li v-for="(s, i) in STEPS" :key="i">
            <span class="num">{{ i + 1 }}</span>
            <svg class="si" viewBox="0 0 24 24"><path :d="s.icon" /></svg>
            <b>{{ s.t }}</b>
            <small>{{ s.d }}</small>
          </li>
        </ol>
      </section>

      <!-- เงื่อนไขการสร้างสิทธิ -->
      <section>
        <h4>สร้างสิทธิยังไง</h4>
        <div class="kinds">
          <div class="kind sub">
            <header><b>สิทธิเชิงเนื้อหา</b><span class="pt">2 คะแนน</span></header>
            <p class="need">ทิ้งการ์ดกิจกรรม <span class="n">1</span><span class="n">2</span><span class="n">3</span> อย่างละใบ</p>
            <small>ป้องกันภัยคุกคามที่ตรงกับสิทธิ · ป้องกันครบ 2 ครั้ง <b>+1</b></small>
          </div>
          <div class="kind pro">
            <header><b>สิทธิเชิงกระบวนการ</b><span class="pt">3 คะแนน</span></header>
            <p class="need">ทิ้งการ์ดกิจกรรม <b>สัญลักษณ์เดียวกับสิทธิ</b> <span class="n">×3</span></p>
            <small>ปลดล็อกความสามารถพิเศษให้ทุกคน</small>
          </div>
        </div>
        <p class="tip"><svg viewBox="0 0 24 24"><path d="M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /></svg>การ์ดใน<b>โซนสิทธิสาธารณะ</b> ใครมีการ์ดกิจกรรมครบก็สร้างได้เลย ไม่ต้องมีการ์ดสิทธิในมือ</p>
      </section>

      <!-- ภัยคุกคาม -->
      <section>
        <h4>ภัยคุกคาม <em>ช่วงที่ 2–3</em></h4>
        <ul class="threat">
          <li v-for="(s, i) in THREAT" :key="i" :style="{ '--c': s.c }">
            <span class="ti"><svg viewBox="0 0 24 24"><path :d="s.icon" /></svg></span>
            <div><b>{{ s.t }}</b><small>{{ s.d }}</small></div>
          </li>
        </ul>
      </section>

      <!-- ความสามารถพิเศษ -->
      <section>
        <h4>ความสามารถพิเศษ</h4>
        <ul class="abil">
          <li v-for="k in ['INF', 'PAR', 'JUS']" :key="k" :style="{ '--c': SYMBOL_COLOR[k].band, '--ink': SYMBOL_COLOR[k].ink, '--soft': SYMBOL_COLOR[k].soft }">
            <span class="ai"><svg viewBox="0 0 24 24"><path :d="SYMBOL_ICON[k]" /></svg></span>
            <div><b>{{ ABILITY_INFO[k].title }}</b><small>{{ ABILITY_INFO[k].text }}</small></div>
          </li>
        </ul>
      </section>

      <!-- นับคะแนน -->
      <section>
        <h4>นับคะแนน</h4>
        <div class="score">
          <span class="chip g">คะแนนสิทธิ</span><i>+</i>
          <span class="chip g">โบนัสป้องกัน</span><i>−</i>
          <span class="chip r">เหรียญที่เหลือ (ละ 1)</span>
        </div>
        <small class="muted">คะแนนเท่ากัน → ดูจำนวนครั้งที่ป้องกันได้</small>
      </section>
    </div>
  </BaseModal>
</template>

<style scoped>
.rules { display: flex; flex-direction: column; gap: 1rem; font-size: 0.92rem; line-height: 1.45; color: var(--text); }
h4 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.02rem; color: var(--accent); margin-bottom: 0.45rem; }
h4::before { content: ''; width: 4px; height: 1em; border-radius: 2px; background: var(--leaf, #3a7d2c); }
h4 em { font-style: normal; font-size: 0.72rem; font-weight: 600; color: #b8433a; background: #fdecea; padding: 0.05rem 0.5rem; border-radius: 999px; }
b { color: var(--leaf-dark); }
b.red { color: #c0392b; }
small { display: block; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; }
svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.goal {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 0.9rem; border-radius: 0.9rem;
  background: linear-gradient(135deg, #fff7dc, #eef8e8); border: 1px solid #f1e2b0;
}
.goal p { margin: 0; font-size: 0.98rem; }
.gi { width: 2.3rem; height: 2.3rem; flex: none; border-radius: 50%; display: grid; place-items: center; background: #f0b429; color: #fff; }
.gi svg { width: 1.3rem; height: 1.3rem; fill: #fff; stroke: none; }

.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.55rem; }
.steps li {
  position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.15rem;
  padding: 0.75rem 0.5rem 0.6rem; border-radius: 0.8rem; background: #f4f8f1; border: 1px solid #e0eadb;
}
.num {
  position: absolute; top: -0.5rem; left: -0.4rem; width: 1.45rem; height: 1.45rem; border-radius: 50%;
  display: grid; place-items: center; font-weight: 700; font-size: 0.8rem; color: #fff; background: var(--leaf, #3a7d2c);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}
.si { width: 1.7rem; height: 1.7rem; color: var(--leaf, #3a7d2c); }
.steps b { font-size: 0.92rem; }

.kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
.kind { padding: 0.6rem 0.75rem; border-radius: 0.8rem; border: 1.5px solid; display: flex; flex-direction: column; gap: 0.3rem; }
.kind.sub { border-color: #bfe0b4; background: #f5fbf2; --k: #3a7d2c; }
.kind.pro { border-color: #b9d3e6; background: #f2f8fc; --k: #2b76ad; }
.kind header { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; }
.kind header b { color: var(--k); }
.pt { flex: none; font-size: 0.72rem; font-weight: 700; color: #fff; background: var(--k); padding: 0.1rem 0.5rem; border-radius: 999px; }
.need { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem; }
.n { min-width: 1.45rem; height: 1.45rem; padding: 0 0.3rem; border-radius: 0.4rem; display: inline-grid; place-items: center; font-weight: 700; font-size: 0.82rem; background: #fff; border: 1.5px solid var(--k); color: var(--k); }
.tip svg { width: 1.1rem; height: 1.1rem; flex: none; color: #c98a12; }
.tip { display: flex; align-items: flex-start; gap: 0.4rem; margin: 0.5rem 0 0; padding: 0.45rem 0.7rem; border-radius: 0.6rem; background: #fffaf0; font-size: 0.82rem; border: 1px dashed #efd9a6; }

.threat, .abil { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.threat li, .abil li { display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.6rem; border-radius: 0.7rem; background: #f7f8f6; }
.threat li b { color: var(--c); }
.ti, .ai { width: 2.1rem; height: 2.1rem; flex: none; border-radius: 50%; display: grid; place-items: center; }
.ti { background: var(--c); color: #fff; }
.ai { background: var(--soft); color: var(--ink); border: 2px solid var(--c); }
.ti svg, .ai svg { width: 1.2rem; height: 1.2rem; }
.abil li { background: color-mix(in srgb, var(--soft) 60%, #fff); }
.abil b { color: var(--ink); }

.score { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.3rem; }
.score i { font-style: normal; font-weight: 700; font-size: 1.1rem; color: var(--text-muted); }
.chip { padding: 0.25rem 0.7rem; border-radius: 999px; font-weight: 600; font-size: 0.85rem; }
.chip.g { background: #e6f4df; color: #2f6b25; }
.chip.r { background: #fdecea; color: #b8433a; }
.muted { margin: 0; }

/* จอมือถือแนวนอน: ตัวอักษรเล็กลงนิด ช่องไฟแคบลง */
@media (max-height: 500px) {
  .rules { font-size: 0.84rem; gap: 0.75rem; }
  small { font-size: 0.72rem; }
  .goal { padding: 0.5rem 0.7rem; }
  .goal p { font-size: 0.86rem; }
  .gi { width: 1.9rem; height: 1.9rem; }
  .steps li { padding: 0.55rem 0.4rem 0.45rem; }
  .si { width: 1.35rem; height: 1.35rem; }
  .ti, .ai { width: 1.8rem; height: 1.8rem; }
}
@media (max-width: 520px) {
  .steps, .kinds { grid-template-columns: 1fr; }
}
</style>
