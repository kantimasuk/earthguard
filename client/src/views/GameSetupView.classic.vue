<script setup>
// หน้าตั้งค่าเกม: เลือกระดับความยาก (ง่าย 2 AI / ปานกลาง 3 AI / ยาก 4 AI) → สร้างรอบการเล่น → Pre-test
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppNavbar from '@/components/AppNavbar.vue';
import PlayerAvatar from '@/components/PlayerAvatar.vue';
import RulesModal from '@/components/RulesModal.vue';
import { DIFFICULTIES, sessionApi, sessionErrorMessage } from '@/services/sessionApi';
import { AI_LIST } from '@/game/avatars';
import { uiImg } from '@/services/uiArt';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { play } from '@/services/sound';

const router = useRouter();
const session = useSessionStore();
const toast = useToastStore();

// รูปประจำระดับของทีม (assets/ui/level-easy.png ฯลฯ) — ไม่มีรูป → แสดงรูป AI เรียงกันแทน
const levelArt = Object.fromEntries(DIFFICULTIES.map((d) => [d.key, uiImg(`level-${d.key}`)]));

const picked = ref(session.current?.difficulty || 'easy');
const loading = ref(false);
const rulesOpen = ref(false);

function pick(d) {
  if (picked.value === d.key) return;
  play('tap');
  picked.value = d.key;
}

