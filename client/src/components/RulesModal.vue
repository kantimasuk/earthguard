<script setup>
// ============================================================
// กติกาย่อ (เปิดได้จากหน้าตั้งค่าเกม และปุ่ม ? ระหว่างเล่น)
// ============================================================
// เน้นเฉพาะสิ่งที่ต้องรู้ก่อนเริ่มเล่น + ใช้รูปการ์ดจริงของเกมประกอบ
// แตะรูปการ์ดเพื่อดูขนาดใหญ่
import { ref } from 'vue';
import BaseModal from './BaseModal.vue';
import { CARD_IMAGE_URLS } from '@/game/cardImages';
import { SYMBOL_ICON, THREAT_ICON, STAR_PATH } from '@/game/icons';
import { play } from '@/services/sound';

defineProps({ open: { type: Boolean, default: false } });
defineEmits(['close']);

const img = (design) => CARD_IMAGE_URLS[design] || '';

// การ์ด 4 ชนิดในเกม
const KINDS = [
  { id: 'A-PAR-2-A', t: 'การ์ดกิจกรรม', d: 'ใช้สะสมเพื่อสร้างสิทธิ มีหมายเลข 1–3 และสัญลักษณ์ที่มุมซ้ายบน', c: '#3a7d2c' },
  { id: 'R-AIR-A', t: 'การ์ดสิทธิ', d: 'สร้างสำเร็จได้คะแนน คะแนนอยู่ในดาวมุมขวาบน', c: '#2b76ad' },
  { id: 'T-PM25', t: 'การ์ดภัยคุกคาม', d: 'โผล่ช่วงที่ 2–3 ผู้ที่ไม่ได้ป้องกันต้องทิ้งการ์ด', c: '#c0392b' },
  { id: 'E-TIP', t: 'จุดพลิกผัน', d: 'เปิดเจอเมื่อไร เกมจบทันทีและนับคะแนน', c: '#8a2a20' },
];

