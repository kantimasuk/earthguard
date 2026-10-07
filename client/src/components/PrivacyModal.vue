<script setup>
// ============================================================
// ป๊อปอัปนโยบายความเป็นส่วนตัว — ใช้ BaseModal เดียวกับป๊อปอัปอื่นของเกม
// ============================================================
// mode = 'read'    เปิดอ่าน (ปิดได้)  · จากลิงก์หน้าเข้าสู่ระบบ/สมัคร, เมนูโปรไฟล์, หน้าตั้งค่า
// mode = 'consent' ขอความยินยอม (ปิดไม่ได้ ต้องเลือก) · แสดงครั้งเดียวต่อบัญชีต่อเวอร์ชันของนโยบาย
import { ref, watch, nextTick } from 'vue';
import BaseModal from './BaseModal.vue';
import {
  PRIVACY_VERSION, PRIVACY_UPDATED, PRIVACY_CONTACT_EMAIL, PRIVACY_SUMMARY, PRIVACY_SECTIONS,
} from '@/data/privacy';
import { play } from '@/services/sound';

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'read' }, // read | consent
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
});
const emit = defineEmits(['close', 'accept', 'decline']);
const root = ref(null);

// **ตัวหนา** → แยกเป็นชิ้น ๆ เพื่อแสดงผล (ไม่ใช้ v-html)
const parts = (text) => text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  .map((t) => (t.startsWith('**') ? { b: true, t: t.slice(2, -2) } : { b: false, t }));

// หัวข้อ "1. ข้อมูลที่..." → แยกเลขกับชื่อ · สีของหัวข้อตามการ์ดสรุป (ถ้ามี)
const SUM_COLOR = Object.fromEntries(PRIVACY_SUMMARY.map((x) => [x.id, x.c]));
const SECTIONS = [
  ...PRIVACY_SECTIONS,
  { id: 'contact', h: '7. ติดต่อเรา', contact: true },
].map((sec) => {
  const m = sec.h.match(/^(\d+)\.\s*(.*)$/);
  return { ...sec, num: m ? m[1] : null, title: m ? m[2] : sec.h, c: SUM_COLOR[sec.id] || '#3a7d2c' };
});