async function start() {
  if (loading.value) return;
  play('tap');
  loading.value = true;
  try {
    const res = await sessionApi.create(picked.value);
    session.start(res);
    router.push('/pretest');
  } catch (e) {
    play('error');
    toast.show(sessionErrorMessage(e), { type: 'error', duration: 3500 });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="page setup">
    <AppNavbar />

    <section class="content">
      <header class="heading">
        <h1>ตั้งค่าเกม<br>เลือกระดับความยาก</h1>
      </header>

      <div class="levels" role="radiogroup" aria-label="ระดับความยาก">
        <button
          v-for="(d, i) in DIFFICULTIES"
          :key="d.key"
          type="button"
          role="radio"
          class="level"
          :class="[`lv-${d.key}`, { on: picked === d.key }]"
          :aria-checked="picked === d.key"
          :style="{ animationDelay: 0.07 * i + 's' }"
          @click="pick(d)"
        >
          <span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
          <span class="art">
            <img v-if="levelArt[d.key]" :src="levelArt[d.key]" :alt="`ระดับ${d.label}`" />
            <span v-else class="bots">
              <PlayerAvatar v-for="a in AI_LIST.slice(0, d.ai)" :key="a.avatar" is-ai :avatar="a.avatar" :name="a.name" size="var(--av)" />
            </span>
          </span>
          <span class="name">{{ d.label }}</span>
          <span class="count">AI {{ d.ai }} ตัว</span>
          <span class="desc">{{ d.desc.split(' · ')[1] }}</span>
        </button>
      </div>

      <div class="actions">
        <button type="button" class="btn btn--ghost" @click="play('click'); rulesOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v.01M12 13.5c0-2 2.5-2 2.5-4a2.5 2.5 0 0 0-5 0 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /></svg>
          กติกาย่อ
        </button>
        <button type="button" class="btn start" :disabled="loading" @click="start">
          <span v-if="loading" class="spinner" />
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" /></svg>
          เริ่มเกม
        </button>
      </div>
    </section>

    <p class="note">
      <span class="i" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 10.5v6.5" /><circle cx="12" cy="7" r="0.6" /></svg>
      </span>
      ก่อนเริ่มเกมจะมีแบบทดสอบสั้น ๆ 5 ข้อ (2 นาที)
    </p>

    <RulesModal :open="rulesOpen" @close="rulesOpen = false" />
  </main>
</template>

<style scoped>
.content {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(10px, 3.2vh, 26px);
  padding: 8px 0;
}
.heading { text-align: center; }
.heading h1 {
  font-family: var(--font-head); font-size: 2.35rem; font-weight: 600; letter-spacing: 0.01em;
  color: #24452b;
  text-shadow: 0 0 18px rgba(255, 255, 255, 0.95), 0 0 4px rgba(255, 255, 255, 0.9), 0 2px 0 rgba(255, 255, 255, 0.6);
  margin-bottom: 1rem;
}

.levels { display: grid; grid-template-columns: repeat(3, minmax(0, 19rem)); gap: clamp(10px, 2.2vw, 28px); width: 100%; justify-content: center; }
.level {
  --c: #3a7d2c;
  --av: 3rem;
  position: relative; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
  padding: 1.1rem 0.9rem 1.2rem;
  border-radius: 1.3rem; cursor: pointer; text-align: center;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid transparent;
  box-shadow: 0 0.6rem 1.4rem rgba(20, 50, 20, 0.18);
  transition: transform 0.2s var(--ease-back), border-color 0.2s, box-shadow 0.2s;
  animation: pop-in 0.5s var(--ease-back) both;
  font-family: var(--font-body); color: var(--text);
}
.lv-medium { --c: #2b76ad; }
.lv-hard { --c: #b8553a; }
.level:hover { transform: translateY(-2px); }
.level.on { border-color: var(--c); transform: translateY(-5px); box-shadow: 0 0.9rem 1.8rem rgba(20, 50, 20, 0.25); }
.check {
  position: absolute; top: -0.6rem; right: -0.6rem; z-index: 1; width: 1.9rem; height: 1.9rem; border-radius: 50%;
  display: grid; place-items: center; background: var(--c); border: 3px solid #fff;
  transform: scale(0); transition: transform 0.25s var(--ease-back);
}
.check svg { width: 70%; height: 70%; fill: none; stroke: #fff; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
.level.on .check { transform: scale(1); }
/* พื้นที่รูป: สูงคงที่ ทุกการ์ดจึงเท่ากัน ไม่ว่าจะใช้รูปของทีมหรือรูป AI */
.art { width: 100%; height: 9.5rem; display: grid; place-items: center; }
.art { position: relative; }
.art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: center bottom; transform-origin: center bottom; transition: transform 0.3s var(--ease-back); }
.level.on .art img { transform: scale(1.06); }
/* แอนิเมชันรูประดับ: ปกติลอยขึ้นลงเบา ๆ (แต่ละระดับจังหวะไม่ตรงกัน) · ระดับที่เลือก = กระโดดดีใจ
   ใช้ translate / rotate แยกจาก transform (scale ตอนเลือก) → เล่นพร้อมกันได้ ไม่ทับกัน */
.art img { animation: lv-float 3s ease-in-out infinite; }
.lv-medium .art img { animation-delay: -1s; }
.lv-hard .art img { animation-delay: -2s; }
.level:hover .art img { animation: lv-wiggle 0.7s ease-in-out infinite; }
.level.on .art img { animation: lv-hop 1.6s var(--ease-out) infinite; }
@keyframes lv-float {
  0%, 100% { translate: 0 0; rotate: 0deg; }
  25% { rotate: -1.2deg; }
  50% { translate: 0 -4%; rotate: 0deg; }
  75% { rotate: 1.2deg; }
}
@keyframes lv-wiggle {
  0%, 100% { rotate: 0deg; }
  25% { rotate: -2.5deg; }
  75% { rotate: 2.5deg; }
}
@keyframes lv-hop {
  0%, 60%, 100% { translate: 0 0; }
  18% { translate: 0 -10%; }
  32% { translate: 0 0; }
  42% { translate: 0 -4%; }
}
@media (prefers-reduced-motion: reduce) {
  .art img, .level:hover .art img, .level.on .art img { animation: none; }
}
.name { font-family: var(--font-head); font-size: 1.6rem; font-weight: 700; color: var(--c); line-height: 1.2; }
.bots { display: flex; justify-content: center; }
.bots > * + * { margin-left: -0.55rem; }
.count { font-weight: 600; font-size: 1rem; }
.desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.35; }

.actions { display: flex; gap: 0.8rem; }
.actions svg { width: 1.15rem; height: 1.15rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.start { min-width: 11rem; font-size: 1.1rem; }
.start svg { fill: currentColor; stroke: none; }
/* ข้อความแจ้งแบบทดสอบ: ป้ายสีขาว + ไอคอน i ชิดขอบล่างของจอ */
.note {
  position: absolute; left: 50%; bottom: calc(var(--safe-b) + 10px); transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 0.5rem; white-space: nowrap;
  padding: 0.4rem 1rem 0.4rem 0.45rem; border-radius: 999px;
  background: #ffffff; color: #24452b; font-size: 0.9rem; font-weight: 500;
  box-shadow: 0 4px 14px rgba(20, 50, 20, 0.18);
  animation: note-in 0.5s var(--ease-back) 0.3s both;
}
.note b { color: var(--leaf-dark); font-weight: 700; }
.note .i {
  width: 1.5rem; height: 1.5rem; flex: none; border-radius: 50%;
  display: grid; place-items: center; background: var(--leaf, #3a7d2c);
}
.note .i svg { width: 1.05rem; height: 1.05rem; fill: #fff; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; }
@keyframes note-in { from { opacity: 0; transform: translate(-50%, 12px); } }

@keyframes pop-in { from { opacity: 0; transform: translateY(16px) scale(0.95); } }

@media (max-height: 500px) {
  .content { gap: clamp(8px, 3vh, 16px); padding-top: 4px; }
  .heading h1 { font-size: 1.45rem; }
  .heading p { font-size: 0.78rem; }
  .content { padding-bottom: 2.1rem; } /* เว้นที่ให้ป้ายแจ้งด้านล่าง */
  .levels { grid-template-columns: repeat(3, minmax(0, 16rem)); }
  .level { --av: clamp(1.9rem, 10vh, 2.6rem); padding: 0.45rem 0.45rem 0.6rem; gap: 0.15rem; border-radius: 1rem; }
  .art { height: clamp(3.6rem, 25vh, 7.5rem); }
  .name { font-size: 1.3rem; }
  .count { font-size: 0.8rem; }
  .desc { font-size: 0.68rem; }
  .actions .btn { font-size: 0.85rem; min-height: 36px; }
  .start { min-width: 8.5rem; }
  .note { font-size: 0.72rem; bottom: calc(var(--safe-b) + 6px); padding: 0.25rem 0.8rem 0.25rem 0.3rem; gap: 0.4rem; }
  .note .i { width: 1.2rem; height: 1.2rem; }
  .note .i svg { width: 0.85rem; height: 0.85rem; }
}
@media (max-height: 360px) {
  .heading p, .desc { display: none; }
}
</style>