const STEPS = [
  { t: 'หยิบการ์ด 3 ใบ', d: 'จากกองกลาง 3×3 ทั้งแถวแนวนอนหรือแนวตั้ง', icon: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z' },
  { t: 'สร้างสิทธิ', d: 'ถ้ามีการ์ดกิจกรรมครบเงื่อนไข (สร้างได้หลายใบในตาเดียว)', icon: 'M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7Z M8.5 12l2.5 2.5 4.5-5' },
  { t: 'จบตา', d: 'ระบบเติมกองกลางให้ครบ 9 ใบ แล้วถึงตาคนถัดไป', icon: 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4 M20 12a8 8 0 0 1-14 5.3M4 20v-4h4' },
];

// สูตรสร้างสิทธิ 2 แบบ (รูปการ์ดจริง)
const BUILDS = [
  {
    t: 'สิทธิเชิงเนื้อหา', pt: '2 คะแนน', c: '#3a7d2c', soft: '#f5fbf2', edge: '#bfe0b4',
    need: 'การ์ดกิจกรรมหมายเลข 1, 2, 3 อย่างละใบ (สัญลักษณ์อะไรก็ได้)',
    from: ['A-INF-1-A', 'A-PAR-2-A', 'A-JUS-3-A'], to: 'R-AIR-A',
    extra: 'ใช้ป้องกันภัยคุกคามที่ตรงกับสิทธิได้ · ป้องกันสำเร็จครบ 2 ครั้ง +1 คะแนน',
  },
  {
    t: 'สิทธิเชิงกระบวนการ', pt: '3 คะแนน', c: '#2b76ad', soft: '#f2f8fc', edge: '#b9d3e6',
    need: 'การ์ดกิจกรรมสัญลักษณ์เดียวกับสิทธิ 3 ใบ (หมายเลขอะไรก็ได้)',
    from: ['A-INF-1-A', 'A-INF-2-A', 'A-INF-3-A'], to: 'R-INF-A',
    extra: 'เปิดความสามารถพิเศษให้ผู้เล่นทุกคนจนจบเกม (อ่านได้บนการ์ด)',
  },
];

const THREAT = [
  { t: 'มีการ์ดสิทธิที่ป้องกันได้', d: 'ปลอดภัยทันที (ดูสิทธิที่ป้องกันได้ที่ด้านล่างของการ์ดภัย)', c: '#3a7d2c', icon: 'M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7Z' },
  { t: 'ใช้เหรียญรวมกลุ่ม', d: 'เลือกแบบลับพร้อมกัน ถ้าใช้มากกว่า 1 คน ทุกคนที่ใช้ปลอดภัย', c: '#c98a12', icon: SYMBOL_ICON.PAR },
  { t: 'ไม่ได้รับการป้องกัน', d: 'ถูกสุ่มทิ้งการ์ดในมือตามจำนวนบนการ์ดภัย', c: '#c0392b', icon: THREAT_ICON },
];

// ดูการ์ดขนาดใหญ่
const zoom = ref(null);
function openZoom(id) { if (!img(id)) return; play('tap'); zoom.value = id; }
</script>

<template>
  <BaseModal :open="open" title="กติกาย่อ" width="42rem" @close="$emit('close')">
    <div class="rules">
      <!-- เป้าหมาย -->
      <section class="goal">
        <span class="gi"><svg viewBox="0 0 24 24"><path :d="STAR_PATH" /></svg></span>
        <p>สร้าง<b>การ์ดสิทธิ</b>ให้ได้คะแนนมากที่สุด ก่อนโลกเข้าสู่<b class="red">จุดพลิกผัน</b></p>
      </section>

      <!-- การ์ด 4 ชนิด -->
      <section>
        <h4>รู้จักการ์ดในเกม <em class="hint">แตะการ์ดเพื่อดูใหญ่</em></h4>
        <ul class="kinds">
          <li v-for="k in KINDS" :key="k.id" :style="{ '--c': k.c }">
            <button type="button" class="thumb" :aria-label="`ดู${k.t}`" @click="openZoom(k.id)">
              <img :src="img(k.id)" alt="" loading="lazy" draggable="false" />
            </button>
            <b>{{ k.t }}</b>
            <small>{{ k.d }}</small>
          </li>
        </ul>
      </section>

      <!-- ในแต่ละตา -->
      <section>
        <h4>ในแต่ละตา</h4>
        <ol class="steps">
          <li v-for="(s, i) in STEPS" :key="i">
            <span class="num">{{ i + 1 }}</span>
            <svg class="si" viewBox="0 0 24 24"><path :d="s.icon" /></svg>
            <div><b>{{ s.t }}</b><small>{{ s.d }}</small></div>
          </li>
        </ol>
      </section>

      <!-- สร้างสิทธิ -->
      <section>
        <h4>สร้างสิทธิ 2 แบบ</h4>
        <div class="builds">
          <div v-for="bd in BUILDS" :key="bd.t" class="build" :style="{ '--k': bd.c, '--soft': bd.soft, '--edge': bd.edge }">
            <header><b>{{ bd.t }}</b><span class="pt">{{ bd.pt }}</span></header>
            <p class="need">{{ bd.need }}</p>
            <div class="formula">
              <button v-for="(f, i) in bd.from" :key="i" type="button" class="thumb sm" @click="openZoom(f)">
                <img :src="img(f)" alt="" loading="lazy" draggable="false" />
              </button>
              <span class="arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 12h15 M13 6l6 6-6 6" /></svg>
              </span>
              <button type="button" class="thumb sm result" @click="openZoom(bd.to)">
                <img :src="img(bd.to)" alt="" loading="lazy" draggable="false" />
              </button>
            </div>
            <small>{{ bd.extra }}</small>
          </div>
        </div>
      </section>

      <!-- ภัยคุกคาม -->
      <section>
        <h4>เมื่อเปิดเจอภัยคุกคาม <em>ช่วงที่ 2–3</em></h4>
        <div class="threat">
          <button type="button" class="thumb md" @click="openZoom('T-PM25')">
            <img :src="img('T-PM25')" alt="" loading="lazy" draggable="false" />
          </button>
          <ul>
            <li v-for="(s, i) in THREAT" :key="i" :style="{ '--c': s.c }">
              <span class="ti"><svg viewBox="0 0 24 24"><path :d="s.icon" /></svg></span>
              <div><b>{{ s.t }}</b><small>{{ s.d }}</small></div>
            </li>
          </ul>
        </div>
      </section>

      <!-- จบเกม -->
      <section>
        <h4>จบเกมและนับคะแนน</h4>
        <div class="end">
          <button type="button" class="thumb md" @click="openZoom('E-TIP')">
            <img :src="img('E-TIP')" alt="" loading="lazy" draggable="false" />
          </button>
          <div class="end-text">
            <p>เกมจบทันทีเมื่อเปิดเจอ<b class="red">การ์ดจุดพลิกผัน</b> (อยู่ในกองช่วงที่ 3) แล้วนับคะแนนของทุกคน</p>
            <div class="score">
              <span class="chip g">คะแนนการ์ดสิทธิ</span><i>+</i>
              <span class="chip g">โบนัสป้องกัน</span><i>−</i>
              <span class="chip r">เหรียญที่เหลือ (เหรียญละ 1)</span>
            </div>
            <small>คะแนนเท่ากัน → ผู้ที่ป้องกันภัยสำเร็จหลายครั้งกว่าชนะ</small>
          </div>
        </div>
      </section>
    </div>
  </BaseModal>

  <!-- ดูการ์ดขนาดใหญ่ (แตะที่ใดก็ได้เพื่อปิด) -->
  <Teleport to="body">
    <Transition name="zoom">
      <div v-if="open && zoom" class="zoom" role="dialog" aria-label="รูปการ์ด" @click="zoom = null">
        <img :src="img(zoom)" alt="" draggable="false" />
        <span class="zoom-hint">แตะเพื่อปิด</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.rules { display: flex; flex-direction: column; gap: 1.15rem; font-size: 0.92rem; line-height: 1.45; color: var(--text); }
h4 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.02rem; color: var(--accent); margin-bottom: 0.55rem; }
h4::before { content: ''; flex: none; width: 4px; height: 1em; border-radius: 2px; background: var(--leaf, #3a7d2c); }
h4 em { font-style: normal; font-size: 0.72rem; font-weight: 600; color: #b8433a; background: #fdecea; padding: 0.05rem 0.5rem; border-radius: 999px; }
h4 em.hint { margin-left: auto; color: var(--text-muted); background: #f1f4ee; }
b { color: var(--leaf-dark); }
b.red { color: #c0392b; }
small { display: block; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; }
svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
p { margin: 0; }

/* รูปการ์ดจริง (แตะเพื่อดูใหญ่) */
.thumb {
  display: block; padding: 0; border: 0; background: none; cursor: zoom-in; flex: none;
  width: 5.2rem; aspect-ratio: 5 / 7; border-radius: 7%;
  box-shadow: 0 4px 12px rgba(20, 40, 20, 0.2); transition: transform 0.15s var(--ease-out);
}
.thumb:hover { transform: translateY(-3px) rotate(-1deg); }
.thumb:active { transform: scale(0.96); }
.thumb img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.thumb.sm { width: 3.3rem; box-shadow: 0 2px 7px rgba(20, 40, 20, 0.18); }
.thumb.md { width: 4.6rem; }

.goal {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 0.9rem; border-radius: 0.9rem;
  background: linear-gradient(135deg, #fff7dc, #eef8e8); border: 1px solid #f1e2b0;
}
.goal p { font-size: 0.98rem; }
.gi { width: 2.3rem; height: 2.3rem; flex: none; border-radius: 50%; display: grid; place-items: center; background: #f0b429; color: #fff; }
.gi svg { width: 1.3rem; height: 1.3rem; fill: #fff; stroke: none; }

.kinds { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem; }
.kinds li {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.3rem;
  padding: 0.7rem 0.45rem 0.65rem; border-radius: 0.85rem;
  background: color-mix(in srgb, var(--c) 6%, #fff); border: 1.5px solid color-mix(in srgb, var(--c) 22%, #fff);
}
.kinds b { color: var(--c); font-size: 0.92rem; margin-top: 0.15rem; }
.kinds small { font-size: 0.76rem; }

.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
.steps li {
  position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.2rem;
  padding: 0.75rem 0.5rem 0.65rem; border-radius: 0.8rem; background: #f4f8f1; border: 1px solid #e0eadb;
}
.num {
  position: absolute; top: -0.5rem; left: -0.4rem; width: 1.45rem; height: 1.45rem; border-radius: 50%;
  display: grid; place-items: center; font-weight: 700; font-size: 0.8rem; color: #fff; background: var(--leaf, #3a7d2c);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}
.si { width: 1.7rem; height: 1.7rem; color: var(--leaf, #3a7d2c); }
.steps b { font-size: 0.92rem; }

.builds { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.build { padding: 0.7rem 0.8rem; border-radius: 0.85rem; border: 1.5px solid var(--edge); background: var(--soft); display: flex; flex-direction: column; gap: 0.45rem; }
.build header { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; }
.build header b { color: var(--k); }
.pt { flex: none; font-size: 0.72rem; font-weight: 700; color: #fff; background: var(--k); padding: 0.1rem 0.55rem; border-radius: 999px; }
.need { font-size: 0.84rem; font-weight: 600; }
.formula { display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.3rem 0; }
.arrow { width: 1.6rem; height: 1.6rem; flex: none; display: grid; place-items: center; color: var(--k); }
.arrow svg { width: 100%; height: 100%; stroke-width: 2.6; }
.thumb.result { outline: 3px solid var(--k); outline-offset: 2px; }

.threat, .end { display: flex; align-items: center; gap: 0.9rem; }
.threat ul { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.threat li { display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.65rem; border-radius: 0.7rem; background: #f7f8f6; }
.threat li b { color: var(--c); }
.ti { width: 2rem; height: 2rem; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--c); color: #fff; }
.ti svg { width: 1.15rem; height: 1.15rem; }
.end-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.score { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; }
.score i { font-style: normal; font-weight: 700; font-size: 1.1rem; color: var(--text-muted); }
.chip { padding: 0.25rem 0.7rem; border-radius: 999px; font-weight: 600; font-size: 0.85rem; }
.chip.g { background: #e6f4df; color: #2f6b25; }
.chip.r { background: #fdecea; color: #b8433a; }

/* ดูการ์ดใหญ่ */
.zoom {
  position: fixed; inset: 0; z-index: 3000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6rem;
  padding: calc(var(--safe-t) + 16px) 16px calc(var(--safe-b) + 16px);
  background: rgba(20, 35, 25, 0.72); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); cursor: zoom-out;
}
.zoom img { height: min(78vh, 30rem); max-width: 90vw; aspect-ratio: 5 / 7; object-fit: contain; border-radius: 4%; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45); }
.zoom-hint { color: #fff; font-size: 0.85rem; opacity: 0.85; }
.zoom-enter-active, .zoom-leave-active { transition: opacity 0.2s; }
.zoom-enter-active img { transition: transform 0.3s var(--ease-back); }
.zoom-enter-from, .zoom-leave-to { opacity: 0; }
.zoom-enter-from img { transform: scale(0.7); }

/* โทรศัพท์แนวนอน: ตัวอักษรเล็กลงนิด เว้นช่องไฟให้อ่านง่าย */
@media (max-height: 500px) {
  .rules { font-size: 0.86rem; line-height: 1.5; gap: 1.2rem; padding: 0.3rem 0.1rem 0.6rem; }
  h4 { margin-bottom: 0.55rem; font-size: 0.95rem; }
  small { font-size: 0.74rem; line-height: 1.45; }
  .goal { padding: 0.55rem 0.8rem; }
  .goal p { font-size: 0.88rem; }
  .gi { width: 1.9rem; height: 1.9rem; }
  .thumb { width: 4.2rem; }
  .thumb.sm { width: 2.8rem; }
  .thumb.md { width: 3.8rem; }
  .kinds { gap: 0.5rem; }
  .kinds li { padding: 0.55rem 0.4rem 0.5rem; }
  .kinds small { font-size: 0.7rem; }
  .steps { gap: 0.6rem; padding-top: 0.3rem; }
  .steps li { flex-direction: row; text-align: left; padding: 0.6rem 0.6rem 0.55rem 0.8rem; gap: 0.5rem; }
  .si { width: 1.35rem; height: 1.35rem; flex: none; }
  .build { padding: 0.6rem 0.7rem; }
  .need { font-size: 0.78rem; }
  .threat li { padding: 0.4rem 0.6rem; }
  .ti { width: 1.75rem; height: 1.75rem; }
  .zoom img { height: min(84vh, 24rem); }
}
@media (max-width: 620px) {
  .steps, .builds { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .kinds { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