function jump(id) {
  play('tap');
  root.value?.querySelector(`[data-sec="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// เปิดใหม่ทุกครั้ง → เริ่มอ่านจากด้านบน
watch(() => props.open, async (v) => {
  if (!v) return;
  await nextTick();
  root.value?.closest('.body')?.scrollTo({ top: 0 });
});
</script>

<template>
  <BaseModal :open="open" title="นโยบายความเป็นส่วนตัว" width="40rem" :closable="mode === 'read'" @close="emit('close')">
    <div ref="root" class="pp" :class="{ consenting: mode === 'consent' }">
      <!-- ขอความยินยอม: บอกเหตุผลสั้น ๆ ก่อน -->
      <div v-if="mode === 'consent'" class="lead">
        <span class="lead-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7Z M8.5 12l2.5 2.5 4.5-5" /></svg></span>
        <p>ก่อนเริ่มเล่น กรุณาอ่านและยอมรับนโยบายนี้ เพื่อให้เราบันทึกผลการเล่นและผลการเรียนรู้ของคุณได้</p>
      </div>

      <!-- สรุป 4 ข้อ: แตะเพื่อไปยังหัวข้อนั้น -->
      <nav class="sum" aria-label="สรุปนโยบาย">
        <button v-for="x in PRIVACY_SUMMARY" :key="x.id" type="button" :style="{ '--c': x.c }" @click="jump(x.id)">
          <span class="si"><svg viewBox="0 0 24 24"><path :d="x.icon" /></svg></span>
          <span class="st">
            <b>{{ x.t }}</b>
            <small>{{ x.d }}</small>
          </span>
        </button>
      </nav>

      <!-- เนื้อหาเต็ม -->
      <section v-for="sec in SECTIONS" :key="sec.id" class="sec" :data-sec="sec.id" :style="{ '--c': sec.c }">
        <h4>
          <span class="no">{{ sec.num || 'i' }}</span>
          {{ sec.title }}
        </h4>

        <template v-if="sec.contact">
          <p>
            หากต้องการใช้สิทธิตามข้อ 5 หรือมีคำถามเกี่ยวกับข้อมูลของคุณ ติดต่อทีมผู้พัฒนาได้<template v-if="PRIVACY_CONTACT_EMAIL">ที่อีเมล
              <a :href="`mailto:${PRIVACY_CONTACT_EMAIL}`">{{ PRIVACY_CONTACT_EMAIL }}</a></template><template v-else>ผ่านผู้ดูแลระบบของโครงงาน</template>
          </p>
        </template>
        <template v-else>
          <ul v-if="sec.list" class="list">
            <li v-for="(item, i) in sec.list" :key="i">
              <template v-for="(x, k) in parts(item)" :key="k"><b v-if="x.b">{{ x.t }}</b><template v-else>{{ x.t }}</template></template>
            </li>
          </ul>
          <!-- ย่อหน้าท้ายรายการ = ข้อความเน้น (กล่องโน้ต) -->
          <p v-for="(para, i) in sec.p || []" :key="'p' + i" :class="{ note: sec.list }">
            <template v-for="(x, k) in parts(para)" :key="k"><b v-if="x.b">{{ x.t }}</b><template v-else>{{ x.t }}</template></template>
          </p>
        </template>
      </section>

      <p class="meta">ฉบับที่ {{ PRIVACY_VERSION }} ปรับปรุงล่าสุดเมื่อ {{ PRIVACY_UPDATED }}</p>

      <!-- ปุ่มยินยอม: ติดขอบล่างของป๊อปอัปเสมอ ไม่ต้องเลื่อนหา -->
      <footer v-if="mode === 'consent'" class="consent">
        <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
        <div class="btns">
          <button type="button" class="btn btn--light" :disabled="busy" @click="play('click'); emit('decline')">ไม่ยอมรับ</button>
          <button type="button" class="btn" :disabled="busy" @click="emit('accept')">
            <span v-if="busy" class="spinner" />ยอมรับและเริ่มเล่น
          </button>
        </div>
        <small>ถ้าไม่ยอมรับ ระบบจะออกจากบัญชี (กลับมายอมรับภายหลังได้)</small>
      </footer>
    </div>
  </BaseModal>
</template>

<style scoped>
.pp { display: flex; flex-direction: column; gap: 1.6rem; padding: 0.35rem 0.15rem 0.2rem; font-size: 0.94rem; line-height: 1.7; color: var(--text); }
svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
p { margin: 0; }
b { color: #2f5a3a; font-weight: 700; }
a { color: var(--accent); font-weight: 600; }

/* ข้อความนำ (โหมดขอความยินยอม) */
.lead { display: flex; align-items: center; gap: 0.85rem; padding: 0.85rem 1rem; border-radius: 1rem; background: #f2f9ee; border: 1.5px solid #d5ebcb; }
.lead p { font-weight: 600; color: #2f5a3a; line-height: 1.55; }
.lead-ic { flex: none; width: 2.4rem; height: 2.4rem; border-radius: 50%; display: grid; place-items: center; background: var(--leaf, #3a7d2c); color: #fff; }
.lead-ic svg { width: 1.3rem; height: 1.3rem; }

/* สรุป 4 ข้อ */
.sum { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem; }
.sum button {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem 0.9rem; text-align: left;
  border-radius: 1rem; cursor: pointer; font: inherit; color: inherit;
  background: #fff; border: 1.5px solid color-mix(in srgb, var(--c) 28%, #fff);
  transition: background 0.15s, border-color 0.15s;
}
.sum button:hover { background: color-mix(in srgb, var(--c) 6%, #fff); border-color: color-mix(in srgb, var(--c) 50%, #fff); }
.sum button:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
.si { flex: none; width: 2.3rem; height: 2.3rem; border-radius: 0.8rem; display: grid; place-items: center; background: var(--c); color: #fff; }
.si svg { width: 1.2rem; height: 1.2rem; }
.st { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
.st b { color: var(--c); font-size: 0.95rem; }
.st small { color: var(--text-muted); font-size: 0.78rem; margin-top: 0.1rem; }

/* หัวข้อเนื้อหา: เส้นคั่นบาง ๆ + เลขหัวข้อสีประจำเรื่อง */
.sec { scroll-margin-top: 0.6rem; padding-top: 1.4rem; border-top: 1px solid #e7eee3; display: flex; flex-direction: column; gap: 0.7rem; }
.sum + .sec { border-top: 0; padding-top: 0.2rem; }
h4 { display: flex; align-items: center; gap: 0.65rem; margin: 0; font-size: 1.05rem; line-height: 1.4; color: #2f5a3a; }
.no {
  flex: none; width: 1.7rem; height: 1.7rem; border-radius: 0.55rem; display: grid; place-items: center;
  font-size: 0.85rem; font-weight: 700; color: #fff; background: var(--c);
}
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; }
.list li { position: relative; padding-left: 1.25rem; }
.list li::before {
  content: ''; position: absolute; left: 0.2rem; top: 0.68em; width: 0.42rem; height: 0.42rem; border-radius: 50%;
  background: color-mix(in srgb, var(--c) 70%, #fff);
}
.note { padding: 0.7rem 0.9rem; border-radius: 0.85rem; background: color-mix(in srgb, var(--c) 7%, #fff); border-left: 3px solid var(--c); font-size: 0.9rem; line-height: 1.65; }

.meta { text-align: center; font-size: 0.78rem; color: var(--text-muted); padding-top: 0.2rem; }

/* ปุ่มยินยอม: ติดขอบล่างของพื้นที่เลื่อน (ชดเชย padding ล่างของ BaseModal) */
.consent {
  position: sticky; bottom: -1.2rem; z-index: 1;
  margin: -0.4rem -1.3rem -1.2rem; padding: 0.95rem 1.3rem 1rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.55rem;
  background: #ffffff; border-top: 1.5px solid #e3efdc; border-radius: 0 0 1.3rem 1.3rem;
  box-shadow: 0 -10px 18px rgba(255, 255, 255, 0.9);
}
.consent .btns { display: flex; gap: 0.7rem; width: 100%; justify-content: center; }
.consent .btn { min-width: 9.5rem; }
.consent small { font-size: 0.76rem; color: var(--text-muted); text-align: center; }
.consent .alert { width: 100%; margin: 0; }
.spinner {
  display: inline-block; width: 1em; height: 1em; margin-right: 0.4rem; vertical-align: -0.15em;
  border: 2.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite;
}

/* โทรศัพท์แนวนอน: ตัวอักษรเล็กลงเล็กน้อย แต่ยังเว้นระยะให้อ่านสบาย */
@media (max-height: 500px) {
  .pp { font-size: 0.85rem; line-height: 1.65; gap: 1.2rem; padding-top: 0.15rem; }
  .lead { padding: 0.6rem 0.8rem; gap: 0.65rem; }
  .lead-ic { width: 1.9rem; height: 1.9rem; }
  .lead-ic svg { width: 1.05rem; height: 1.05rem; }
  .sum { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; }
  .sum button { padding: 0.5rem 0.6rem; gap: 0.5rem; border-radius: 0.8rem; }
  .sum small { display: none; }
  .si { width: 1.7rem; height: 1.7rem; border-radius: 0.6rem; }
  .si svg { width: 0.95rem; height: 0.95rem; }
  .st b { font-size: 0.8rem; }
  .sec { padding-top: 1.05rem; gap: 0.5rem; }
  h4 { font-size: 0.93rem; }
  .no { width: 1.45rem; height: 1.45rem; font-size: 0.75rem; border-radius: 0.45rem; }
  .list { gap: 0.4rem; }
  .note { padding: 0.55rem 0.75rem; font-size: 0.82rem; }
  .consent { bottom: -0.8rem; margin: -0.3rem -1rem -0.8rem; padding: 0.6rem 1rem 0.65rem; gap: 0.35rem; border-radius: 0 0 1rem 1rem; }
  .consent .btn { min-height: 34px; min-width: 7.5rem; font-size: 0.85rem; }
  .consent small { font-size: 0.68rem; }
}
/* จอเตี้ยมาก: ซ่อนคำอธิบายรอง ให้พื้นที่อ่านเนื้อหามากขึ้น */
@media (max-height: 400px) {
  .lead p { font-size: 0.8rem; }
  .consent small { display: none; }
}
@media (max-width: 480px) {
  .sum { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
